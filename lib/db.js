import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
let db;
export function database() { if (db) return db; const dir = path.resolve(/* turbopackIgnore: true */ process.env.BLOG_DATA_DIR || './data'); fs.mkdirSync(dir, { recursive: true }); db = new DatabaseSync(path.join(dir, 'comments.sqlite')); db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, github_id INTEGER NOT NULL, login TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, created_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS comments_post_status ON comments(slug,status);
CREATE INDEX IF NOT EXISTS comments_user_time ON comments(github_id,created_ms);
CREATE TABLE IF NOT EXISTS comment_images (comment_id INTEGER PRIMARY KEY REFERENCES comments(id), data BLOB NOT NULL);`); return db; }
export function listComments(slug) {
  return database().prepare(`SELECT c.id,c.login,c.name,c.body,c.created_at,
    CASE WHEN i.comment_id IS NOT NULL THEN '/api/comments/' || c.id || '/image' ELSE NULL END AS image_url
    FROM comments c LEFT JOIN comment_images i ON i.comment_id=c.id
    WHERE c.slug=? AND c.status='approved' ORDER BY c.id DESC LIMIT 100`).all(slug);
}
export function commentImage(id) {
  return database().prepare("SELECT i.data FROM comment_images i JOIN comments c ON c.id=i.comment_id WHERE c.id=? AND c.status='approved'").get(id)?.data;
}
export function addComment(slug, user, body, image = null) {
  if (typeof body !== 'string' || (!body.trim() && !image) || body.trim().length > 2000) return { error: '请填写评论或选择图片，文字最多 2000 字。', status: 400 };
  const connection = database();
  connection.exec('BEGIN IMMEDIATE');
  try {
    const previous = connection.prepare('SELECT created_ms FROM comments WHERE github_id=? ORDER BY created_ms DESC LIMIT 1').get(user.id);
    if (previous && Date.now() - previous.created_ms < 60000) {
      connection.exec('ROLLBACK');
      return { error: '评论太快了，请一分钟后再试。', status: 429 };
    }
    const now = Date.now();
    const comment = connection.prepare(`
      INSERT INTO comments(slug,github_id,login,name,body,status,created_at,created_ms)
      VALUES(?,?,?,?,?,'approved',?,?)
      RETURNING id,login,name,body,created_at
    `).get(slug, user.id, user.login, user.name, body.trim(), new Date(now).toISOString(), now);
    comment.image_url = null;
    if (image) {
      connection.prepare('INSERT INTO comment_images(comment_id,data) VALUES(?,?)').run(comment.id, image);
      comment.image_url = `/api/comments/${comment.id}/image`;
    }
    connection.exec('COMMIT');
    return { ok: true, comment };
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}
