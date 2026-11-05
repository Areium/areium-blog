import { ASCII_POINTS_URL } from './ascii-asset.js';
import { decodeAsciiPoints } from './ascii-points-format.js';

let pending;
// Share one download across hover, opening, cancellation and reopening. A failed
// download is retryable; cancelling a scene must not cancel another consumer.
export function loadAsciiData() {
  if (!pending) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    pending = fetch(ASCII_POINTS_URL, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('ASCII data unavailable');
      return response.arrayBuffer();
    }).then(decodeAsciiPoints).catch(error => {
      pending = undefined;
      throw error;
    }).finally(() => clearTimeout(timer));
  }
  return pending;
}
