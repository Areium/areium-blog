'use client';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { headBounds, HERO_SOURCE } from '../lib/ascii-character';

export default function HeroEasterEgg() {
  const [active, setActive] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [message, setMessage] = useState('');
  const figure = useRef(null);
  const image = useRef(null);
  const background = useRef(null);

  useEffect(() => {
    function resize() {
      const imageElement = image.current;
      const figureElement = figure.current;
      if (!imageElement || !figureElement) return;
      const box = imageElement.getBoundingClientRect();
      const head = headBounds(box.width, box.height);
      setBounds({ ...head, left: head.left + figureElement.offsetLeft, top: head.top + figureElement.offsetTop });
    }
    const observer = new ResizeObserver(resize);
    observer.observe(figure.current);
    observer.observe(image.current);
    resize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let dispose;
    document.documentElement.dataset.asciiEgg = 'true';
    const close = event => { if (event.key === 'Escape') setActive(false); };
    window.addEventListener('keydown', close);
    import('../lib/ascii-scene').then(({ createAsciiScene }) =>
      createAsciiScene(background.current, controller.signal, () => { setActive(false); setMessage('3D 场景已暂停，可以再次点击头部重试。'); })
    ).then(cleanup => {
      if (controller.signal.aborted) cleanup();
      else dispose = cleanup;
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

  return <>
    <figure className="hero-wallpaper" ref={figure}>
      <Image ref={image} className="hero-wallpaper-image" src={HERO_SOURCE} width={3360} height={1440} sizes="(max-width: 1160px) 100vw, 1104px" quality={95} preload alt="蓝色天空下舒展羽翼的少女"/>
    </figure>
    {bounds && <button className="hero-head-trigger" style={bounds} type="button" aria-label={active ? '关闭 ASCII 角色彩蛋' : '开启 ASCII 角色彩蛋'} aria-pressed={active} title={active ? '再次点击，回到日常' : '轻触她的头，看看会发生什么'} onClick={() => { setMessage(''); setActive(value => !value); }}/>}
    {message && <p className="ascii-message" role="status">{message}</p>}
    {active && createPortal(<>
      <div className="ascii-background" ref={background} aria-hidden="true"/>
      <p className="ascii-hint">拖动空白处转动视角 · 触碰字符让它散开 · 再点头部或按 Esc 退出</p>
    </>, document.body)}
  </>;
}
