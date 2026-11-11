import fs from 'node:fs/promises';
import path from 'node:path';

export async function GET(request, { params }) {
  const { chapter } = await params;
  if (!/^chapter-\d{2}-[a-z]+\.html$/.test(chapter)) return new Response('Not found', { status: 404 });
  try {
    const html = await fs.readFile(path.join(process.cwd(), 'content/vllm-source-reading', chapter), 'utf8');
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    if (error.code === 'ENOENT') return new Response('Not found', { status: 404 });
    throw error;
  }
}
