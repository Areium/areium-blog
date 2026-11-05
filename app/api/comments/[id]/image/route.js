import { commentImage } from '../../../../../lib/db';
export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { id } = await params;
  if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) return new Response(null, { status: 404 });
  const image = commentImage(Number(id));
  if (!image) return new Response(null, { status: 404 });
  return new Response(image, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(image.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
