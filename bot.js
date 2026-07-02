import TelegramBot from 'node-telegram-bot-api';
import { runTest, stopTest } from './main.js';

const token = "8962044822:AAGNjh-qyQQsFY6SitarRFMzr5DepQOCNmY";

const bot = new TelegramBot(token, { polling: true });

// Objek untuk melacak status pengguna dan tes yang aktif
const userState = {};
const activeTest = {};

console.log("Bot is running... Send /start to your bot in Telegram.");

// Handler untuk tombol inline
bot.on('callback_query', (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;

  if (callbackQuery.data === 'start_test') {
    if (activeTest[chatId]) {
      bot.answerCallbackQuery(callbackQuery.id, { text: 'Tes lain sedang berjalan!', show_alert: true });
      return;
    }
    userState[chatId] = 'awaiting_target';
    bot.answerCallbackQuery(callbackQuery.id);
    bot.sendMessage(chatId, "Silakan masukkan target dan durasi (detik).\n\nContoh: `https://example.com 60`", { parse_mode: 'Markdown' });
  }
});

// Handler untuk semua pesan teks dari pengguna
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Abaikan jika bukan pesan teks (misal: stiker, foto)
  if (!text) {
    return;
  }

  // Router untuk perintah
  if (text.startsWith('/start')) {
    const welcomeText = "Selamat datang! Bot ini siap untuk melakukan uji beban (load test).\n\nKlik tombol di bawah untuk memulai.";
    bot.sendMessage(chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🚀 Mulai Serangan', callback_data: 'start_test' }]
        ]
      }
    });
    return;
  }

  if (text.startsWith('/stop')) {
    if (activeTest[chatId]) {
      stopTest(); // Panggil fungsi untuk menghentikan tes
      bot.sendMessage(chatId, "🛑 Sinyal berhenti telah dikirim. Tes akan berhenti setelah batch saat ini selesai.");
      delete activeTest[chatId];
    } else {
      bot.sendMessage(chatId, "Tidak ada tes yang sedang berjalan.");
    }
    return;
  }

  // Jika bot tidak sedang menunggu input target, abaikan pesan lain.
  if (userState[chatId] !== 'awaiting_target') return;

  const parts = text.split(/\s+/);
  if (parts.length !== 2) {
    bot.sendMessage(chatId, "Format salah. Gunakan: `URL DURASI`\nContoh: `https://example.com 60`", { parse_mode: 'Markdown' });
    return;
  }

  const targetUrl = parts[0];
  const duration = parseInt(parts[1], 10);

  try {
    new URL(targetUrl);
  } catch (e) {
    bot.sendMessage(chatId, "URL tidak valid. Pastikan dimulai dengan http:// atau https://");
    return;
  }

  if (isNaN(duration) || duration <= 0 || duration > 600) { // Batasi durasi maks 10 menit
    bot.sendMessage(chatId, "Durasi tidak valid. Masukkan angka antara 1 dan 600 detik.");
    return;
  }

  delete userState[chatId];
  const initialMessage = await bot.sendMessage(chatId, "✅ Tes dimulai... Menyiapkan monitoring.");
  const messageId = initialMessage.message_id;
  activeTest[chatId] = true;

  const onProgress = async (progress) => {
    const text = `*🔥 Monitoring Serangan...*
--------------------------------------
*Target:* \`${targetUrl}\`
*Waktu Berjalan:* ${progress.elapsed}s / ${duration}s
*Total Terkirim:* ${progress.totalRequestsSent}
*Sukses:* ${progress.successCount}
*Gagal:* ${progress.errorCount}
--------------------------------------
Kirim /stop untuk menghentikan paksa.`;
    try {
      await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
    } catch (e) { /* Abaikan error "message is not modified" */ }
  };

  const onComplete = async (results) => {
    const status = results.stoppedByUser ? '🛑 DIHENTIKAN PENGGUNA' : '✅ SELESAI';
    const text = `*Laporan Serangan ${status}*
--------------------------------------
*Target:* \`${targetUrl}\`
*Durasi Aktual:* ${results.actualDuration} detik
*Total Permintaan:* ${results.totalRequestsSent}
*Sukses:* ${results.successCount}
*Gagal:* ${results.errorCount}
*RPS (Rata-rata):* ${results.rps}
--------------------------------------`;
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
    delete activeTest[chatId];
  };

  runTest({ targetUrl, duration, concurrency: 100, onProgress, onComplete });
});
