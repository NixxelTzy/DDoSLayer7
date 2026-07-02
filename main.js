import axios from 'axios';
import http from 'http';
import https from 'https';

let isTestRunning = false;

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
const keepAliveAxios = axios.create({ httpAgent, httpsAgent });

export function stopTest() {
  isTestRunning = false;
}

export async function runTest(options) {
  const {
    targetUrl,
    duration,
    onProgress,
    onComplete,
  } = options;

  const TOTAL_THREADS = 300;
  const KEEP_ALIVE_THREADS = Math.floor(TOTAL_THREADS / 2);
  const ABORT_THREADS = TOTAL_THREADS - KEEP_ALIVE_THREADS;
  const DELAY_MS = 200;

  if (isTestRunning) return;
  isTestRunning = true;

  let successCount = 0;
  let errorCount = 0;
  let totalRequestsSent = 0;
  const startTime = Date.now();

  while (isTestRunning && (Date.now() - startTime) / 1000 < duration) {
    const promises = [];

    for (let i = 0; i < KEEP_ALIVE_THREADS; i++) {
      promises.push(
        keepAliveAxios.get(targetUrl)
          .then(() => { successCount++; })
          .catch(() => { errorCount++; })
      );
    }

    for (let i = 0; i < ABORT_THREADS; i++) {
      const controller = new AbortController();
      const requestPromise = axios.get(targetUrl, {
        signal: controller.signal
      }).catch(() => {
        errorCount++;
      });
      controller.abort();
      promises.push(requestPromise);
    }

    await Promise.all(promises);
    totalRequestsSent += TOTAL_THREADS;

    if (onProgress) {
      const elapsed = (Date.now() - startTime) / 1000;
      await onProgress({ elapsed: elapsed.toFixed(1), totalRequestsSent, successCount, errorCount });
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  const endTime = Date.now();
  const actualDuration = (endTime - startTime) / 1000;
  const wasStopped = isTestRunning === false;
  isTestRunning = false;

  const results = {
    actualDuration: actualDuration.toFixed(2),
    successCount, errorCount, totalRequestsSent,
    rps: (totalRequestsSent / actualDuration).toFixed(2) || '0.00',
    stoppedByUser: wasStopped,
  };

  if (onComplete) await onComplete(results);
  return results;
}
