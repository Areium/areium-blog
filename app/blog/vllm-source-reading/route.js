import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  const html = await fs.readFile(path.join(process.cwd(), 'content/vllm-source-reading.html'), 'utf8');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
