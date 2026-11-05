import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { reportDocument } from '../lib/report-document.js';
import { withReportTheme } from '../lib/report-theme.js';

for (const slug of ['vllm-dynamic-classroom', 'ascend-nvidia-comparison']) {
  test(`${slug}: the initial document is themed before its body or report scripts run`, () => {
    const original = fs.readFileSync(`content/${slug}.html`, 'utf8');
    for (const theme of ['dark', 'light']) {
      const html = withReportTheme(reportDocument(original), theme);
      const headEnd = html.indexOf('</head>');
      assert.match(html.slice(0, html.indexOf('<head>')), new RegExp(`data-theme="${theme}"`));
      assert.ok(html.indexOf('html[data-theme=dark]') < headEnd);
      assert.ok(html.indexOf('data-areium-theme') < headEnd);
      assert.ok(headEnd < html.indexOf('<body'));
      assert.match(html, /font-src http: https:/);
    }
  });
}

test('theme handshake handles messages before body/load, rejects unrelated messages, and supports toggles', () => {
  const html = reportDocument('<html><head></head><body></body></html>');
  const script = html.match(/<script data-areium-theme>([\s\S]*?)<\/script>/)[1];
  const listeners = new Map();
  const messages = [];
  const notifications = [];
  const parent = { postMessage: data => messages.push(data.type) };
  const document = { documentElement: { dataset: { theme: 'dark' } } }; // No body exists yet.
  vm.runInNewContext(script, {
    parent, document, Event,
    window: {
      addEventListener: (type, listener) => listeners.set(type, listener),
      dispatchEvent: event => notifications.push(event.type),
    },
  });
  assert.deepEqual(messages, ['areium-report-ready']);
  const receive = listeners.get('message');
  receive({ source: {}, data: { type: 'areium-theme', theme: 'light' } });
  receive({ source: parent, data: { type: 'areium-theme', theme: 'invalid' } });
  assert.equal(document.documentElement.dataset.theme, 'dark');
  for (const theme of ['light', 'dark']) {
    receive({ source: parent, data: { type: 'areium-theme', theme } });
    assert.equal(document.documentElement.dataset.theme, theme);
  }
  assert.deepEqual(notifications, ['areium-report-theme', 'areium-report-theme']);
});

test('initial theme replaces stale attributes and preserves language', () => {
  const html = withReportTheme('<html lang="zh-CN" data-theme="light"><head></head></html>', 'dark');
  assert.match(html, /lang="zh-CN"/);
  assert.equal((html.match(/data-theme=/g) || []).length, 1);
  assert.match(html, /data-theme="dark"/);
});
