import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  categories,
  categoryUrl,
  generatePages,
  render,
  root,
  basePath,
} from './pages.mjs';

assert.equal(generatePages().length, 14);
for (const lang of ['nl', 'en']) {
  for (let selected = 0; selected < categories.length; selected++) {
    const html = render(lang, selected);
    assert.match(html, new RegExp(`<html lang="${lang}">`));
    assert.equal((html.match(/class="skill-panel"/g) ?? []).length, 1);
    assert.match(html, new RegExp(`id="skill-${selected}"`));
    assert.equal((html.match(/hx-get=/g) ?? []).length, 6);
    assert.ok(!html.includes('<!-- include:'));
    assert.ok(!html.includes('{{') && !/__\w+__/.test(html));
    assert.ok(
      !html.includes('svelte') &&
        !html.includes('gmail.com') &&
        !html.includes('tel:'),
    );
    assert.ok(html.includes('yves.bonami@dev.run'));
    assert.ok(html.includes(`href="${basePath}en/"`));
    assert.ok(
      html.includes(`hx-get="${basePath}skills/design/"`) ||
        html.includes(`hx-get="${basePath}en/skills/design/"`),
    );
    assert.ok(html.includes(lang === 'en' ? 'Download resume' : 'Download cv'));
    assert.ok(
      html.includes(
        lang === 'en' ? '/Yves_Bonami_CV_EN.pdf' : '/Yves_Bonami_CV.pdf',
      ),
    );
    for (const [index] of categories.entries()) {
      assert.ok(
        existsSync(
          resolve(root, categoryUrl(lang, index).slice(1), 'index.html'),
        ),
      );
    }
  }
  const pdf = render(lang, null);
  assert.equal((pdf.match(/class="skill-panel"/g) ?? []).length, 6);
  assert.ok(
    pdf.includes(
      lang === 'en'
        ? 'DDD &amp; domain modelling'
        : 'DDD &amp; domeinmodellering',
    ),
  );
}
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
assert.ok(
  !pkg.dependencies?.svelte &&
    !pkg.devDependencies?.['@sveltejs/vite-plugin-svelte'],
);
console.log(
  'Verified 14 static routes, both translations, HTMX links, no-JS category pages, and shared PDF content.',
);
