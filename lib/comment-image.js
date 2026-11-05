import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function prepareCommentImage(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error('请选择不超过 5 MB 的图片。');
  }
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(input, { limitInputPixels: 16000000, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) {
      throw new Error('Unsupported format');
    }
    return await image.rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new Error('图片无法读取，请选择有效的 JPG、PNG、WebP 或 GIF 图片（最多 1600 万像素）。');
  }
}
