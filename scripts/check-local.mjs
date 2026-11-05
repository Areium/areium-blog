import assert from 'node:assert/strict';
const root = 'http://localhost:3000';
for (const [url, status] of [['/', 200], ['/blog', 200], ['/blog/inside-vllm-zh', 200], ['/projects/focus-clock', 200], ['/api/auth/github', 503], ['/missing', 404]]) {
  const response = await fetch(root + url, { redirect: 'manual' });
  assert.equal(response.status, status, url);
}
const session = await fetch(root + '/api/auth/session').then(r => r.json());
assert.equal(session.user, null);
assert.equal(session.configured, false);
let result = await fetch(root + '/api/comments', { method: 'POST', headers: { Origin: root, 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'inside-vllm-zh', body: 'Unauthorized test' }) });
assert.equal(result.status, 401);
result = await fetch(root + '/api/comments', { method: 'POST', headers: { Origin: 'https://invalid.example' }, body: '{}' });
assert.equal(result.status, 403);
result = await fetch(root + '/api/comments?slug=missing');
assert.equal(result.status, 404);
console.log('Local routes, OAuth configuration state, unauthenticated comments, and origin checks passed.');
