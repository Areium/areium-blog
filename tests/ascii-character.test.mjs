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

test('facial features use four times the linear sampling density of wings', async () => {
  const pixels = await sharp('public/images/hero/wallhaven-yqkyyx.jpg').resize(1280, 550).ensureAlpha().raw().toBuffer();
  const { positions, sizes, colors } = characterPoints(pixels, 1280, 550, 4);
  assert.equal(sizes.length * 3, positions.length);
  const fine = 14 / 1280 * 1.18;
  assert.ok(sizes.filter(size => Math.abs(size - fine) < .0001).length > 3000);
  assert.ok(sizes.filter(size => Math.abs(size - fine * 4) < .0001).length > 5000);
  let halo = 0;
  for (let index = 0; index < positions.length; index += 3) {
    if (positions[index + 1] > 1.8 && colors[index] === 1 && Math.abs(colors[index + 1] - .84) < .001) halo++;
  }
  assert.ok(halo > 100, 'The gold halo and horns must extend above the head');
  for (const [eyeX, eyeY] of [[1798, 484], [1865, 446]]) {
    let gold = 0;
    for (let index = 0; index < positions.length; index += 3) {
      const x = (positions[index] / 14 + .48) * 3360;
      const y = (.50 - positions[index + 1] / 6) * 1440;
      if (Math.hypot(x - eyeX, y - eyeY) < 14 && colors[index] === 1 && Math.abs(colors[index + 1] - .72) < .001) gold++;
    }
    assert.ok(gold > 30, 'Each iris should retain a dense cluster of gold characters');
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
