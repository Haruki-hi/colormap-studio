// optimizer.worker.js — Web Worker wrapper for SA optimization
import { runSA, interpolateColors } from './optimizer.js';

self.onmessage = function (e) {
  const { initialLs, initialAs, initialBs, prefIndices, params } = e.data;

  const result = runSA(
    new Float64Array(initialLs),
    new Float64Array(initialAs),
    new Float64Array(initialBs),
    prefIndices,
    params,
    (progress, eScore, currentLs, currentAs, currentBs) => {
      self.postMessage({
        type: 'progress',
        progress,
        eScore,
        // Send current control point positions for Lab trajectory visualization
        currentPoints: {
          ls: Array.from(currentLs),
          as: Array.from(currentAs),
          bs: Array.from(currentBs),
        },
      });
    }
  );

  // Interpolate to 256 colors
  const interp = interpolateColors(256, params.n, result.ls, result.as, result.bs);

  self.postMessage({
    type: 'done',
    controlPoints: result,
    interpolated: {
      ls: Array.from(interp.ls),
      as: Array.from(interp.as),
      bs: Array.from(interp.bs),
    },
    eScore: result.eScore,
  });
};
