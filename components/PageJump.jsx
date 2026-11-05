'use client';

import { ArrowUpToLine, ArrowDownToLine } from 'lucide-react';

export default function PageJump() {
  function jump(toBottom) {
    window.scrollTo({
      top: toBottom ? document.documentElement.scrollHeight : 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  return <nav className="page-jump" aria-label="页面快捷跳转">
    <button type="button" onClick={() => jump(false)} aria-label="回到顶部" title="回到顶部"><ArrowUpToLine size={19}/><span>顶部</span></button>
    <button type="button" onClick={() => jump(true)} aria-label="跳到底部" title="跳到底部"><ArrowDownToLine size={19}/><span>底部</span></button>
  </nav>;
}
