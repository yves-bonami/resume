# Yves Bonami — CV

A static HTML/CSS resume with HTMX skill-category navigation and a Vite dev server.
There is no frontend component framework or production application server.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The Dutch page is at `/`; English is at `/en/`.
HTML and translation edits reload the page automatically; CSS updates immediately.

## Editing

- `src/resume.html`: shared HTML and Dutch content. Translatable text uses `{{"Dutch text"}}`.
- `src/translations.en.json`: English translations of the same content.
- `src/app.css`: appearance, responsive layout and print styling.
- `public/theme.js`: system theme detection and the saved light/dark choice.
- `scripts/pages.mjs`: generates the static language and category pages.

Skill links use HTMX to replace only the skill widget. Each link also opens a full
static page normally when JavaScript is disabled. Language links are normal page
links. HTMX is served locally; no CDN or external service is needed.

Root `index.html`, `en/`, `skills/`, and `public/vendor/` are generated.
Edit the template and translations, rather than these generated files.

## Checks and build

```sh
npm run check
npm run build
npm run preview
```

Deploy the contents of `dist/` to a static host. Both PDFs and the profile photo
are included. No SPA fallback is required; directory index pages must be served.

## PDFs

Both PDFs use the exact content of the corresponding HTML version, including
every skill category.

One-time setup:

```sh
python3 -m venv .venv
.venv/bin/pip install -r scripts/pdf-requirements.txt
```

After changing content:

```sh
npm run pdf
npm run build
```

Downloads: `public/Yves_Bonami_CV.pdf` and `public/Yves_Bonami_CV_EN.pdf`.
The generator uses DejaVu Sans through fontconfig.

The previous Svelte project is backed up beside this project as
`../cv-web-before-htmx.tar.gz`.

## GitHub Pages

GitHub Actions rebuilds both PDFs and the static site on pushes to `main`, then deploys `dist/` to Pages.
For a project site, `SITE_BASE=/resume/ npm run build` prefixes all internal links and HTMX requests.
Run `npm run generate` afterwards to restore root-relative development pages.
