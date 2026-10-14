# Resume

A bilingual resume website built with HTML, CSS and HTMX, with downloadable PDFs. Vite provides a development server and builds static files for deployment.

## Development

Requires Node.js 24 or later and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Dutch is served at `/` and English at `/en/`.
Template and translation changes reload the page; CSS updates without a reload.

## Project structure

- `src/resume.html`: page layout, smaller sections and include markers.
- `src/partials/`: navigation, hero, experience, technical skills, soft skills and sidebar. Translation markers such as `{{profile.summary}}` are resolved during generation.
- `src/locales/nl.json` and `src/locales/en.json`: Dutch and English text, indexed by stable keys such as `profile.summary`.
- `src/app.css`: layout, colors, responsive styles and animation.
- `src/main.js`: redirects older language-query links.
- `public/theme.js`: theme selection and persistence.
- `public/`: profile photo, downloadable PDFs and other static assets.
- `scripts/pages.mjs`: generates language and skill-category pages.
- `scripts/build_resume_pdf.py`: creates both PDFs from the same content.
- `vite.config.js`: development watching and static build configuration.

HTML partials are included with `<!-- include:name -->` markers at build time. Changes to each partial trigger the same live reload as the main template.

The root `index.html`, `en/`, `skills/` and `public/vendor/` are generated. Edit source files rather than generated pages.

## Translations

Use the same key in both locale files and reference it in HTML with `{{key.name}}`. Edit the value to change wording; keep the key stable. Store plain text in translations; the generator escapes HTML characters.

`npm run check` verifies that both locales have the same keys and nonempty text. Missing keys also fail page generation and PDF generation instead of falling back to another language. Locale edits trigger live reload.

## How HTMX is used

HTMX progressively enhances the technical-skill category links. The attributes are generated in `renderSkillNavigation()` in `scripts/pages.mjs`; the widget itself lives in `src/partials/skills.html`.

For example, selecting Software Design on the Dutch page:

```html
<a
  href="/skills/design/#vaardigheden"
  hx-get="/skills/design/"
  hx-select="#skill-widget"
  hx-target="#skill-widget"
  hx-swap="outerHTML"
  hx-push-url="/skills/design/#vaardigheden"
>
  Softwareontwerp
</a>
```

1. `hx-get` requests a complete static category page.
2. `hx-select` extracts its `#skill-widget` element.
3. `hx-target` and `hx-swap` replace the current widget, including the active category link.
4. `hx-push-url` updates the address and browser history.

Without JavaScript, `href` navigates to the same category as a normal page. The generator writes six category pages per language, plus the two language landing pages. No application server is needed.

HTMX is copied from the installed npm package to `public/vendor/` during generation. Language switching, PDF downloads and theme selection do not use HTMX.

## Formatting and checks

```sh
npm run format
npm run format:check
npm run check
```

Prettier formats HTML, CSS, JavaScript, JSON, Markdown and YAML. To format the Python PDF generator, run `uvx black scripts/build_resume_pdf.py` (requires uv).

The page checks verify routes, translations, category links and shared PDF content.

## PDFs

PDF generation requires Python 3.12 or later, fontconfig and DejaVu Sans fonts.

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/pdf-requirements.txt
npm run pdf
```

Regenerate the PDFs after content or photo changes. Both languages use the corresponding website text and include every skill category. Output files are written to `public/`.

## Build and deployment

```sh
npm run build
npm run preview
```

Deploy `dist/` to a static host that serves directory index pages. It includes both languages, PDFs and the profile photo.

GitHub Actions rebuilds the PDFs and website on pushes to `main`, then deploys to GitHub Pages. The workflow sets `SITE_BASE` to the repository path.

For deployment under a subdirectory:

```sh
SITE_BASE=/resume/ npm run build
```

`SITE_BASE` must start and end with `/`. It prefixes internal links and HTMX requests. Run `npm run generate` afterwards to restore root-relative development pages.
