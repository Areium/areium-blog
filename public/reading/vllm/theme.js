(function () {
  var saved;
  try { saved = localStorage.getItem('areium-theme'); } catch {}
  document.documentElement.dataset.theme = ['light', 'dark'].includes(saved) ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
})();
