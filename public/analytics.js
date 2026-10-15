(() => {
  const preferenceKey = 'cv-analytics-consent';
  const preferenceLifetime = 180 * 24 * 60 * 60 * 1000;
  const banner = document.getElementById('analytics-consent');
  const settings = document.querySelector('[data-analytics-settings]');
  const status = document.querySelector('[data-analytics-status]');
  if (!banner || !settings || !status) return;

  function readPreference() {
    try {
      const preference = JSON.parse(localStorage.getItem(preferenceKey));
      if (
        typeof preference?.allowed === 'boolean' &&
        Number.isFinite(preference.expiresAt) &&
        preference.expiresAt > Date.now()
      )
        return preference;
    } catch {}
    return null;
  }

  function applyPreference(preference) {
    const allowed = preference?.allowed === true;
    banner.hidden = preference !== null;
    status.textContent = allowed
      ? status.dataset.enabledLabel
      : status.dataset.disabledLabel;
    const beacon = document.querySelector('script[data-cf-beacon]');
    if (allowed && !beacon) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
      script.dataset.cfBeacon = JSON.stringify({
        token: 'c51bd93b7125487586f4747a19d8c848',
      });
      document.body.append(script);
    } else if (!allowed && beacon) {
      // Reload without the beacon so its event listeners cannot keep collecting.
      location.reload();
    }
  }

  document
    .querySelector('[data-open-privacy]')
    .addEventListener('click', () => {
      document.getElementById('privacy').open = true;
      banner.hidden = true;
    });
  settings.hidden = false;
  settings.addEventListener('click', () => {
    banner.hidden = false;
    banner.querySelector('button').focus();
  });
  for (const button of banner.querySelectorAll('[data-analytics-choice]')) {
    button.addEventListener('click', () => {
      const preference = {
        allowed: button.dataset.analyticsChoice === 'allow',
        expiresAt: Date.now() + preferenceLifetime,
      };
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(preference));
      } catch {}
      applyPreference(preference);
      settings.focus();
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key === preferenceKey || event.key === null)
      applyPreference(readPreference());
  });
  applyPreference(readPreference());
})();
