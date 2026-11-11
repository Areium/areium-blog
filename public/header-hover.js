// Shared by the React blog and standalone reading pages.
export function setupHeaderHover(header) {
  if (!header) return () => {};
  const root = document.documentElement;
  // Keep the home page, article index and other sections fully expanded.
  if (!/^\/blog\/[^/]+/.test(window.location.pathname)) {
    root.classList.remove('header-hidden');
    return () => {};
  }
  const trigger = document.createElement('button');
  trigger.className = 'header-reveal';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', '展开博客顶栏');
  trigger.innerHTML = '<span aria-hidden="true">⌄</span>';
  document.body.append(trigger);
  let timer;
  let hovering = header.matches(':hover');
  let touchOpen = false;
  const setHidden = hidden => {
    root.classList.toggle('header-hidden', hidden);
    trigger.setAttribute('aria-expanded', String(!hidden));
  };
  const show = () => { clearTimeout(timer); setHidden(false); };
  const scheduleHide = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!hovering && !touchOpen && !header.querySelector(':focus-visible')) setHidden(true);
    }, 450);
  };
  const enter = event => { if (event.pointerType === 'touch') return; hovering = true; show(); };
  const leave = event => { if (event.pointerType === 'touch') return; hovering = false; scheduleHide(); };
  const move = event => {
    if (event.pointerType === 'touch') return;
    if (event.clientY <= 24) show();
    else if (!hovering) scheduleHide();
  };
  const tap = event => {
    if (!header.contains(event.target) && !trigger.contains(event.target)) {
      touchOpen = false;
      hovering = false;
      scheduleHide();
    }
  };
  const reveal = () => { touchOpen = true; show(); };
  const escape = event => {
    if (event.key === 'Escape') {
      touchOpen = false;
      if (header.contains(document.activeElement)) document.activeElement.blur();
      hovering = false;
      setHidden(true);
    }
  };
  header.addEventListener('pointerenter', enter);
  header.addEventListener('pointerleave', leave);
  header.addEventListener('focusin', show);
  header.addEventListener('focusout', scheduleHide);
  trigger.addEventListener('click', reveal);
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerdown', tap, { passive: true });
  document.addEventListener('keydown', escape);
  setHidden(false);
  scheduleHide();
  return () => {
    clearTimeout(timer);
    header.removeEventListener('pointerenter', enter);
    header.removeEventListener('pointerleave', leave);
    header.removeEventListener('focusin', show);
    header.removeEventListener('focusout', scheduleHide);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerdown', tap);
    document.removeEventListener('keydown', escape);
    trigger.remove();
    root.classList.remove('header-hidden');
  };
}
