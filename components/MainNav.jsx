'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { setupHeaderHover } from '../public/header-hover';
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
  useEffect(() => setupHeaderHover(document.querySelector('.header')), [pathname]);
  const [hovered, setHovered] = useState(null);
  const active = items.findIndex(({ href }) => href === '/' ? pathname === '/' : pathname === href || pathname?.startsWith(href + '/'));

  return <nav className="site-nav" aria-label="主导航" onPointerLeave={() => setHovered(null)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(null); }} style={{ '--active-index': Math.max(0, active), '--hover-index': hovered ?? Math.max(0, active) }}>
    <span className="nav-preview" aria-hidden="true" style={{ opacity: hovered !== null && hovered !== active ? 1 : 0 }}/>
    <span className="nav-indicator" aria-hidden="true" style={{ opacity: active < 0 ? 0 : 1 }}/>
    {items.map(({ href, label, Icon }, index) => <Link key={href} href={href} onPointerEnter={() => setHovered(index)} onFocus={() => setHovered(index)} aria-current={index === active ? 'page' : undefined}><Icon size={16} aria-hidden="true"/><span>{label}</span></Link>)}
  </nav>;
}
