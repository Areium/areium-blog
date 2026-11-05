'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useAsciiEasterEgg } from './AsciiEasterEggProvider';
import { headBounds, HERO_SOURCE } from '../lib/ascii-character';

export default function HeroEasterEgg() {
  const { active, toggle, warmup } = useAsciiEasterEgg();
  const [bounds, setBounds] = useState(null);
  const figure = useRef(null);
  const image = useRef(null);

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


  return <>
    <figure className="hero-wallpaper" ref={figure}>
      <Image ref={image} className="hero-wallpaper-image" src={HERO_SOURCE} width={3360} height={1440} sizes="(max-width: 1160px) 100vw, 1104px" quality={95} preload alt="蓝色天空下舒展羽翼的少女"/>
    </figure>
    {bounds && <button className="hero-head-trigger" style={bounds} type="button" aria-label={active ? '关闭 ASCII 角色彩蛋' : '开启 ASCII 角色彩蛋'} aria-pressed={active} onPointerEnter={warmup} onFocus={warmup} onClick={toggle}/>}

  </>;
}
