import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Code2, BookOpen, Sparkles } from 'lucide-react';
import { posts } from '../lib/content';
import ArticleCard from '../components/ArticleCard';
import ProfilePanel from '../components/ProfilePanel';

export default function Home() {
  return <div className="shell">
    <section className="hero areium-hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="green-dot"/> AREIUM'S PERSONAL SPACE</div>
        <h1>在代码里探索，<br/>在文字里<span className="accent">相遇<span className="underline"/></span>。</h1>
        <p>你好，我是 Areium。<br/>这里有我的技术调研、开发手记，和一些关于生活的想象。</p>
        <div className="hero-actions"><Link className="button primary" href="/blog">阅读文章 <ArrowRight size={17}/></Link><Link className="button secondary" href="/about">关于我 <ArrowUpRight size={17}/></Link></div>
        <div className="hero-bottom"><span><Code2 size={14}/> 技术探索</span><span><BookOpen size={14}/> 文字创作</span><span><Sparkles size={14}/> 保持好奇</span></div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <span className="floating plus">+</span><span className="floating asterisk">✳</span>
        <div className="editor"><div className="editor-top"><span className="window-dots">● ● ●</span><span>areium.notes</span><span>↗</span></div>
          <div className="editor-code">
            <div><label>01</label><span className="code-muted">// 给好奇心留一个位置</span></div>
            <div><label>02</label><span><b>const</b> notebook = {'{'}</span></div>
            <div><label>03</label><span>  author: <i>'Areium'</i>,</span></div>
            <div><label>04</label><span>  interests: [<i>'Code'</i>, <i>'Stories'</i>],</span></div>
            <div><label>05</label><span>  curiosity: <em>Infinity</em>,</span></div>
            <div><label>06</label><span>{'};'}</span></div><div><label>07</label></div>
            <div><label>08</label><span><em>explore</em>();</span></div>
            <div><label>09</label><span><em>write</em>();</span></div>
            <div><label>10</label><span><em>share</em>();</span></div>
          </div>
          <div className="editor-bottom"><span>Always a work in progress</span><span>UTF-8</span></div>
        </div>
        <div className="build-label"><span className="green-dot"/> 把值得记住的，慢慢写下来 <span>↗</span></div>
      </div>
    </section>
    <section className="section">
      <div className="section-heading"><div><span className="eyebrow">LATEST WRITING</span><h2>最近的记录</h2></div><Link href="/blog">全部文章 <ArrowRight size={16}/></Link></div>
      <div className="home-reading"><div className="post-card-grid">{posts.map(post => <ArticleCard key={post.slug} post={post}/>)}</div><ProfilePanel posts={posts}/></div>
    </section>
  </div>;
}
