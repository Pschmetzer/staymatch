// R7: Farb-Token der Startseite (DE/EN) und der Rechtsseiten erfüllen WCAG-Kontraste in Hell und Dunkel.
// Text 4,5:1 auf --bg und --bg2, Bedienelement-Ränder (--line2, --field) 3:1.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..', 'web');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');

const lum = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const vars = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b/g)].map((m) => [m[1], m[2]]));

function themes(html) {
  const dark = vars(/:root\s*\{([^}]*)\}/.exec(html)[1]);
  const light = { ...dark, ...vars(/:root\[data-theme="light"\]\s*\{([^}]*)\}/.exec(html)[1]) };
  const sys = { ...dark, ...vars(/@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme="dark"\]\)\s*\{([^}]*)\}/.exec(html)[1]) };
  return { dark, light, sys };
}

function checkTheme(name, t) {
  for (const bg of ['bg', 'bg2']) {
    for (const fg of ['text', 'muted', 'dim', 'good', 'warn']) {
      const r = ratio(t[fg], t[bg]);
      assert.ok(r >= 4.5, `${name}: --${fg} ${t[fg]} auf --${bg} ${t[bg]} nur ${r.toFixed(2)}:1`);
    }
    for (const ui of ['line2', 'field']) {
      if (!t[ui]) continue;
      const r = ratio(t[ui], t[bg]);
      assert.ok(r >= 3, `${name}: --${ui} ${t[ui]} auf --${bg} ${t[bg]} nur ${r.toFixed(2)}:1 (Bedienelement braucht 3:1)`);
    }
  }
}

for (const f of ['index.html', 'en.html']) {
  test(`${f}: Farb-Token erfüllen die Kontraste in Hell, Dunkel und System-Hell`, () => {
    const t = themes(read(f));
    for (const [n, v] of Object.entries(t)) checkTheme(`${f} ${n}`, v);
  });
}

test('index.html und en.html haben dieselben Farb-Token', () => {
  assert.deepEqual(themes(read('en.html')), themes(read('index.html')));
});

test('legal.css: Text-Token erfüllen 4,5:1 in Hell und Dunkel', () => {
  const css = read('legal.css');
  for (const block of [...css.matchAll(/:root[^{]*\{([^}]*--bg[^}]*)\}/g)].map((m) => vars(m[1]))) {
    for (const fg of ['text', 'muted', 'warn']) if (block[fg] && block.bg) {
      const r = ratio(block[fg], block.bg);
      assert.ok(r >= 4.5, `legal.css: --${fg} ${block[fg]} auf ${block.bg} nur ${r.toFixed(2)}:1`);
    }
  }
});

module.exports = { ratio };
