(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let choice;
  try {
    choice = localStorage.getItem('cv-theme');
  } catch {}
  if (!['light', 'dark'].includes(choice)) choice = null;
  const apply = (theme) => {
    root.dataset.theme = theme;
  };
  apply(choice ?? (system.matches ? 'dark' : 'light'));

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    const sync = () => {
      const dark = root.dataset.theme === 'dark';
      const label = dark ? button.dataset.lightLabel : button.dataset.darkLabel;
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(dark));
      button.title = label;
    };
    button.hidden = false;
    sync();
    button.addEventListener('click', () => {
      choice = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(choice);
      try {
        localStorage.setItem('cv-theme', choice);
      } catch {}
      sync();
    });
    system.addEventListener('change', () => {
      if (!choice) {
        apply(system.matches ? 'dark' : 'light');
        sync();
      }
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== 'cv-theme') return;
      choice = ['light', 'dark'].includes(event.newValue)
        ? event.newValue
        : null;
      apply(choice ?? (system.matches ? 'dark' : 'light'));
      sync();
    });
  });
})();
