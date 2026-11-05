'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransition() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const content = document.querySelector('main');
    if (!content?.animate) return;
    const animation = content.animate([
      { opacity: .3, transform: 'translateY(9px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' });
    return () => animation.cancel();
  }, [pathname]);
  return null;
}
