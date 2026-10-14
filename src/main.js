// Keep bookmarks from the previous language selector working.
const lang = new URLSearchParams(location.search).get('lang');
const base = import.meta.env.BASE_URL;
if (lang === 'en' && !location.pathname.startsWith(base + 'en/')) {
  location.replace(base + 'en/' + location.hash);
} else if (lang === 'nl' && location.pathname.startsWith(base + 'en/')) {
  location.replace(base + location.hash);
}
