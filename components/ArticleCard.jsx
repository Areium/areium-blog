import Link from 'next/link';
import { ArrowUpRight, Clock3 } from 'lucide-react';

export default function ArticleCard({ post }) {
  return <article className="post-card">
    <Link className="post-card-cover" href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true">
      <img src={post.cover} alt="" loading="lazy" width="800" height="450"/>
      <span className="cover-label">{post.repost ? '好文搬运' : post.example ? '示例文章' : post.category}</span>
    </Link>
    <div className="post-card-body">
      <div className="article-meta"><span>{post.category}</span><time dateTime={post.date}>{post.dateLabel ? post.dateLabel + ' ' : ''}{post.date.replaceAll('-', '.')}</time></div>
      <h3><Link href={`/blog/${post.slug}`}>{post.title}<ArrowUpRight size={17}/></Link></h3>
      <p>{post.description}</p>
      <div className="post-card-tags">{post.tags.map(tag => <Link className={tag === '好文搬运' ? 'repost-tag' : ''} key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`}># {tag}</Link>)}</div>
      <div className="post-card-bottom"><span>{post.repost ? '转载 · ' + post.author : 'Areium'}</span><span><Clock3 size={12}/>{post.minutes} 分钟阅读</span></div>
    </div>
  </article>;
}
