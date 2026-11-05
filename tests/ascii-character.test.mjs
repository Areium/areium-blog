import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { characterPoints, headBounds } from '../lib/ascii-character.js';

test('head hit area follows cover scaling on desktop and mobile', () => {
  for (const [width, height] of [[1104, 570], [350, 149]]) {
    const bounds = headBounds(width, height);
    const scale = Math.max(width / 3360, height / 1440);
    const headX = (width - 3360 * scale) / 2 + 1830 * scale;
    const headY = 450 * scale;
    assert.ok(headX > bounds.left && headX < bounds.left + bounds.width);
    assert.ok(headY > bounds.top && headY < bounds.top + bounds.height);
  }
});

test('ASCII points use the real hero and retain the character face and wings', async () => {
  const pixels = await sharp('public/images/hero/wallhaven-yqkyyx.jpg').resize(260, 112).ensureAlpha().raw().toBuffer();
  const { positions, tones } = characterPoints(pixels, 260, 112);
  assert.equal(positions.length, tones.length * 3);
  assert.ok(tones.length > 3000 && tones.length < 20000);
  assert.ok(positions.every(Number.isFinite));
  let face = 0, left = 0, right = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y] = positions.slice(i, i + 2);
    if (x > .3 && x < 1.5 && y > .65 && y < 1.7) face++;
    if (x < -2) left++;
    if (x > 2) right++;
  }
  assert.ok(face > 100 && left > 500 && right > 500);
});
