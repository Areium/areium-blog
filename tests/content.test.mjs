import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import referenceAnchors from '../lib/reference-anchors.js';

const read = file => fs.readFileSync(file, 'utf8');
const decode = text => text.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
test('novel migration preserves every paragraph and all eight chapter headings', () => {
  const source = read('content/imports/bian-shuangsheng-source.html');
  const marker = /<div class="post-body"[^>]*>/g.exec(source);
  assert.ok(marker);
  const start = marker.index + marker[0].length;
  let depth = 1, end;
  const divs = /<\/?div\b[^>]*>/g; divs.lastIndex = start;
  for (let match; (match = divs.exec(source));) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (!depth) { end = match.index; break; }
  }
  assert.ok(end);
  const body = source.slice(start, end);
  const imported = read('content/bian-shuangsheng.md');
  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(match => decode(match[1].replace(/<[^>]*>/g, '')).trim());
  let cursor = 0;
  for (const paragraph of paragraphs) {
    const index = imported.indexOf(paragraph, cursor);
    assert.ok(index >= cursor, 'A paragraph is missing or out of order');
    cursor = index + paragraph.length;
  }
  assert.equal([...body.matchAll(/<h2\b/g)].length, 8);
  assert.equal([...imported.matchAll(/^## /gm)].length, 8);
});

test('every indexed article has content, a cover, and configurable tags', () => {
  const posts = JSON.parse(read('content/posts.json'));
  assert.equal(new Set(posts.map(post => post.slug)).size, posts.length);
  for (const post of posts) {
    assert.ok(post.tags.length);
    assert.ok(post.category);
    assert.ok(fs.existsSync(`public${post.cover}`));
    assert.ok(fs.existsSync(`content/${post.slug}.${post.format === 'html' ? 'html' : 'md'}`));
  }
  const report = read('content/ascend-nvidia-comparison.html');
  assert.equal([...report.matchAll(/<li id="s\d+"/g)].length, 27);
  assert.ok(report.includes('color-scheme:light'));
  assert.ok(report.includes('areium-report-height'));
});

test('Chinese translation retains the supplied content and all 18 local illustrations', () => {
  const original = read('content/imports/inside-vllm-original.md').replace(/^# [^\r\n]+\r?\n/, '').trimStart();
  const imported = read('content/inside-vllm-zh.md');
  const normalized = imported.replaceAll('/images/inside-vllm/', 'https://vllm.ai/blog-assets/figures/2025-vllm-anatomy/');
  assert.equal(normalized, original);
  const images = [...imported.matchAll(/!\[[^\]]*\]\((\/images\/inside-vllm\/[^)]+)\)/g)];
  assert.equal(images.length, 18);
  for (const image of images) assert.ok(fs.statSync('public' + image[1]).size > 100);
});

test('published index contains real posts and preserves repost attribution', () => {
  const posts = JSON.parse(read('content/posts.json'));
  assert.ok(posts.length >= 4);
  assert.ok(posts.every(post => !post.example && !post.sourceUrl?.includes('areium.github.io')));
  const repost = posts.find(post => post.slug === 'inside-vllm-zh');
  assert.equal(repost.author, 'Aleksa Gordic');
  assert.ok(repost.tags.includes('好文搬运'));
  assert.ok(repost.sourceUrl.startsWith('https://vllm.ai/'));
});

test('bibliography anchors work without enabling arbitrary raw HTML', () => {
  const html = renderToStaticMarkup(React.createElement(Markdown, { rehypePlugins: [referenceAnchors] }, '1. <a id="ref-1"></a>[vLLM](https://github.com/vllm-project/vllm)\n\n<script>alert(1)</script>'));
  assert.ok(html.includes('id="ref-1"'));
  assert.ok(!html.includes('<script>'));
});
