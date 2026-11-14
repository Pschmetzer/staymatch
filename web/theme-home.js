  // Theme vor dem ersten Zeichnen: eigene Wahl, sonst bewusst Hell (Standard seit #41), nicht das System
  document.documentElement.classList.add('js');
  let t = 'light'; try { const s = localStorage.getItem('sm_theme'); if (s === 'light' || s === 'dark') t = s; } catch {}
  document.documentElement.dataset.theme = t;
