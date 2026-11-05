'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const AsciiContext = createContext(null);
export function useAsciiEasterEgg() { return useContext(AsciiContext); }

export default function AsciiEasterEggProvider({ children }) {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const background = useRef(null);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let dispose;
    const close = event => { if (event.key === 'Escape') setActive(false); };
    window.addEventListener('keydown', close);
    import('../lib/ascii-scene').then(({ createAsciiScene }) =>
      createAsciiScene(background.current, controller.signal, () => {
        setActive(false);
        setMessage('3D 场景已暂停，可以返回首页再次点击角色头部重试。');
      })
    ).then(cleanup => {
      if (controller.signal.aborted) cleanup();
      else {
        dispose = cleanup;
        document.documentElement.dataset.asciiEgg = 'true';
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setActive(false);
        setMessage('当前浏览器暂时无法启用 3D 彩蛋。');
      }
    });
    return () => {
      controller.abort();
      dispose?.();
      window.removeEventListener('keydown', close);
      delete document.documentElement.dataset.asciiEgg;
    };
  }, [active]);

  function toggle() {
    setMessage('');
    setActive(current => !current);
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
