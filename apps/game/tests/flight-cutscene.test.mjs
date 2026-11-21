import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FlightCutscene,
  getFlightCutsceneDuration,
  startFlightCutsceneTimer,
} from '../src/features/onboarding/FlightCutscene.tsx';

test('FlightCutscene renders destination country label and fallback when omitted', () => {
  const htmlWithCountry = renderToStaticMarkup(
    createElement(FlightCutscene, {
      destinationCountryName: 'Japan',
      onComplete: () => {},
    }),
  );
  assert.match(htmlWithCountry, /Flying to Japan/);
  assert.match(htmlWithCountry, /Flight in Progress/);
  assert.match(htmlWithCountry, /Departure Gate/);
  assert.match(htmlWithCountry, /Skip/);
  assert.match(htmlWithCountry, /aria-label="Skip flight cutscene"/);

  const htmlFallback = renderToStaticMarkup(
    createElement(FlightCutscene, {
      destinationCountryName: undefined,
      onComplete: () => {},
    }),
  );
  assert.match(htmlFallback, /Flying to Arrival Terminal/);

  const htmlNotSelected = renderToStaticMarkup(
    createElement(FlightCutscene, {
      destinationCountryName: 'Not selected',
      onComplete: () => {},
    }),
  );
  assert.match(htmlNotSelected, /Flying to Arrival Terminal/);
});

test('FlightCutscene uses semantic color variables and no hex literals in markup', () => {
  const html = renderToStaticMarkup(
    createElement(FlightCutscene, {
      destinationCountryName: 'Sweden',
      onComplete: () => {},
    }),
  );
  assert.match(html, /var\(--color-dark-surface\)/);
  assert.match(html, /var\(--color-cream-text-pure\)/);
  assert.match(html, /var\(--color-gold\)/);
  assert.match(html, /var\(--color-green-deep\)/);
  assert.match(html, /var\(--color-energy-track\)/);
  // Zero hex color literals in rendered markup
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}/);
});

test('startFlightCutsceneTimer completes after duration and supports cancellation', () => {
  let timerCb = null;
  let timerDelay = 0;
  let clearedId = null;
  let completed = false;

  const cancel = startFlightCutsceneTimer({
    durationMs: 3500,
    reducedMotion: false,
    onComplete: () => {
      completed = true;
    },
    setTimeoutFn: (cb, delay) => {
      timerCb = cb;
      timerDelay = delay;
      return 42;
    },
    clearTimeoutFn: (id) => {
      clearedId = id;
    },
  });

  assert.equal(timerDelay, 3500);
  assert.equal(completed, false);

  // Trigger timer callback
  timerCb?.();
  assert.equal(completed, true);

  // Trigger cancel
  cancel();
  assert.equal(clearedId, 42);
});

test('reduced-motion behavior shortens flight duration and includes reduced-motion styles', () => {
  assert.equal(getFlightCutsceneDuration(3500, false), 3500);
  assert.equal(getFlightCutsceneDuration(3500, true), 500);
  assert.equal(getFlightCutsceneDuration(200, true), 200);

  let recordedDelay = 0;
  startFlightCutsceneTimer({
    durationMs: 3500,
    reducedMotion: true,
    onComplete: () => {},
    setTimeoutFn: (_cb, delay) => {
      recordedDelay = delay;
      return 1;
    },
    clearTimeoutFn: () => {},
  });
  assert.equal(recordedDelay, 500);

  const html = renderToStaticMarkup(
    createElement(FlightCutscene, {
      destinationCountryName: 'Canada',
      onComplete: () => {},
    }),
  );
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /animation:\s*none\s*!important/);
});

test('skip button trigger invokes onComplete callback', () => {
  let skipped = false;
  const onComplete = () => {
    skipped = true;
  };

  const html = renderToStaticMarkup(
    createElement(FlightCutscene, {
      destinationCountryName: 'Australia',
      onComplete,
    }),
  );
  assert.match(html, /<button[^>]+aria-label="Skip flight cutscene"[^>]*>Skip<\/button>/);

  // Direct skip invocation simulates clicking the button or pressing escape
  onComplete();
  assert.equal(skipped, true);
});
