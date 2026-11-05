import { NextResponse } from 'next/server';
import { posts } from '../../../lib/content';
import { listComments, addComment } from '../../../lib/db';
import { getUser, sameOrigin } from '../../../lib/auth';
import { MAX_IMAGE_BYTES, prepareCommentImage } from '../../../lib/comment-image';
export const runtime = 'nodejs';

export async function GET(request) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!posts.some(p => p.slug === slug)) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
  return NextResponse.json({ comments: listComments(slug) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: '来源无效' }, { status: 403 });
  const user = getUser(request);
  if (!user) return NextResponse.json({ error: '请先使用 GitHub 登录。' }, { status: 401 });
  try {
    const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data');
    const limit = multipart ? MAX_IMAGE_BYTES + 65536 : 16384;
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: '请求为空' }, { status: 400 });
    let size = 0;
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        return NextResponse.json({ error: '上传内容过大，图片最多 5 MB。' }, { status: 413 });
      }
      chunks.push(Buffer.from(value));
    }
    const buffer = Buffer.concat(chunks);
    let data;
    let file;
    if (multipart) {
      const form = await new Response(buffer, { headers: { 'Content-Type': request.headers.get('content-type') } }).formData();
      data = { slug: form.get('slug'), body: form.get('body') ?? '' };
      const images = form.getAll('image');
      if (images.length > 1) return NextResponse.json({ error: '每条评论最多上传一张图片。' }, { status: 400 });
      file = images[0];
    } else {
      data = JSON.parse(buffer.toString('utf8'));
    }
    if (!data || !posts.some(p => p.slug === data.slug)) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    if (typeof data.body !== 'string' || data.body.trim().length > 2000) {
      return NextResponse.json({ error: '评论文字最多 2000 字。' }, { status: 400 });
    }
    let image = null;
    if (file) {
      try {
        image = await prepareCommentImage(file);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    const result = addComment(data.slug, user, data.body, image);
    return NextResponse.json(result, { status: result.status || 201 });
  } catch {
    return NextResponse.json({ error: '提交失败，请检查内容后重试。' }, { status: 400 });
  }
}
