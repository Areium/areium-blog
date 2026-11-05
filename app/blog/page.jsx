import BlogIndex from '../../components/BlogIndex';
import { posts } from '../../lib/content';
export const metadata = { title: '文章与记录' };
export default async function Blog({ searchParams }) {
  const params = await searchParams;
  const tag = typeof params.tag === 'string' ? params.tag : '';
  return <div className="shell inner"><div className="page-heading"><span className="eyebrow">NOTES & THOUGHTS</span><h1>写下来，才会留下来。</h1><p>关于技术、实践与生活的记录。按分类或标签，找到你感兴趣的内容。</p></div><BlogIndex key={tag} posts={posts} initialTag={tag}/></div>;
}
