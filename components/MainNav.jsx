'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Boxes, Link2, UserRound } from 'lucide-react';

const items = [
  { href: '/', label: '首页', Icon: Home },
  { href: '/blog', label: '文章', Icon: BookOpen },
  { href: '/projects', label: '作品', Icon: Boxes },
  { href: '/friends', label: '友链', Icon: Link2 },
  { href: '/about', label: '关于', Icon: UserRound },
];

export default function MainNav() {
  const pathname = usePathname();
  const active = items.findIndex(({ href }) => href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(href + '/'));

  return <nav className="site-nav" aria-label="主导航" style={{ '--active-index': Math.max(0, active) }}>
    <span className="nav-indicator" aria-hidden="true" style={{ opacity: active < 0 ? 0 : 1 }}/>
    {items.map(({ href, label, Icon }, index) => <Link key={href} href={href} aria-current={index === active ? 'page' : undefined}><Icon size={16} aria-hidden="true"/><span>{label}</span></Link>)}
  </nav>;
}
