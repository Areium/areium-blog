import { database } from '../lib/db.js';
const [action = 'list', id] = process.argv.slice(2); const db = database();
if (action === 'list') console.table(db.prepare("SELECT id,slug,login,body,status,created_at FROM comments WHERE status='pending' ORDER BY id DESC LIMIT 100").all());
else if (['approve', 'reject'].includes(action) && /^\d+$/.test(id || '')) { const result = db.prepare('UPDATE comments SET status=? WHERE id=?').run(action === 'approve' ? 'approved' : 'rejected', Number(id)); console.log(`Updated ${result.changes} comment(s).`); }
else { console.error('Usage: pnpm comments [list|approve ID|reject ID]'); process.exitCode = 1; }
db.close();
