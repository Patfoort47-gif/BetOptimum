import { analyseMatch, primeAnalysis } from './model.js';
async function cooperative(matches) {
  for (let i = 0; i < matches.length; i++) {
    analyseMatch(matches[i]);
    if (i % 10 === 9) await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
export async function prepareAnalyses(matches, { WorkerClass = globalThis.Worker } = {}) {
  if (matches.length <= 100 || !WorkerClass) return cooperative(matches);
  let worker;
  try {
    worker = new WorkerClass(new URL('./analysis-worker.js', import.meta.url), { type: 'module' });
  } catch {
    return cooperative(matches);
  }
  await new Promise((resolve) => {
    let finished = false;
    const finish = async (results) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      if (results) {
        for (let i = 0; i < matches.length; i++) {
          primeAnalysis(matches[i], results[i]);
          if (i % 10 === 9) await new Promise((resolve) => setTimeout(resolve, 0));
        }
      } else await cooperative(matches);
      resolve();
    };
    const timer = setTimeout(() => finish(), 15000);
    worker.onmessage = ({ data }) =>
      finish(data.results?.length === matches.length ? data.results : null);
    worker.onerror = () => finish();
    try {
      worker.postMessage(matches);
    } catch {
      finish();
    }
  });
}
