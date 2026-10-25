// DaoPedia site builder. No installs needed: run with `node build.js`. Output goes to /dist.
const fs = require('fs'), path = require('path');

const SECTIONS = {
  deities:   { title: 'Deities',   zh: '神', intro: 'Gods, immortals and ancestral masters honored in Taoist practice.' },
  festivals: { title: 'Festivals', zh: '節', intro: 'Observances of the Taoist year, with their meaning and customs.' },
  glossary:  { title: 'Glossary',  zh: '詞', intro: 'Key terms explained in plain English, with characters and pinyin.' },
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const index = {}; // slug -> entry, used for [[links]]

function parse(src) {
  src = src.replace(/\r\n/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/), meta = {};
  if (!m) return { meta, body: src };
  for (const l of m[1].split('\n')) { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  return { meta, body: m[2] };
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, k, t) => { const e = index[k.trim()]; return e ? `<a href="${e.url}">${t || e.meta.name}</a>` : (t || k); })
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
}
function md(b) {
  return b.trim().split(/\n\s*\n/).map(p => {
    p = p.trim();
    if (p.startsWith('## ')) return `<h2>${inline(p.slice(3))}</h2>`;
    if (/^- /.test(p)) return '<ul>' + p.split('\n').map(l => `<li>${inline(l.replace(/^- /, ''))}</li>`).join('') + '</ul>';
    return `<p>${inline(p)}</p>`;
  }).join('\n');
}

const NAV = [['/', 'Home'], ['/calendar.html', 'Calendar'], ['/deities/', 'Deities'], ['/festivals/', 'Festivals'], ['/glossary/', 'Glossary']];
const TAIJI = (id) => `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="var(--card)" stroke="currentColor" stroke-width="4"/><path d="M50 4A46 46 0 0 1 50 96A23 23 0 0 1 50 50A23 23 0 0 0 50 4Z" fill="currentColor"/><circle cx="50" cy="27" r="7" fill="currentColor"/><circle cx="50" cy="73" r="7" fill="var(--card)"/></svg>`;

const layout = (title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · DaoPedia</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<script>try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
</head><body>
<header class="site"><div class="bar">
<a class="brand" href="/">${TAIJI()}<span>DaoPedia <small>道百科</small></span></a>
<nav>${NAV.map(([u, n]) => `<a href="${u}">${n}</a>`).join('')}</nav>
<button class="theme" id="theme" aria-label="Switch light or dark mode">${TAIJI()}</button>
</div></header>
<main class="wrap">${body}</main>
<footer class="wrap foot">DaoPedia is a community reference for Western Taoist practitioners. Entries marked <span class="badge draft">draft</span> or <span class="badge verify">verify</span> have not yet been confirmed with a teacher or source.</footer>
<script>
var root=document.documentElement,rot=0,b=document.getElementById("theme");
b.onclick=function(){var d=root.dataset.theme?root.dataset.theme==="dark":matchMedia("(prefers-color-scheme:dark)").matches,t=d?"light":"dark";root.dataset.theme=t;rot+=360;b.firstElementChild.style.transform="rotate("+rot+"deg)";try{localStorage.setItem("theme",t)}catch(e){}};
</script>
</body></html>`;

const badge = m => `<span class="badge ${m.confidence || 'draft'}">${m.confidence || 'draft'}</span>`;
const write = (p, s) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };

// 1. Load all entries
const entries = {};
for (const sec of Object.keys(SECTIONS)) {
  const dir = path.join('content', sec);
  entries[sec] = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const slug = f.replace(/\.md$/, ''), { meta, body } = parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const e = { sec, slug, meta: { name: slug, ...meta }, body, url: `/${sec}/${slug}.html` };
    index[slug] = e; return e;
  }).sort((a, b) => a.meta.name.localeCompare(b.meta.name)) : [];
}

// 2. Build
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist', { recursive: true });
if (fs.existsSync('static')) fs.cpSync('static', 'dist', { recursive: true });

for (const [sec, S] of Object.entries(SECTIONS)) {
  for (const e of entries[sec]) {
    const m = e.meta, srcs = (m.sources || '').split('|').map(s => s.trim()).filter(Boolean);
    write(`dist/${sec}/${e.slug}.html`, layout(m.name, `
<p class="crumb"><a href="/${sec}/">&larr; ${S.title}</a></p>
<article class="entry">
<h1>${esc(m.name)} <span class="zh">${esc(m.chinese || '')}</span></h1>
<p class="py">${esc(m.pinyin || '')}</p>
<p>${m.tradition ? `<span class="badge">${esc(m.tradition)}</span> ` : ''}${badge(m)}</p>
${md(e.body)}
<h2>Sources</h2>
<ul>${srcs.length ? srcs.map(s => `<li>${inline(s)}</li>`).join('') : '<li>No sources listed yet.</li>'}</ul>
</article>`));
  }
  write(`dist/${sec}/index.html`, layout(S.title, `
<h1>${S.title} <span class="zh">${S.zh}</span></h1><p class="sub">${S.intro}</p>
${entries[sec].length ? entries[sec].map(e => `<a class="card" href="${e.url}"><b>${esc(e.meta.name)}</b> <span class="zh">${esc(e.meta.chinese || '')}</span> ${badge(e.meta)}<br><span class="meta">${esc(e.meta.summary || '')}</span></a>`).join('\n') : '<p>No entries yet.</p>'}`));
}

write('dist/index.html', layout('Home', `
<section class="hero"><div class="bigtj">${TAIJI()}</div>
<h1>DaoPedia</h1><div class="zt">道百科</div>
<p class="sub">A reference for Western Taoist practitioners: deities, festivals, terms and the Taoist calendar.</p></section>
<div class="cards">
<a class="card" href="/calendar.html"><b>Calendar <span class="zh">曆</span></b><br><span class="meta">Lunar and Gregorian dates for Zhengyi observances.</span></a>
${Object.entries(SECTIONS).map(([s, S]) => `<a class="card" href="/${s}/"><b>${S.title} <span class="zh">${S.zh}</span></b><br><span class="meta">${S.intro} (${entries[s].length} entries)</span></a>`).join('\n')}
</div>`));

console.log('Built', Object.values(entries).flat().length, 'entries into /dist');
