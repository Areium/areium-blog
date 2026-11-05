import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
let db;
export function database() {
  if (db) return db;
  const dir = path.resolve(/* turbopackIgnore: true */ process.env.BLOG_DATA_DIR || './data');
  fs.mkdirSync(dir, { recursive: true });
  db = new DatabaseSync(path.join(dir, 'comments.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, github_id INTEGER NOT NULL, login TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, created_ms INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_post_status ON comments(slug,status);
    CREATE INDEX IF NOT EXISTS comments_user_time ON comments(github_id,created_ms);
    CREATE TABLE IF NOT EXISTS comment_images (comment_id INTEGER PRIMARY KEY REFERENCES comments(id), data BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS comment_replies (
      comment_id INTEGER PRIMARY KEY REFERENCES comments(id),
      thread_id INTEGER NOT NULL REFERENCES comments(id),
      reply_to_id INTEGER NOT NULL REFERENCES comments(id)
    );
    CREATE INDEX IF NOT EXISTS replies_thread ON comment_replies(thread_id);`);
  return db;
}

const commentSelect = `SELECT c.id,c.login,c.name,c.body,c.created_at,
  CASE WHEN i.comment_id IS NOT NULL THEN '/api/comments/' || c.id || '/image' ELSE NULL END AS image_url,
  r.thread_id,r.reply_to_id,target.name AS reply_to_name,target.login AS reply_to_login
  FROM comments c LEFT JOIN comment_images i ON i.comment_id=c.id
  LEFT JOIN comment_replies r ON r.comment_id=c.id
  LEFT JOIN comments target ON target.id=r.reply_to_id AND target.status='approved'`;

export function listComments(slug) {
  // Include thread roots even when they fall outside the latest 100 comments.
  return database().prepare(`WITH recent AS (
    SELECT c.id,r.thread_id FROM comments c
    LEFT JOIN comment_replies r ON r.comment_id=c.id
    LEFT JOIN comments root ON root.id=r.thread_id
    WHERE c.slug=? AND c.status='approved' AND (r.thread_id IS NULL OR root.status='approved')
    ORDER BY c.id DESC LIMIT 100
  ), visible AS (SELECT id FROM recent UNION SELECT thread_id FROM recent WHERE thread_id IS NOT NULL)
  ${commentSelect} WHERE c.id IN (SELECT id FROM visible) ORDER BY c.id DESC`).all(slug);
}

export function commentImage(id) {
  return database().prepare(`SELECT i.data FROM comment_images i
    JOIN comments c ON c.id=i.comment_id
    LEFT JOIN comment_replies r ON r.comment_id=c.id
    LEFT JOIN comments root ON root.id=r.thread_id
    WHERE c.id=? AND c.status='approved' AND (r.thread_id IS NULL OR root.status='approved')`).get(id)?.data;
}

export function addComment(slug, user, body, image = null, replyToId = null) {
  if (typeof body !== 'string' || (!body.trim() && !image) || body.trim().length > 2000) return { error: '请填写评论或选择图片，文字最多 2000 字。', status: 400 };
  if (replyToId !== null && (!Number.isSafeInteger(replyToId) || replyToId < 1)) return { error: '回复对象无效。', status: 400 };
  const connection = database();
  connection.exec('BEGIN IMMEDIATE');
  try {
    let target;
    if (replyToId !== null) {
      target = connection.prepare(`SELECT c.id,COALESCE(r.thread_id,c.id) AS thread_id
        FROM comments c LEFT JOIN comment_replies r ON r.comment_id=c.id
        LEFT JOIN comments root ON root.id=r.thread_id
        WHERE c.id=? AND c.slug=? AND c.status='approved'
        AND (r.thread_id IS NULL OR root.status='approved')`).get(replyToId, slug);
      if (!target) {
        connection.exec('ROLLBACK');
        return { error: '这条评论已不可回复，请刷新后重试。', status: 404 };
      }
    }
    const previous = connection.prepare('SELECT created_ms FROM comments WHERE github_id=? ORDER BY created_ms DESC LIMIT 1').get(user.id);
    if (previous && Date.now() - previous.created_ms < 60000) {
      connection.exec('ROLLBACK');
      return { error: '评论太快了，请一分钟后再试。', status: 429 };
    }
    const now = Date.now();
    const { id } = connection.prepare(`
      INSERT INTO comments(slug,github_id,login,name,body,status,created_at,created_ms)
      VALUES(?,?,?,?,?,'approved',?,?) RETURNING id
    `).get(slug, user.id, user.login, user.name, body.trim(), new Date(now).toISOString(), now);
    if (image) connection.prepare('INSERT INTO comment_images(comment_id,data) VALUES(?,?)').run(id, image);
    if (target) connection.prepare('INSERT INTO comment_replies(comment_id,thread_id,reply_to_id) VALUES(?,?,?)').run(id, target.thread_id, target.id);
    const comment = connection.prepare(`${commentSelect} WHERE c.id=?`).get(id);
    connection.exec('COMMIT');
    return { ok: true, comment };
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}
