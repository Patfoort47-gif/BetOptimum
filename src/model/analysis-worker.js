import { analyseMatch } from './model.js';
self.onmessage = ({ data }) => {
  try {
    const start = performance.now(),
      results = data.map((match) => analyseMatch(match));
    self.postMessage({ results, computeMs: performance.now() - start });
  } catch {
    self.postMessage({ error: true });
  }
};
