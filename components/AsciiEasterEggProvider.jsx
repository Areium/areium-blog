'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const AsciiContext = createContext(null);
let sceneModule;
function loadScene() {
  if (!sceneModule) sceneModule = import('../lib/ascii-scene').catch(error => {
    sceneModule = undefined;
    throw error;
  });
  return sceneModule;
}
function warmup() {
  loadScene().then(module => module.preloadAsciiScene()).catch(() => {});
}
export function useAsciiEasterEgg() { return useContext(AsciiContext); }

export default function AsciiEasterEggProvider({ children }) {
  const [phase, setPhase] = useState('off');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const background = useRef(null);
  const active = phase === 'active';
  const mounted = phase !== 'off';

  useEffect(() => {
    if (phase !== 'closing') return;
    const delay = ready && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 0;
    const timer = window.setTimeout(() => setPhase('off'), delay);
    return () => window.clearTimeout(timer);
  }, [phase, ready]);

  useEffect(() => {
    if (!ready || phase === 'off') {
      delete document.documentElement.dataset.asciiEgg;
      return;
    }
    // Resolve the initial transparent style before starting the crossfade.
    background.current?.getBoundingClientRect();
    document.documentElement.dataset.asciiEgg = phase === 'active' ? 'true' : 'closing';
  }, [phase, ready]);

  useEffect(() => {
    if (!mounted) return;
    const controller = new AbortController();
    let dispose;
    const close = event => { if (event.key === 'Escape') setPhase('closing'); };
    window.addEventListener('keydown', close);
    loadScene().then(({ createAsciiScene }) =>
      createAsciiScene(background.current, controller.signal, () => {
        setPhase('off');
        setMessage('3D 场景已暂停，可以返回首页再次点击角色头部重试。');
      })
    ).then(cleanup => {
      if (controller.signal.aborted) cleanup();
      else {
        dispose = cleanup;
        setReady(true);
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setPhase('off');
        setMessage('当前浏览器暂时无法启用 3D 彩蛋。');
      }
    });
    return () => {
      controller.abort();
      dispose?.();
      setReady(false);
      window.removeEventListener('keydown', close);
      delete document.documentElement.dataset.asciiEgg;
    };
  }, [mounted]);

  function toggle() {
    setMessage('');
    setPhase(current => current === 'active' ? 'closing' : 'active');
  }

  return <AsciiContext.Provider value={{ active, toggle, warmup }}>
    {children}
    {mounted && createPortal(<>
      <div className="ascii-background" ref={background} aria-hidden="true"/>
      <p className={`ascii-hint${ready ? '' : ' ascii-loading'}`} role="status">{ready ? '拖动空白处转动视角 · 触碰字符让它散开 · Esc 退出' : '正在唤醒字符角色… · Esc 取消'}</p>
    </>, document.body)}
    {message && <p className="ascii-error" role="status">{message}</p>}
  </AsciiContext.Provider>;
}
