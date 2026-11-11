(() => {
  import('/header-hover.js').then(({ setupHeaderHover }) => setupHeaderHover(document.querySelector('.blog-header')));
  const root = document.documentElement;
  const button = document.getElementById('reading-theme');
  const media = matchMedia('(prefers-color-scheme: dark)');
  function update() {
    const dark = root.dataset.theme === 'dark';
    button.textContent = dark ? '☀ 日间' : '☾ 夜间';
    button.setAttribute('aria-label', dark ? '切换为日间模式' : '切换为夜间模式');
    button.setAttribute('aria-pressed', String(dark));
  }
  function sync() {
    let saved;
    try { saved = localStorage.getItem('areium-theme'); } catch {}
    root.dataset.theme = ['light', 'dark'].includes(saved) ? saved : media.matches ? 'dark' : 'light';
    update();
  }
  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('areium-theme', next); } catch {}
    update();
  });
  media.addEventListener('change', sync);
  window.addEventListener('storage', sync);
  update();
  const jump = bottom => window.scrollTo({ top: bottom ? root.scrollHeight : 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  document.getElementById('reading-top').addEventListener('click', () => jump(false));
  document.getElementById('reading-bottom').addEventListener('click', () => jump(true));
})();
