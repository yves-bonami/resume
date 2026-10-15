import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const siteOrigin = 'https://dev.run';
export const basePath = process.env.SITE_BASE ?? '/';
if (!basePath.startsWith('/') || !basePath.endsWith('/'))
  throw new Error('SITE_BASE must start and end with /');

const partialNames = [
  'navigation',
  'hero',
  'experience',
  'skills',
  'soft-skills',
  'sidebar',
  'privacy',
  'analytics-consent',
];
const partialFiles = Object.fromEntries(
  partialNames.map((name) => [
    name,
    resolve(root, `src/partials/${name}.html`),
  ]),
);

const templateFile = resolve(root, 'src/resume.html');
const localeFiles = {
  nl: resolve(root, 'src/locales/nl.json'),
  en: resolve(root, 'src/locales/en.json'),
};

export const sourceFiles = [
  templateFile,
  ...Object.values(localeFiles),
  ...Object.values(partialFiles),
];
export const categories = [
  ['languages', 'skills.languages'],
  ['databases', 'skills.databases'],
  ['integration', 'skills.integration'],
  ['design', 'skills.design'],
  ['platform', 'skills.platform'],
  ['quality', 'skills.quality'],
];
const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export function categoryUrl(lang, index) {
  return `${lang === 'en' ? '/en' : ''}/skills/${categories[index][0]}/`;
}

export function createTranslator(lang) {
  if (!Object.hasOwn(localeFiles, lang)) throw new Error('Unknown language');
  const translations = JSON.parse(readFileSync(localeFiles[lang], 'utf8'));
  return (key) => {
    const value = translations[key];
    if (
      !Object.hasOwn(translations, key) ||
      typeof value !== 'string' ||
      !value.trim()
    ) {
      throw new Error(`Missing ${lang} translation: ${key}`);
    }
    return value;
  };
}

function readTemplate() {
  return readFileSync(templateFile, 'utf8').replace(
    /<!-- include:([a-z-]+) -->/g,
    (_, name) => {
      if (!partialFiles[name]) throw new Error(`Unknown partial: ${name}`);
      return readFileSync(partialFiles[name], 'utf8');
    },
  );
}

function selectSkills(html, selected) {
  return html.replace(
    /<!-- skill:(\d+) -->([\s\S]*?)<!-- \/skill:\1 -->/g,
    (_, index, content) =>
      selected === null || Number(index) === selected ? content : '',
  );
}

function translateContent(html, translate) {
  return html.replace(/\{\{([\w.]+)\}\}/g, (_, key) =>
    escapeHtml(translate(key)),
  );
}

function renderSkillNavigation(lang, selected, translate) {
  // Fetch a full static page; HTMX extracts and replaces only the skill widget.
  const tabs = categories
    .map(([, label], index) => {
      const url = categoryUrl(lang, index);
      return `<a
        href="${url}#vaardigheden"
        hx-get="${url}"
        hx-select="#skill-widget"
        hx-target="#skill-widget"
        hx-swap="outerHTML"
        hx-push-url="${url}#vaardigheden"
        ${index === selected ? 'class="active" aria-current="page"' : ''}
      >${escapeHtml(translate(label))}</a>`;
    })
    .join('');
  return `<nav class="skill-tabs" aria-label="${escapeHtml(translate('skills.navigation'))}">${tabs}</nav>`;
}

function applyBasePath(html) {
  return html.replace(
    /(href|src|hx-get|hx-push-url)="\/(?!\/)([^"]*)"/g,
    (_, attribute, path) => `${attribute}="${basePath}${path}"`,
  );
}

function languageUrl(lang) {
  return new URL(basePath + (lang === 'en' ? 'en/' : ''), siteOrigin).href;
}

