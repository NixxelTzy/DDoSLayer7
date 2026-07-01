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
        platform: '"macOS"'
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
];

// Helper untuk memilih item acak dari array
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

const accept_encoding_pool = ['gzip, deflate, br, zstd', 'gzip, deflate, br', 'gzip, deflate'];

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

const jsonPayloadPool = Array.from({ length: 25 }, generateComplexJsonPayload);
const urlEncodedPayloadPool = Array.from({ length: 25 }, generateUrlEncodedPayload);

const getRandomPayload = () => {
    const choice = Math.random();
    if (choice < 0.5) { // 50% JSON
        return {
            payload: JSON.parse(randomChoice(jsonPayloadPool)),
            type: 'json'
        };
    } else { // 50% URL Encoded
        return {
            payload: new URLSearchParams(randomChoice(urlEncodedPayloadPool)),
            type: 'form'
        };
    }
};

module.exports = {
    proxyList,
    browserPersonas,
    getRandomPayload
};