import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createTranslator,
  categories,
  categoryUrl,
  generatePages,
  render,
  root,
  basePath,
  siteOrigin,
} from './pages.mjs';

function checkTranslations() {
  const dutch = JSON.parse(
    readFileSync(resolve(root, 'src/locales/nl.json'), 'utf8'),
  );
  const english = JSON.parse(
    readFileSync(resolve(root, 'src/locales/en.json'), 'utf8'),
  );
  assert.deepEqual(
    Object.keys(english).sort(),
    Object.keys(dutch).sort(),
    'Locales must contain the same translation keys',
  );
  const pdfKeys = [
    ...readFileSync(
      resolve(root, 'scripts/build_resume_pdf.py'),
      'utf8',
    ).matchAll(/\btranslate\("([\w.]+)"\)/g),
  ].map((match) => match[1]);
  assert.ok(pdfKeys.length, 'No PDF translation references found');
  for (const lang of ['nl', 'en']) {
    const translate = createTranslator(lang);
    for (const key of new Set([...Object.keys(dutch), ...pdfKeys])) {
      assert.match(
        key,
        /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)+$/,
        `Invalid translation key: ${key}`,
      );
      assert.ok(translate(key).trim(), `Empty ${lang} translation: ${key}`);
    }
    assert.throws(() => translate('missing.translation'), {
      message: `Missing ${lang} translation: missing.translation`,
    });
  }
}

// Generated markup uses quoted attributes; these checks don't need a DOM library.
function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w-]+)=(["'])(.*?)\2/g)].map((match) => [
      match[1],
      match[3],
    ]),
  );
}

