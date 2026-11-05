'use client';
import { useEffect, useRef, useState } from 'react';
import { withReportTheme } from '../lib/report-theme';

export default function HtmlReport({ html, title }) {
  const frame = useRef(null);
  const [height, setHeight] = useState(1100);
  const [prepared, setPrepared] = useState(null);
  useEffect(() => {
    // SSR cannot read the visitor's saved theme. Mount the frame only once the
    // outer page's blocking theme script has established it; keep srcDoc stable
    // on subsequent theme toggles so interactive report state is preserved.
    setPrepared({ source: html, markup: withReportTheme(html, document.documentElement.dataset.theme) });
  }, [html]);
  const syncTheme = () => frame.current?.contentWindow?.postMessage({ type: 'areium-theme', theme: document.documentElement.dataset.theme || 'light' }, '*');
  useEffect(() => {
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const receive = event => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'areium-report-ready') syncTheme();
      if (event.data?.type === 'areium-report-height' && Number.isFinite(event.data.height)) setHeight(Math.max(500, Math.min(100000, event.data.height)));
      if (event.data?.type === 'areium-report-anchor' && Number.isFinite(event.data.top)) {
        const top = frame.current.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + Math.max(0, event.data.top) - 30, behavior: 'smooth' });
      }
    };
    window.addEventListener('message', receive);
    syncTheme();
    return () => { window.removeEventListener('message', receive); observer.disconnect(); };
  }, []);
  if (prepared?.source !== html) return <div className="html-report-placeholder" role="status" style={{ height }}>正在加载文章…</div>;
  return <iframe ref={frame} className="html-report" title={title} srcDoc={prepared.markup} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals" style={{ height }} onLoad={() => { syncTheme(); frame.current?.contentWindow?.postMessage({ type: 'areium-report-measure' }, '*'); }}/>;
}
