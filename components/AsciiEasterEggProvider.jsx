'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const AsciiContext = createContext(null);
export function useAsciiEasterEgg() { return useContext(AsciiContext); }

export default function AsciiEasterEggProvider({ children }) {
  const [sourceRect, setSourceRect] = useState(null);
  const [message, setMessage] = useState('');
  const background = useRef(null);
  const active = sourceRect !== null;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let dispose;
    const close = event => { if (event.key === 'Escape') setSourceRect(null); };
    window.addEventListener('keydown', close);
    import('../lib/ascii-scene').then(({ createAsciiScene }) =>
      createAsciiScene(background.current, controller.signal, () => {
        setSourceRect(null);
        setMessage('3D 场景已暂停，可以返回首页再次点击角色头部重试。');
      }, () => sourceRect)
    ).then(cleanup => {
      if (controller.signal.aborted) cleanup();
      else {
        dispose = cleanup;
        document.documentElement.dataset.asciiEgg = 'true';
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setSourceRect(null);
        setMessage('当前浏览器暂时无法启用 3D 彩蛋。');
      }
    });
    return () => {
      controller.abort();
      dispose?.();
      window.removeEventListener('keydown', close);
      delete document.documentElement.dataset.asciiEgg;
    };
  }, [active, sourceRect]);

  function toggle(rect) {
    setMessage('');
    setSourceRect(current => current ? null : {
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
    });
  }

  return <AsciiContext.Provider value={{ active, toggle }}>
    {children}
    {active && createPortal(<>
      <div className="ascii-background" ref={background} aria-hidden="true"/>
      <p className="ascii-hint">拖动空白处转动视角 · 触碰字符让它散开 · Esc 退出</p>
    </>, document.body)}
    {message && <p className="ascii-error" role="status">{message}</p>}
  </AsciiContext.Provider>;
}
