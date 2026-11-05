import { notFound } from 'next/navigation';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { getPost, headingId } from '../../../lib/content';
import Comments from '../../../components/Comments';
import HtmlReport from '../../../components/HtmlReport';
import { reportDocument } from '../../../lib/report-document';
import referenceAnchors from '../../../lib/reference-anchors';


export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  return { title: post?.title || '文章不存在', description: post?.description };
}
export default async function Post({ params }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const isReport = post.format === 'html';
  const headings = isReport ? [] : [...post.content.matchAll(/^## (.+)$/gm)].map(match => match[1]);
  return <div className="shell inner">
    <Link href="/blog" className="back">← 全部文章</Link>
    <header className="post-header">
      <div className="article-meta"><span>{post.category}</span><time dateTime={post.date}>{post.dateLabel ? post.dateLabel + ' ' : ''}{post.date}</time><span>{post.minutes} 分钟阅读</span></div>
      <h1>{post.title}</h1><p>{post.description}</p>
      <div className="post-card-tags">{post.tags.map(tag => <Link className={tag === '好文搬运' ? 'repost-tag' : ''} key={tag} href={'/blog?tag=' + encodeURIComponent(tag)}># {tag}</Link>)}</div>
      {post.example && <span className="demo-note">示例文章 · 用于展示阅读体验</span>}
      {post.repost && <div className="attribution">好文搬运 · 原作者 {post.author} · 原文发表于 {post.originalDate}<br/><a href={post.sourceUrl} target="_blank" rel="noreferrer">阅读原文 ↗</a><span>本页收录你提供的中文译稿，原文署名与参考资料保留。</span></div>}
    </header>
    <img className="article-cover" src={post.cover} alt={post.coverAlt || post.title + '文章封面'} width="800" height="450"/>
    {isReport ? <>
      <HtmlReport html={reportDocument(post.content)} title={post.title + '互动正文'}/>
      <div className="report-comments"><Comments slug={slug}/></div>
    </> : <div className="reading-layout"><div>
      <article className="prose"><Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight, referenceAnchors]} components={{ h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>, img: ({node, ...props}) => <img {...props} loading="lazy"/> }}>{post.content}</Markdown></article>
      <Comments slug={slug}/>
    </div><aside className="reading-sidebar"><div className="toc"><span className="eyebrow">本文目录</span>{headings.map(heading => <a key={heading} href={'#' + headingId(heading)}>{heading}</a>)}<div className="toc-note">读到这里，有什么想法？<br/>欢迎在文末交流。</div></div></aside></div>}
  </div>;
}
