(function () { let t = 'light'; try { t = localStorage.getItem('sm_theme'); } catch {} document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light'; })();
