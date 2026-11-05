import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
let db;
export function database() { if (db) return db; const dir = path.resolve(/* turbopackIgnore: true */ process.env.BLOG_DATA_DIR || './data'); fs.mkdirSync(dir, { recursive: true }); db = new DatabaseSync(path.join(dir, 'comments.sqlite')); db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL, github_id INTEGER NOT NULL, login TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, created_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS comments_post_status ON comments(slug,status);
CREATE INDEX IF NOT EXISTS comments_user_time ON comments(github_id,created_ms);`); return db; }
export function listComments(slug) { return database().prepare("SELECT id,login,name,body,created_at FROM comments WHERE slug=? AND status='approved' ORDER BY id DESC LIMIT 100").all(slug); }
export function addComment(slug, user, body) { if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000) return { error: '评论需要 1–2000 个字符。', status: 400 }; const connection = database(); connection.exec('BEGIN IMMEDIATE'); try { const previous = connection.prepare('SELECT created_ms FROM comments WHERE github_id=? ORDER BY created_ms DESC LIMIT 1').get(user.id); if (previous && Date.now() - previous.created_ms < 60000) { connection.exec('ROLLBACK'); return { error: '评论太快了，请一分钟后再试。', status: 429 }; } const now = Date.now(); connection.prepare('INSERT INTO comments(slug,github_id,login,name,body,created_at,created_ms) VALUES(?,?,?,?,?,?,?)').run(slug, user.id, user.login, user.name, body.trim(), new Date(now).toISOString(), now); connection.exec('COMMIT'); return { ok: true }; } catch (error) { connection.exec('ROLLBACK'); throw error; } }
