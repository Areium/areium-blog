import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sign, verify, sameOrigin, getUser } from '../lib/auth.js';
process.env.AUTH_SECRET = 'test-only-secret-'.repeat(4);
test('signed session rejects tampering, expiry, and OAuth state as a session', () => { const token = sign({ kind: 'session', user: { id: 42, login: 'example' }, exp: Date.now() + 60000 }); assert.equal(verify(token).user.id, 42); assert.equal(verify(token + 'x'), null); assert.equal(verify(sign({ exp: 1 })), null); assert.equal(verify('invalid'), null); assert.equal(getUser({ cookies: { get: () => ({ value: sign({ kind: 'oauth', exp: Date.now() + 60000 }) }) } }), null); });
test('mutation origin must match configured site', () => { process.env.SITE_URL = 'http://localhost:3000'; assert.equal(sameOrigin(new Request('http://localhost:3000', { headers: { Origin: 'https://attacker.example' } })), false); assert.equal(sameOrigin(new Request('http://localhost:3000', { headers: { Origin: 'http://localhost:3000' } })), true); });
test('new comments publish immediately while old pending and rejected comments stay hidden', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'fieldnotes-test-'));
  process.env.BLOG_DATA_DIR = directory;
  const { database, addComment, listComments } = await import('../lib/db.js');
  const user = { id: 1, login: 'example', name: 'Example' };
  const slug = 'react-state';
  try {
    const oldComment = database().prepare(`
      INSERT INTO comments(slug,github_id,login,name,body,status,created_at,created_ms)
      VALUES(?,2,'old','Old','Old comment',?,'2026-01-01T00:00:00.000Z',0)
    `);
    oldComment.run(slug, 'pending');
    oldComment.run(slug, 'rejected');
    assert.equal(addComment(slug, user, '   ').status, 400);
    assert.equal(addComment(slug, user, 'x'.repeat(2001)).status, 400);
    const body = "<script>alert('x')</script>";
    const result = addComment(slug, user, body);
    assert.equal(result.ok, true);
    assert.deepEqual(listComments(slug), [result.comment]);
    assert.equal(result.comment.body, body);
    assert.equal(result.comment.github_id, undefined);
    assert.equal(addComment(slug, user, 'again').status, 429);
    assert.deepEqual(listComments('other-post'), []);
  } finally {
    database().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
