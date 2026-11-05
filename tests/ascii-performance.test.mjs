import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { characterPoints, HERO_SOURCE } from '../lib/ascii-character.js';
import { ASCII_POINTS_URL } from '../lib/ascii-asset.js';
import { encodeAsciiPoints, decodeAsciiPoints } from '../lib/ascii-points-format.js';
import { createParticleMotion } from '../lib/ascii-physics.js';

test('published data preserves every sampled character and attribute', async () => {
  const pixels = await sharp(`public${HERO_SOURCE}`).resize(1280, 550, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  const expected = characterPoints(pixels, 1280, 550, 4);
  const file = await fs.readFile(`public${ASCII_POINTS_URL}`);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const decoded = decodeAsciiPoints(buffer);
  for (const name of ['positions', 'tones', 'colors', 'sizes']) {
    assert.deepEqual(decoded[name], expected[name], `Regenerate ASCII asset after changing ${name}`);
    assert.equal(decoded[name].buffer, buffer, 'Decoding must not copy particle arrays');
  }
  assert.deepEqual(new Uint8Array(encodeAsciiPoints(expected)), new Uint8Array(buffer));
  assert.ok(file.length < (await fs.stat(`public${HERO_SOURCE}`)).size / 4);
});

test('truncated or incompatible point data is rejected before creating a scene', () => {
  assert.throws(() => decodeAsciiPoints(new ArrayBuffer(2)), /Incomplete/);
  assert.throws(() => decodeAsciiPoints(new ArrayBuffer(8)), /Invalid/);
  const buffer = encodeAsciiPoints({ positions: new Float32Array(3), tones: new Float32Array(1), colors: new Float32Array(3), sizes: new Float32Array(1) });
  assert.throws(() => decodeAsciiPoints(buffer.slice(0, -1)), /Invalid/);
});

test('resting points skip uploads; touched points move, recover and sleep', () => {
  const rest = new Float32Array([0, 0, 0, 5, 5, 0]);
  const motion = createParticleMotion(rest);
  assert.equal(motion.update(1 / 30, false, null), false);
  assert.equal(motion.update(1 / 30, true, { x: 50, y: 50 }), false);
  assert.equal(motion.update(1 / 30, true, { x: .1, y: .1 }), true);
  assert.notDeepEqual(motion.positions.slice(0, 3), rest.slice(0, 3));
  assert.deepEqual(motion.positions.slice(3), rest.slice(3));
  assert.deepEqual(rest, new Float32Array([0, 0, 0, 5, 5, 0]), 'Shared cached data must remain immutable');
  for (let frame = 0; frame < 600; frame++) motion.update(1 / 30, false, null);
  assert.deepEqual(motion.positions, rest);
  assert.equal(motion.update(1 / 30, false, null), false);
  assert.equal(motion.update(1 / 30, true, { x: 0, y: 0 }), true, 'Sleeping points must wake again');
});

test('data requests share their download and retry after failure', async t => {
  const { loadAsciiData } = await import('../lib/ascii-data.js');
  const file = await fs.readFile(`public${ASCII_POINTS_URL}`);
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    if (requests === 1) return new Response('', { status: 503 });
    return new Response(file);
  });
  await assert.rejects(loadAsciiData(), /unavailable/);
  const first = loadAsciiData();
  assert.equal(first, loadAsciiData());
  const data = await first;
  assert.equal(data, await loadAsciiData());
  assert.equal(requests, 2);
});

test('a stalled shared download times out and a new activation can retry', async t => {
  const { loadAsciiData } = await import('../lib/ascii-data.js?timeout-test');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const file = await fs.readFile(`public${ASCII_POINTS_URL}`);
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    if (++requests > 1) return new Response(file);
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  });
  const failed = assert.rejects(loadAsciiData(), { name: 'AbortError' });
  t.mock.timers.tick(20000);
  await failed;
  assert.ok((await loadAsciiData()).tones.length > 0);
  assert.equal(requests, 2);
});
