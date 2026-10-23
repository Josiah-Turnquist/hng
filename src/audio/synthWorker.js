// Web Worker used by AudioSystem.init(): synthesizes sounds off the main thread.
// Receives { id, variant, sampleRate } jobs one at a time and answers with the
// samples (transferred, not copied). Output is identical to the main-thread
// path because generateSound() is deterministic.
import { generateSound } from './synth.js';

self.onmessage = (e) => {
  const { id, variant, sampleRate } = e.data;
  try {
    const data = generateSound(id, variant, sampleRate);
    self.postMessage({ id, variant, sampleRate, data }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id, variant, error: String(err?.stack || err) });
  }
};