function checkLocalLinks(html, file, siteBase = basePath) {
  const route = file.slice(root.length + 1).replace(/index\.html$/, '');
  const pageUrl = new URL(siteBase + route, 'https://resume.invalid');
  for (const [, attribute, , value] of html.matchAll(
    /\b(href|src|hx-get|hx-push-url)=(["'])(.*?)\2/g,
  )) {
    const url = new URL(value, pageUrl);
    if (url.origin !== pageUrl.origin) continue;
    assert.ok(
      url.pathname.startsWith(siteBase),
      `Link outside SITE_BASE: ${value} in ${file}`,
    );
    const path = decodeURIComponent(url.pathname.slice(siteBase.length));
    let target = resolve(
      root,
      path,
      ...(url.pathname.endsWith('/') ? ['index.html'] : []),
    );
    if (!existsSync(target)) {
      target = resolve(
        root,
        'public',
        path,
        ...(url.pathname.endsWith('/') ? ['index.html'] : []),
      );
    }
    assert.ok(
      existsSync(target),
      `Missing ${attribute} target: ${value} in ${file}`,
    );
    if (url.hash) {
      const targetHtml = readFileSync(target, 'utf8');
      const ids = [...targetHtml.matchAll(/\bid=(["'])(.*?)\1/g)].map(
        (match) => match[2],
      );
      assert.ok(
        ids.includes(decodeURIComponent(url.hash.slice(1))),
        `Missing anchor: ${value} in ${file}`,
      );
    }
  }
}

function checkSkillNavigation(html, lang, selected) {
  const navigation = html.match(
    /<nav class="skill-tabs"[^>]*>([\s\S]*?)<\/nav>/,
  )?.[1];
  assert.ok(navigation, `Missing skill navigation for ${lang}`);
  const links = [...navigation.matchAll(/<a\b[^>]*>/g)].map(([tag]) =>
    attributes(tag),
  );
  assert.equal(links.length, categories.length);
  for (const [index, link] of links.entries()) {
    const url = basePath + categoryUrl(lang, index).slice(1);
    assert.equal(link.href, `${url}#vaardigheden`);
    assert.equal(link['hx-get'], url);
    assert.equal(link['hx-push-url'], link.href);
    assert.equal(link['hx-select'], '#skill-widget');
    assert.equal(link['hx-target'], '#skill-widget');
    assert.equal(link['hx-swap'], 'outerHTML');
    assert.equal(link['aria-current'], index === selected ? 'page' : undefined);
    assert.equal(link.class === 'active', index === selected);
  }
}

function checkSeoAndPrivacy(html, lang) {
  const canonical = new URL(basePath + (lang === 'en' ? 'en/' : ''), siteOrigin)
    .href;
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map(([tag]) =>
    attributes(tag),
  );
  assert.equal(links.find((link) => link.rel === 'canonical')?.href, canonical);
  for (const language of ['nl', 'en', 'x-default']) {
    const expected = new URL(
      basePath + (language === 'en' ? 'en/' : ''),
      siteOrigin,
    ).href;
    assert.equal(
      links.find((link) => link.hreflang === language)?.href,
      expected,
    );
  }
  const schema = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(schema['@type'], 'ProfilePage');
  assert.equal(schema.url, canonical);
  assert.equal(schema.mainEntity['@type'], 'Person');
  assert.equal(schema.mainEntity.name, 'Yves Bonami');
  assert.equal(
    schema.mainEntity.description,
    createTranslator(lang)('profile.summary'),
  );
  assert.ok(
    !/<script[^>]+src=["']https:\/\/static\.cloudflareinsights\.com/.test(html),
    'Analytics must load through the consent gate',
  );
  assert.ok(html.includes('src="/analytics.js"'));
  assert.ok(html.includes('id="privacy"'));
  assert.ok(
    html.includes('data-analytics-choice="allow"') &&
      html.includes('data-analytics-choice="decline"'),
  );
}

function checkPage(file, lang, selected) {
  const html = readFileSync(file, 'utf8');
  assert.match(html, new RegExp(`<html lang="${lang}">`));
  assert.equal((html.match(/class="skill-panel"/g) ?? []).length, 1);
  assert.ok(html.includes(`id="skill-${selected}"`));
  assert.ok(
    !html.includes('<!-- include:') &&
      !html.includes('{{') &&
      !/__\w+__/.test(html),
    `Unresolved template marker in ${file}`,
  );
  checkSkillNavigation(html, lang, selected);
  checkSeoAndPrivacy(html, lang);
  // Vite prefixes head assets during build; body URLs already include SITE_BASE.
  checkLocalLinks(html.match(/<head>([\s\S]*?)<\/head>/)[1], file, '/');
  checkLocalLinks(html.match(/<body>([\s\S]*?)<\/body>/)[1], file);
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) =>
    attributes(tag),
  );
  for (const language of ['nl', 'en']) {
    const switchLink = links.find((link) => link.lang === language);
    assert.equal(switchLink?.href, basePath + (language === 'en' ? 'en/' : ''));
    assert.equal(
      switchLink['aria-current'],
      language === lang ? 'page' : undefined,
    );
  }
  const download = links.find((link) => link.class === 'button secondary');
  const filename =
    lang === 'en' ? 'Yves_Bonami_CV_EN.pdf' : 'Yves_Bonami_CV.pdf';
  assert.equal(download?.href, basePath + filename);
  assert.equal(download.target, '_blank');
}

checkTranslations();
const pages = generatePages();
assert.equal(pages.length, 2 * (categories.length + 1));
for (const lang of ['nl', 'en']) {
  const home = resolve(root, lang === 'en' ? 'en/index.html' : 'index.html');
  checkPage(home, lang, 0);
  for (const [selected] of categories.entries()) {
    checkPage(
      resolve(root, categoryUrl(lang, selected).slice(1), 'index.html'),
      lang,
      selected,
    );
  }
  const pdfSource = render(lang, null);
  const panelIds = [
    ...pdfSource.matchAll(/class="skill-panel" id="skill-(\d+)"/g),
  ].map((match) => Number(match[1]));
  assert.deepEqual(
    panelIds,
    [...categories.keys()],
    `PDF source must include every skill category for ${lang}`,
  );
}
const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');
const expectedUrls = ['nl', 'en'].map(
  (lang) => new URL(basePath + (lang === 'en' ? 'en/' : ''), siteOrigin).href,
);
assert.deepEqual(
  [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]),
  expectedUrls,
);
assert.ok(
  readFileSync(resolve(root, 'public/robots.txt'), 'utf8').includes(
    new URL(basePath + 'sitemap.xml', siteOrigin).href,
  ),
);
console.log(
  `Verified translations, ${pages.length} generated pages, local links and anchors, HTMX navigation, language/PDF links, and complete PDF source.`,
);
