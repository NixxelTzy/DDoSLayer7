const crypto = require('crypto');
const { URLSearchParams } = require('url');
const https = require('https');

const proxyList = [];
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
    }
];

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

const cipher_suites_pool = [
    'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-RSA-AES128-SHA:ECDHE-RSA-AES256-SHA:AES128-GCM-SHA256:AES256-GCM-SHA384:AES128-SHA:AES256-SHA',
    'TLS_AES_128_GCM_SHA256:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_256_GCM_SHA384:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA:ECDHE-RSA-AES128-SHA',
];

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

    let randomIp1 = `${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;
    const randomIp2 = `${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;
    const randomIp3 = `${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;
    const randomIp4 = `${crypto.randomInt(1, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;

    let hostHeader = target.host;
    if (Math.random() < 0.05) {
        hostHeader += ' '; // Trailing space for Host header bypass
    }

    if (Math.random() < 0.2) {
        randomIp1 = `${randomIp1}, ${randomIp2}`; // Chain IPs for X-Forwarded-For
    }

    let headersArray = [
        ['Host', hostHeader],
        ['User-Agent', persona.ua],
        ['Accept', getDynamicAcceptHeader(fetchDest)],
        ['Accept-Encoding', randomChoice(accept_encoding_pool)],
        ['Accept-Language', generateRealisticAcceptLanguage()],
        ['Cache-Control', 'no-cache'],
        ['Pragma', 'no-cache'],
        ['Upgrade-Insecure-Requests', Math.random() > 0.5 ? '1' : null],
        ['Connection', 'keep-alive'],
        ['Device-Memory', randomChoice(device_memory_pool)],
        ['Viewport-Width', randomChoice(viewport_width_pool)],
        ['Sec-Fetch-Dest', fetchDest],
        ['Sec-Fetch-User', '?1'],
        ['X-Forwarded-For', randomIp1],
        ['X-Forwarded-Proto', 'https'],
    ];

    if (persona.sec_ch_ua) {
        headersArray.push(['sec-ch-ua', persona.sec_ch_ua]);
        headersArray.push(['sec-ch-ua-mobile', '?0']);
        headersArray.push(['sec-ch-ua-platform', persona.platform]);
    }

    if (Math.random() < 0.4) {
        headersArray.push(['X-Real-IP', randomIp2]);
    }
    if (Math.random() < 0.3) {
        headersArray.push(['Forwarded', `for=${randomIp1};proto=https;by=${randomIp2}`]);
    }
    if (Math.random() < 0.25) {
        headersArray.push(['True-Client-IP', randomIp3]);
    }
    if (Math.random() < 0.15) {
        headersArray.push(['CF-Connecting-IP', randomIp4]);
    }
    if (Math.random() < 0.15) {
        headersArray.push(['X-Client-IP', randomIp4]);
    }

    const siteChoice = Math.random();
    if (siteChoice < 0.5) {
        headersArray.push(['Sec-Fetch-Site', 'none']);
        headersArray.push(['Sec-Fetch-Mode', 'navigate']);
    } else if (siteChoice < 0.8) {
        headersArray.push(['Sec-Fetch-Site', 'same-origin']);
        headersArray.push(['Sec-Fetch-Mode', 'cors']);
        headersArray.push(['Referer', `${target.protocol}//${target.host}/${crypto.randomBytes(4).toString('hex')}`]);
    } else {
        headersArray.push(['Sec-Fetch-Site', 'cross-site']);
        headersArray.push(['Sec-Fetch-Mode', 'cors']);
        headersArray.push(['Referer', randomChoice(referers)]);
    }

    if (fetchDest === 'empty') {
        headersArray.push(['X-Requested-With', 'XMLHttpRequest']);
    }

    if (Math.random() < 0.75) {
        headersArray.push(['Cookie', generateFakeCookies()]);
    }

    headersArray.push(['X-Request-ID', crypto.randomUUID()]);
    if (Math.random() < 0.2) {
        headersArray.push(['Via', `1.1 ${crypto.randomBytes(4).toString('hex')}.com (CloudFront)`]);
    }
    if (Math.random() < 0.15) {
        headersArray.push(['Via', `1.1 ${crypto.randomBytes(6).toString('hex')}.internal-proxy`]);
    }
    if (Math.random() < 0.1) {
        headersArray.push(['Via', `1.1 ${crypto.randomBytes(5).toString('hex')}.cdn`]);
    }
    if (Math.random() < 0.3) {
        headersArray.push(['X-Blue-Coat-Via', crypto.randomBytes(16).toString('hex')]);
    }
    const headers = Object.fromEntries(headersArray.filter(h => h[1] !== null).sort(() => Math.random() - 0.5));

    const httpsAgent = new https.Agent({
        ciphers: randomChoice(cipher_suites_pool),
        honorCipherOrder: true,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        rejectUnauthorized: false
    });

    const options = {
        headers: headers,
        timeout: 8000,
        signal: signal,
        // Hanya anggap kode status 2xx sebagai sukses. Semua yang lain akan dianggap error.
        validateStatus: (status) => status >= 200 && status < 300,
        httpsAgent: httpsAgent,
    };

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
    const shuffled = languages.sort(() => 0.5 - Math.random());
    const count = 2 + Math.floor(Math.random() * 3);
    return shuffled.slice(0, count).map(lang => `${lang.code};q=${lang.q}`).join(',');
}

function generateFakeCookies() {
    const cookiePairs = [];
    const sessionIds = ['PHPSESSID', 'JSESSIONID', 'session', 'connect.sid', 'ASP.NET_SessionId'];
    const trackingIds = ['_ga', '_gid', '__utmz', 'cf_clearance', '_gat', 'FPLC', '_uetvid'];

    cookiePairs.push(`${randomChoice(sessionIds)}=${crypto.randomBytes(16).toString('hex')}`);

    if (Math.random() > 0.3) {
        cookiePairs.push(`${randomChoice(trackingIds)}=${crypto.randomBytes(20).toString('hex')}`);
    }
    if (Math.random() > 0.5) {
        cookiePairs.push(`${randomChoice(trackingIds)}=${crypto.randomUUID()}`);
    }
    
    return cookiePairs.join('; ');
}

function generateUrlEncodedPayload() {
    const params = new URLSearchParams();
    const fieldCount = 5 + Math.floor(Math.random() * 10);
    for (let i = 0; i < fieldCount; i++) {
        const key = crypto.randomBytes(4 + Math.floor(Math.random() * 4)).toString('hex');
        const value = crypto.randomBytes(10 + Math.floor(Math.random() * 40)).toString('hex');
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
    
    let jsonString = JSON.stringify(data);

    if (Math.random() < 0.1) {
        const duplicateKey = `"id":"${crypto.randomUUID()}"`;
        jsonString = jsonString.replace('{', `{${duplicateKey},`);
    }

    return jsonString;
}

const getRandomPayload = () => {
    const choice = Math.random();
    if (choice < 0.5) {
        return {
            payload: JSON.parse(generateComplexJsonPayload()),
            type: 'json'
        };
    } else {
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