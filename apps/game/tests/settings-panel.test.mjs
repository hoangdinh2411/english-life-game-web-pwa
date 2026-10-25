import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
try {
  let SettingsPanel;
  try {
    ({ SettingsPanel } = await server.ssrLoadModule('/src/features/game-menu/SettingsPanel.tsx'));
  } catch {
    // The first run records the missing Settings surface as an assertion failure.
  }

  test('Settings uses a separate scroll-safe overlay with audio preferences', () => {
    assert.equal(typeof SettingsPanel, 'function');
    const html = renderToStaticMarkup(createElement(SettingsPanel, { practice: false, onClose() {} }));
    assert.match(html, /aria-label="Settings"/);
    assert.match(html, />Sound</);
    assert.doesNotMatch(html, /Coach/);
    assert.match(html, /Voice speed:/);
    assert.doesNotMatch(html, /Voice pitch:/);
    assert.match(html, />Close Settings</);
    assert.doesNotMatch(html, /Back to Game Menu/);
    assert.match(html, /overflow-y-auto/);
  });

  test('local practice identifies settings as device-local', () => {
    assert.equal(typeof SettingsPanel, 'function');
    const html = renderToStaticMarkup(createElement(SettingsPanel, { practice: true, onClose() {} }));
    assert.match(html, /Saved on this device/);
    assert.doesNotMatch(html, /synchroniz/i);
  });
} finally {
  await server.close();
}
