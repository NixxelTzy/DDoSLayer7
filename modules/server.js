const http = require('http');

// Jalankan bot
require('./bot.js');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive\n');
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log('Telegram bot has been started.');
});