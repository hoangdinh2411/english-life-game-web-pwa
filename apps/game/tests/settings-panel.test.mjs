import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
try {
  let SettingsPanel;
  let PreferenceControls;
  try {
    ({ SettingsPanel } = await server.ssrLoadModule('/src/features/game-menu/SettingsPanel.tsx'));
    ({ PreferenceControls } = await server.ssrLoadModule('/src/features/hud/Settings.tsx'));
  } catch {
    // The first run records the missing Settings surface as an assertion failure.
  }

  test('Settings uses a separate scroll-safe overlay with audio preferences', () => {
    assert.equal(typeof SettingsPanel, 'function');
    const html = renderToStaticMarkup(createElement(SettingsPanel, { practice: false, onBack() {} }));
    assert.match(html, /aria-label="Settings"/);
    assert.match(html, />Sound</);
    assert.doesNotMatch(html, />Coach</);
    assert.match(html, /Voice speed:/);
    assert.match(html, /Voice pitch:/);
    assert.match(html, />Back to Game Menu</);
    assert.doesNotMatch(html, />Close Settings</);
    assert.match(html, /overflow-y-auto/);
  });

  test('local practice identifies settings as device-local', () => {
    assert.equal(typeof SettingsPanel, 'function');
    const html = renderToStaticMarkup(createElement(SettingsPanel, { practice: true, onBack() {} }));
    assert.match(html, /apply only to this local practice session/i);
    assert.doesNotMatch(html, /synchroniz/i);
  });

  test('account controls expose saving, saved, failure and Retry feedback', () => {
    assert.equal(typeof PreferenceControls, 'function');
    const base = {
      sound: true,
      speechRate: 1,
      speechPitch: 1,
      compact: false,
      practice: false,
      set() {},
      retry() {},
    };
    const saving = renderToStaticMarkup(createElement(PreferenceControls, { ...base, status: 'saving' }));
    const saved = renderToStaticMarkup(createElement(PreferenceControls, { ...base, status: 'saved' }));
    const failed = renderToStaticMarkup(createElement(PreferenceControls, { ...base, status: 'error' }));
    assert.match(saving, /Saving account settings/);
    assert.match(saved, /Account settings saved/);
    assert.match(failed, /Settings are not synchronized/);
    assert.match(failed, />Retry</);
  });
} finally {
  await server.close();
}
