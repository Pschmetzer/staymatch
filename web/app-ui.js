  addEventListener('DOMContentLoaded', () => {
  document.getElementById('theme').onclick = () => {
    const root = document.documentElement, next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next; try { localStorage.setItem('sm_theme', next); } catch {}
    document.getElementById('theme').setAttribute('aria-pressed', String(next === 'dark'));
  };
  document.getElementById('theme').setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
  });
