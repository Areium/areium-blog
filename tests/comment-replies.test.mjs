import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('replies stay in their article and thread, retain old roots, and respect moderation', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'blog-replies-'));
  process.env.BLOG_DATA_DIR = directory;
  const { database, addComment, listComments, commentImage } = await import('../lib/db.js');
  let userId = 1;
  const user = () => ({ id: userId++, login: 'example', name: 'Example' });
  try {
    const root = addComment('post', user(), 'Root').comment;
    assert.equal(root.thread_id, null);
    const reply = addComment('post', user(), 'Reply 😊', null, root.id).comment;
    assert.equal(reply.thread_id, root.id);
    assert.equal(reply.reply_to_id, root.id);
    assert.equal(reply.reply_to_login, root.login);
    const nested = addComment('post', user(), 'Reply to reply', Buffer.from('image'), reply.id).comment;
    assert.equal(nested.thread_id, root.id);
    assert.equal(nested.reply_to_id, reply.id);
    assert.deepEqual(listComments('post'), [nested, reply, root]);
    assert.equal(addComment('other', user(), 'Wrong article', null, root.id).status, 404);
    assert.equal(addComment('post', user(), 'Missing', null, 999999).status, 404);
    for (const invalid of [0, -1, 1.5, '1', NaN]) {
      assert.equal(addComment('post', user(), 'Invalid', null, invalid).status, 400);
    }
    const count = database().prepare('SELECT COUNT(*) AS count FROM comments').get().count;
    assert.throws(() => addComment('post', user(), 'Rollback', {}, root.id));
    assert.equal(database().prepare('SELECT COUNT(*) AS count FROM comments').get().count, count);
    database().prepare("UPDATE comments SET status='rejected' WHERE id=?").run(reply.id);
    assert.equal(addComment('post', user(), 'Hidden target', null, reply.id).status, 404);
    assert.equal(listComments('post').find(c => c.id === nested.id).reply_to_login, null);
    for (let index = 0; index < 101; index++) addComment('post', user(), 'New thread');
    const latest = addComment('post', user(), 'Revive old discussion', null, root.id).comment;
    const listed = listComments('post');
    assert.ok(listed.some(c => c.id === latest.id));
    assert.ok(listed.some(c => c.id === root.id));
    database().prepare("UPDATE comments SET status='rejected' WHERE id=?").run(root.id);
    assert.ok(listComments('post').every(c => c.thread_id !== root.id && c.id !== root.id));
    assert.equal(commentImage(nested.id), undefined);
    assert.equal(addComment('post', user(), 'Hidden thread', null, nested.id).status, 404);
  } finally {
    database().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
