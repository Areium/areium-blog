import fs from 'node:fs';
import path from 'node:path';
import postIndex from '../content/posts.json';

export const site = { name: 'Areium', subtitle: 'NOTES & EXPLORATIONS', description: '记录技术探索，收藏生活里的灵感。' };
export const posts = postIndex;
export const projects = [
  { slug: 'json-workbench', name: 'JSON 工作台', en: 'JSON WORKBENCH', description: '让杂乱的数据变得清晰。一个轻巧的 JSON 格式化与校验工具。', tags: ['React', '开发工具'], type: 'json', status: '可体验', detail: '粘贴 JSON 后点击格式化，快速检查数据结构。内容只在你的浏览器内处理。' },
  { slug: 'focus-clock', name: '专注时钟', en: 'FOCUS CLOCK', description: '留出一小段不被打扰的时间，专注完成眼前的一件事。', tags: ['React', '效率工具'], type: 'clock', status: '可体验', detail: '一个 25 分钟专注计时器。支持暂停与重置，保持页面打开即可使用。' },
  { slug: 'fieldnotes', name: 'Areium', en: 'FIELDNOTES BLOG', description: '你正在浏览的这个地方。文章、作品与想法，都在这里生长。', tags: ['Next.js', 'SQLite'], type: 'blog', status: '本站模板', detail: '基于 React 和 Next.js 的个人博客模板，包含 Markdown 文章、项目展示与审核式评论。示例文章和身份文案可以在本地替换。' },
];
export function getPost(slug) { const post = posts.find(p => p.slug === slug); return post ? { ...post, content: fs.readFileSync(path.join(process.cwd(), 'content', `${slug}.${post.format === 'html' ? 'html' : 'md'}`), 'utf8') } : null; }
export function headingId(text) { return String(text).trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-'); }
