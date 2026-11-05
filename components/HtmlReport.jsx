'use client';
import { useEffect, useRef, useState } from 'react';

export default function HtmlReport({ html, title }) {
  const frame = useRef(null);
  const [height, setHeight] = useState(1100);
  const syncTheme = () => frame.current?.contentWindow?.postMessage({ type: 'areium-theme', theme: document.documentElement.dataset.theme || 'light' }, '*');
  useEffect(() => {
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    syncTheme();
    const receive = event => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'areium-report-height' && Number.isFinite(event.data.height)) setHeight(Math.max(500, Math.min(100000, event.data.height)));
      if (event.data?.type === 'areium-report-anchor' && Number.isFinite(event.data.top)) {
        const top = frame.current.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + Math.max(0, event.data.top) - 30, behavior: 'smooth' });
      }
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); observer.disconnect(); };
  }, []);
  return <iframe ref={frame} className="html-report" title={title} srcDoc={html} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals" style={{ height }} onLoad={() => { syncTheme(); frame.current?.contentWindow?.postMessage({ type: 'areium-report-measure' }, '*'); }}/>;
}