function renderSeo(lang, translate) {
  const url = languageUrl(lang);
  const title = `Yves Bonami — Senior .NET Software Engineer | ${translate('meta.title')}`;
  const description = translate('meta.description');
  const image = new URL(basePath + 'yves-bonami.jpg', siteOrigin).href;
  const profile = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    inLanguage: lang,
    mainEntity: {
      '@type': 'Person',
      '@id': new URL(basePath + '#yves-bonami', siteOrigin).href,
      name: 'Yves Bonami',
      jobTitle: 'Senior .NET Software Engineer',
      description: translate('profile.summary'),
      url,
      image,
      sameAs: ['https://www.linkedin.com/in/yvesbonami/'],
    },
  };
  const structuredData = JSON.stringify(profile).replaceAll('<', '\\u003c');
  return `<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="nl" href="${languageUrl('nl')}">
<link rel="alternate" hreflang="en" href="${languageUrl('en')}">
<link rel="alternate" hreflang="x-default" href="${languageUrl('nl')}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:alt" content="Yves Bonami">
<meta property="og:locale" content="${lang === 'en' ? 'en_GB' : 'nl_BE'}">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">${structuredData}</script>`;
}

function renderDocument(lang, body, translate) {
  const description = translate('meta.description');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escapeHtml(description)}">
${renderSeo(lang, translate)}
<script src="/theme.js"></script>
<link rel="stylesheet" href="/src/app.css">
<script src="/vendor/htmx.min.js" defer></script>
<script type="module" src="/src/main.js"></script>
<script src="/analytics.js" defer></script>
</head>
<body>${body}

</body>
</html>
`;
}

export function render(lang, selected = 0) {
  if (!['nl', 'en'].includes(lang)) throw new Error('Unknown language');
  if (selected !== null && !categories[selected])
    throw new Error('Unknown category');

  const translate = createTranslator(lang);
  const template = readTemplate();
  const selectedContent = selectSkills(template, selected);
  const translatedContent = translateContent(selectedContent, translate);
  const body = translatedContent
    .replaceAll(
      '__PDF_URL__',
      lang === 'en' ? '/Yves_Bonami_CV_EN.pdf' : '/Yves_Bonami_CV.pdf',
    )
    .replaceAll('__NL_CURRENT__', lang === 'nl' ? 'aria-current="page"' : '')
    .replaceAll('__EN_CURRENT__', lang === 'en' ? 'aria-current="page"' : '')
    .replaceAll(
      '__SKILL_TABS__',
      renderSkillNavigation(lang, selected, translate),
    );

  return renderDocument(lang, applyBasePath(body), translate);
}

function writeIfChanged(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  let previous;
  try {
    previous = readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previous !== content) writeFileSync(file, content);
}

function generateSearchFiles() {
  const urls = ['nl', 'en']
    .map((lang) => `  <url><loc>${languageUrl(lang)}</loc></url>`)
    .join('\n');
  writeIfChanged(
    resolve(root, 'public/sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
  );
  writeIfChanged(
    resolve(root, 'public/robots.txt'),
    `User-agent: *
Allow: /
Sitemap: ${new URL(basePath + 'sitemap.xml', siteOrigin).href}
`,
  );
}

export function generatePages() {
  generateSearchFiles();
  const vendor = resolve(root, 'public/vendor');
  mkdirSync(vendor, { recursive: true });
  writeFileSync(
    resolve(vendor, 'htmx.min.js'),
    readFileSync(resolve(root, 'node_modules/htmx.org/dist/htmx.min.js')),
  );
  const paths = [];
  for (const lang of ['nl', 'en']) {
    const pages = [
      [lang === 'en' ? 'en/index.html' : 'index.html', 0],
      ...categories.map((_, i) => [
        `${categoryUrl(lang, i).slice(1)}index.html`,
        i,
      ]),
    ];
    for (const [relative, index] of pages) {
      const file = resolve(root, relative);
      writeIfChanged(file, render(lang, index));
      paths.push(file);
    }
  }
  return paths;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv[2] === '--pdf-source')
    process.stdout.write(render(process.argv[3] ?? 'nl', null));
  else console.log(`Generated ${generatePages().length} static pages.`);
}
