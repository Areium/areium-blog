import Link from 'next/link';
import { ArrowUpRight, Terminal } from 'lucide-react';
import { site } from '../lib/content';
import profile from '../content/profile.json';
import ThemeToggle from '../components/ThemeToggle';
import AsciiEasterEggProvider from '../components/AsciiEasterEggProvider';
import PageJump from '../components/PageJump';
import MainNav from '../components/MainNav';
import PageTransition from '../components/PageTransition';
import './globals.css';
import './redesign.css';
import './theme.css';
import './fonts.css';
import './navigation.css';
import './interests.css';
import './projects.css';
import './hero.css';

export const metadata = { metadataBase: new URL(process.env.SITE_URL || 'http://localhost:3000'), title: { default: `${site.name} · 记录与探索`, template: `%s · ${site.name}` }, description: site.description };
export default function Layout({ children }) {
  return <html lang="zh-CN" data-scroll-behavior="smooth" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: `(function(){var t;try{t=localStorage.getItem('areium-theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})()`}}/></head><body><AsciiEasterEggProvider>
    <header className="header"><div className="shell nav"><Link className="brand" href="/"><span className="brand-mark"><Terminal size={21}/></span><span>{site.name}<small>{site.subtitle}</small></span></Link><MainNav/><div className="nav-actions"><a className="nav-note" href={profile.github} target="_blank" rel="noreferrer">GitHub / Areium <ArrowUpRight size={15}/></a><ThemeToggle/></div></div></header>
    <div className="page-content"><main>{children}</main>
    <footer className="shell footer"><div><b>{site.name}</b><p>保持好奇，持续记录。</p></div><span>© {new Date().getFullYear()} Areium · 用代码与文字记录生活</span><nav className="footer-links" aria-label="页脚导航"><Link href="/friends">友情链接</Link><Link href="/about">关于我 ↗</Link></nav></footer>
    </div><PageJump/>
    <PageTransition/>
  </AsciiEasterEggProvider></body></html>;
}
