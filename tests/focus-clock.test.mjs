import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transformSync } from 'next/dist/build/swc/index.js';

const require = createRequire(import.meta.url);
const { code } = transformSync(fs.readFileSync('components/FocusClock.jsx', 'utf8'), {
  filename: 'FocusClock.jsx',
  jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
  module: { type: 'commonjs' },
});

function clock() {
  const state = [], effects = [], intervals = new Map(), listeners = new Map(), alerts = [];
  let cursor = 0, now = 1000, nextTimer = 0, tree;
  const pending = [];
  const react = {
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!effects[index] || deps.some((value, i) => value !== effects[index].deps[i])) {
        pending.push(() => {
          effects[index]?.cleanup?.();
          effects[index] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const events = {
    addEventListener: (event, callback) => listeners.set(event, callback),
    removeEventListener: (event, callback) => { if (listeners.get(event) === callback) listeners.delete(event); },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: name => name === 'react' ? react : require(name),
    Date: class extends Date { static now() { return now; } },
    setInterval: callback => { intervals.set(++nextTimer, callback); return nextTimer; },
    clearInterval: id => intervals.delete(id),
    document: events, window: { ...events, alert: message => alerts.push(message) },
  });
  function render() {
    cursor = 0;
    tree = exports.default();
    while (pending.length) pending.shift()();
  }
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) return node;
    for (const child of [node.props?.children].flat(Infinity)) {
      if (child === undefined) continue;
      const result = find(predicate, child);
      if (result) return result;
    }
  }
  render();
  return {
    set(id, value) { find(node => node.props?.id === id).props.onChange({ target: { value } }); render(); },
    apply() { find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); render(); },
    click(label) { const button = find(node => node.type === 'button' && [node.props.children].flat().join('') === label); assert.ok(button, label); button.props.onClick(); render(); },
    display: () => find(node => node.props?.role === 'timer').props.children,
    status: () => find(node => node.props?.role === 'status').props.children,
    advance(ms, event) { now += ms; if (event) listeners.get(event)?.(); else for (const callback of [...intervals.values()]) callback(); render(); },
    elapse(ms) { now += ms; },
    intervals,
    alerts,
  };
}

test('custom duration, precise pause, resume, completion, restart and reset work together', () => {
  const timer = clock();
  timer.set('focus-minutes', '0');
  timer.set('focus-seconds', '5');
  timer.apply();
  assert.equal(timer.display(), '00:05');
  timer.click('开始专注');
  timer.elapse(1100);
  timer.click('暂停');
  assert.equal(timer.display(), '00:04');
  assert.equal(timer.intervals.size, 0);
  timer.advance(60000);
  assert.equal(timer.display(), '00:04');
  assert.equal(timer.alerts.length, 0);
  timer.click('继续专注');
  timer.advance(3899);
  assert.equal(timer.display(), '00:01');
  timer.advance(1);
  assert.equal(timer.display(), '00:00');
  assert.match(timer.status(), /专注完成/);
  assert.equal(timer.intervals.size, 0);
  assert.equal(timer.alerts.length, 1);
  assert.match(timer.alerts[0], /专注时间到/);
  timer.advance(1000, 'pageshow');
  assert.equal(timer.alerts.length, 1);
  timer.click('再来一次');
  assert.equal(timer.display(), '00:05');
  timer.click('重置');
  assert.equal(timer.display(), '00:05');
  assert.equal(timer.intervals.size, 0);
  timer.advance(60000);
  assert.equal(timer.alerts.length, 1);
  timer.click('开始专注');
  timer.advance(5000);
  assert.equal(timer.alerts.length, 2);
});

test('duration validation, presets and resuming from a background tab', () => {
  const timer = clock();
  timer.set('focus-minutes', '0');
  timer.set('focus-seconds', '0');
  timer.apply();
  assert.equal(timer.display(), '25:00');
  assert.match(timer.status(), /1 秒到 24 小时/);
  timer.set('focus-minutes', '1440');
  timer.set('focus-seconds', '1');
  timer.apply();
  assert.equal(timer.display(), '25:00');
  timer.set('focus-seconds', '0');
  timer.apply();
  assert.equal(timer.display(), '24:00:00');
  timer.click('5 分钟');
  assert.equal(timer.display(), '05:00');
  timer.click('开始专注');
  timer.advance(301000, 'visibilitychange');
  assert.equal(timer.display(), '00:00');
  assert.equal(timer.intervals.size, 0);
  assert.equal(timer.alerts.length, 1);
});
