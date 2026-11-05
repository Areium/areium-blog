import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { prepareCommentImage, MAX_IMAGE_BYTES } from '../lib/comment-image.js';

test('uploaded images are decoded and normalized; invalid and oversized files fail', async () => {
  const png = await sharp({ create: { width: 1800, height: 10, channels: 4, background: '#ff0000' } }).png().toBuffer();
  const result = await prepareCommentImage(new File([png], 'photo.png', { type: 'image/png' }));
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 1600);
  await assert.rejects(prepareCommentImage(new File(['<svg></svg>'], 'fake.png', { type: 'image/png' })));
  await assert.rejects(prepareCommentImage(new File([png.subarray(0, 20)], 'broken.png')));
  await assert.rejects(prepareCommentImage({ size: MAX_IMAGE_BYTES + 1, arrayBuffer() { throw Error('must not read'); } }));
});

test('legacy databases support image-only comments and hiding also hides their images', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'blog-images-'));
  process.env.BLOG_DATA_DIR = directory;
  const legacy = new DatabaseSync(path.join(directory, 'comments.sqlite'));
  legacy.exec(`CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, github_id INTEGER NOT NULL, login TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, created_ms INTEGER NOT NULL);
    INSERT INTO comments VALUES(1,'post',1,'old','Old','Old text','approved','2026-01-01',0);`);
  legacy.close();
  const { database, addComment, listComments, commentImage } = await import('../lib/db.js');
  try {
    assert.equal(listComments('post')[0].image_url, null);
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).webp().toBuffer();
    const user = { id: 2, login: 'new', name: 'New' };
    const result = addComment('post', user, '', image);
    assert.equal(result.ok, true);
    assert.equal(result.comment.image_url, `/api/comments/${result.comment.id}/image`);
    assert.deepEqual(Buffer.from(commentImage(result.comment.id)), image);
    assert.equal(addComment('post', user, 'again', image).status, 429);
    database().prepare("UPDATE comments SET status='rejected' WHERE id=?").run(result.comment.id);
    assert.equal(commentImage(result.comment.id), undefined);
    assert.equal(listComments('post').length, 1);
    assert.throws(() => addComment('post', { ...user, id: 3 }, 'rollback', {}));
    assert.equal(database().prepare('SELECT COUNT(*) AS count FROM comments').get().count, 2);
    assert.equal(database().prepare('SELECT COUNT(*) AS count FROM comment_images').get().count, 1);
  } finally {
    database().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
