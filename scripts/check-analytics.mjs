import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  new URL('../public/analytics.js', import.meta.url),
  'utf8',
);

// Capture script insertion without contacting an analytics provider.
function openPage(savedPreference = null, storageAvailable = true) {
  const events = new Map();
  const button = (name, dataset = {}) => ({
    dataset,
    hidden: true,
    focus() {},
    addEventListener(event, handler) {
      events.set(`${name}:${event}`, handler);
    },
  });
  const allow = button('allow', { analyticsChoice: 'allow' });
  const decline = button('decline', { analyticsChoice: 'decline' });
  const settings = button('settings');
  const privacyLink = button('privacy');
  const privacy = { open: false };
  const status = {
    dataset: { enabledLabel: 'enabled', disabledLabel: 'disabled' },
  };
  const banner = {
    hidden: true,
    querySelector: () => allow,
    querySelectorAll: () => [allow, decline],
  };
  const scripts = [];
  const page = {
    savedPreference,
    reloads: 0,
    scripts,
    banner,
    settings,
    status,
    privacy,
  };
  const elements = new Map([
    ['[data-analytics-settings]', settings],
    ['[data-analytics-status]', status],
    ['[data-open-privacy]', privacyLink],
  ]);
  runInNewContext(source, {
    document: {
      getElementById: (id) => (id === 'privacy' ? privacy : banner),
      querySelector: (selector) =>
        selector === 'script[data-cf-beacon]'
          ? scripts[0]
          : elements.get(selector),
      createElement: () => ({ dataset: {} }),
      body: { append: (script) => scripts.push(script) },
    },
    localStorage: {
      getItem() {
        if (!storageAvailable) throw new Error('Storage blocked');
        return page.savedPreference;
      },
      setItem(key, value) {
        if (!storageAvailable) throw new Error('Storage blocked');
        page.savedPreference = value;
      },
    },
    location: { reload: () => page.reloads++ },
    window: { addEventListener: (name, handler) => events.set(name, handler) },
  });
  page.click = (name) => events.get(`${name}:click`)();
  page.storageChanged = () =>
    events.get('storage')({ key: 'cv-analytics-consent' });
  return page;
}

const preference = (allowed, expiresAt = Date.now() + 60_000) =>
  JSON.stringify({ allowed, expiresAt });
for (const saved of [
  null,
  '{invalid',
  preference(false),
  preference(true, Date.now() - 1000),
]) {
  const page = openPage(saved);
  assert.equal(page.scripts.length, 0, 'No beacon without valid consent');
  assert.equal(page.status.textContent, 'disabled');
}
const accepted = openPage(preference(true));
assert.equal(accepted.scripts.length, 1);
assert.equal(accepted.banner.hidden, true);
const fresh = openPage();
assert.equal(fresh.banner.hidden, false);
fresh.click('allow');
fresh.click('allow');
assert.equal(fresh.scripts.length, 1, 'Only one beacon per page');
assert.equal(
  fresh.scripts[0].src,
  'https://static.cloudflareinsights.com/beacon.min.js',
);
assert.equal(JSON.parse(fresh.savedPreference).allowed, true);
fresh.click('settings');
assert.equal(fresh.banner.hidden, false);
fresh.click('decline');
assert.equal(JSON.parse(fresh.savedPreference).allowed, false);
assert.equal(fresh.reloads, 1, 'Withdrawal reloads without analytics');
assert.equal(openPage(fresh.savedPreference).scripts.length, 0);
accepted.savedPreference = preference(false);
accepted.storageChanged();
assert.equal(accepted.reloads, 1, 'Withdrawal in another tab is respected');
const unavailable = openPage(null, false);
assert.equal(unavailable.scripts.length, 0);
unavailable.click('allow');
assert.equal(
  unavailable.scripts.length,
  1,
  'Explicit consent works when storage is unavailable',
);
console.log(
  'Verified analytics opt-in, refusal, expiry, withdrawal, storage failure and duplicate prevention.',
);
