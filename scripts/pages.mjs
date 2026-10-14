import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const basePath = process.env.SITE_BASE ?? '/';
if (!basePath.startsWith('/') || !basePath.endsWith('/')) throw new Error('SITE_BASE must start and end with /');

export const sourceFiles = [
  resolve(root, 'src/resume.html'),
  resolve(root, 'src/translations.en.json'),
];
export const categories = [
  ['languages', 'Talen & frameworks'],
  ['databases', 'Databases'],
  ['integration', 'API’s & integratie'],
  ['design', 'Softwareontwerp'],
  ['platform', 'Platform & DevOps'],
  ['quality', 'Testing & kwaliteit'],
];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function categoryUrl(lang, index) {
  return `${lang === 'en' ? '/en' : ''}/skills/${categories[index][0]}/`;
}

export function render(lang, selected = 0) {
  if (!['nl', 'en'].includes(lang)) throw new Error('Unknown language');
  if (selected !== null && !categories[selected]) throw new Error('Unknown category');
  const translations = JSON.parse(readFileSync(sourceFiles[1], 'utf8'));
  const t = value => lang === 'en' ? (translations[value] ?? value) : value;
  const tabs = categories.map(([, label], index) => {
    const url = categoryUrl(lang, index);
    return `<a href="${url}#vaardigheden" hx-get="${url}" hx-select="#skill-widget" hx-target="#skill-widget" hx-swap="outerHTML" hx-push-url="${url}#vaardigheden"${index === selected ? ' class="active" aria-current="page"' : ''}>${escape(t(label))}</a>`;
  }).join('');
  const body = readFileSync(sourceFiles[0], 'utf8')
    .replace(/<!-- skill:(\d+) -->([\s\S]*?)<!-- \/skill:\1 -->/g,
      (_, index, content) => selected === null || Number(index) === selected ? content : '')
    .replace(/\{\{("(?:[^"\\]|\\.)*")\}\}/g, (_, key) => escape(t(JSON.parse(key))))
    .replaceAll('__PDF_URL__', lang === 'en' ? '/Yves_Bonami_CV_EN.pdf' : '/Yves_Bonami_CV.pdf')
    .replaceAll('__NL_CURRENT__', lang === 'nl' ? 'aria-current="page"' : '')
    .replaceAll('__EN_CURRENT__', lang === 'en' ? 'aria-current="page"' : '')
    .replaceAll('__SKILL_TABS__', `<nav class="skill-tabs" aria-label="${escape(t('Technische categorieën'))}">${tabs}</nav>`);
  const routedBody = body.replace(/(href|src|hx-get|hx-push-url)="\/(?!\/)([^"]*)"/g, (_, attribute, path) => `${attribute}="${basePath}${path}"`);
  const title = `Yves Bonami — ${lang === 'en' ? 'Resume' : 'CV'}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escape(lang === 'en' ? 'Senior .NET Software Engineer with expertise in Industry 4.0 and IIoT.' : 'Senior .NET Software Engineer met sterke expertise in Industry 4.0 en IIoT.')}">
<title>${title}</title>
<script src="/theme.js"></script>
<link rel="stylesheet" href="/src/app.css">
<script src="/vendor/htmx.min.js" defer></script>
<script type="module" src="/src/main.js"></script>
</head>
<body>${routedBody}</body>
</html>
`;
}

export function generatePages() {
  const vendor = resolve(root, "public/vendor");
  mkdirSync(vendor, { recursive: true });
  writeFileSync(resolve(vendor, "htmx.min.js"), readFileSync(resolve(root, "node_modules/htmx.org/dist/htmx.min.js")));
  const paths = [];
  for (const lang of ['nl', 'en']) {
    const pages = [[lang === 'en' ? 'en/index.html' : 'index.html', 0],
      ...categories.map((_, i) => [`${categoryUrl(lang, i).slice(1)}index.html`, i])];
    for (const [relative, index] of pages) {
      const file = resolve(root, relative);
      mkdirSync(dirname(file), { recursive: true });
      const html = render(lang, index);
      // Avoid duplicate reloads for unchanged generated pages.
      let current;
      try { current = readFileSync(file, 'utf8'); } catch {}
      if (current !== html) writeFileSync(file, html);
      paths.push(file);
    }
  }
  return paths;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === '--pdf-source') process.stdout.write(render(process.argv[3] ?? 'nl', null));
  else console.log(`Generated ${generatePages().length} static pages.`);
}
