'use client';

import { ArrowUpToLine, ArrowDownToLine } from 'lucide-react';

export default function PageJump({ article = false }) {
  function jump(toBottom) {
    window.scrollTo({
      top: toBottom ? document.documentElement.scrollHeight : 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  return <nav className={`page-jump${article ? ' page-jump-article' : ' page-jump-global'}`} aria-label="页面快捷跳转">
    <button type="button" onClick={() => jump(false)} aria-label="回到顶部" title="回到顶部"><ArrowUpToLine size={22} aria-hidden="true"/></button>
    <button type="button" onClick={() => jump(true)} aria-label="跳到底部" title="跳到底部"><ArrowDownToLine size={22} aria-hidden="true"/></button>
  </nav>;
}
