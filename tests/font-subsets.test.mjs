import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fontFaces } from '../lib/font-faces.js';
import { reportDocument } from '../lib/report-document.js';

const manifest = JSON.parse(fs.readFileSync('lib/font-manifest.json', 'utf8'));
const digest = data => createHash('sha256').update(data).digest('hex');

function codepoints(range) {
  return range.split(',').flatMap(part => {
    const [start, end = start] = part.slice(2).split('-').map(value => parseInt(value, 16));
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });
}

test('font subsets have valid content hashes and cover the original repertoire without overlapping ranges', () => {
  assert.equal(digest(fs.readFileSync('public/fonts/OPlusSans3-Regular.ttf')), manifest.sourceSha256);
  const covered = new Set();
  for (const entry of manifest.subsets) {
    const bytes = fs.readFileSync('public' + entry.url);
    assert.equal(bytes.subarray(0, 4).toString(), 'wOF2');
    assert.equal(bytes.length, entry.bytes);
    assert.ok(entry.url.includes(digest(bytes).slice(0, 16)));
    const points = codepoints(entry.unicodeRange);
    assert.equal(points.length, entry.characters);
    for (const point of points) {
      assert.ok(!covered.has(point), `Overlapping Unicode range at ${point}`);
      covered.add(point);
    }
  }
  assert.equal(covered.size, manifest.characters);
  assert.equal(covered.size, 28633);
});

test('outer pages and embedded reports share the same subset definitions, and articles avoid the full TTF download', () => {
  assert.equal(fs.readFileSync('app/font-faces.css', 'utf8').replaceAll('\r\n', '\n'), fontFaces);
  const document = reportDocument('<html><head></head><body>字体测试</body></html>');
  assert.ok(document.includes(fontFaces));
  assert.ok(!document.includes('OPlusSans3-Regular.ttf'));
  for (const slug of ['vllm-dynamic-classroom', 'ascend-nvidia-comparison']) {
    const used = new Set([...fs.readFileSync(`content/${slug}.html`, 'utf8')].map(char => char.codePointAt(0)));
    const needed = manifest.subsets.filter(entry => codepoints(entry.unicodeRange).some(point => used.has(point)));
    const bytes = needed.reduce((sum, entry) => sum + entry.bytes, 0);
    assert.ok(bytes < 400000, `${slug} needs too many font bytes: ${bytes}`);
    assert.ok(needed.length < manifest.subsets.length / 4);
  }
});
