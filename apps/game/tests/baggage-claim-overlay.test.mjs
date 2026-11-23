import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BaggageClaimOverlay } from '../src/features/onboarding/BaggageClaimOverlay.tsx';

function collectElements(node, predicate, results = []) {
  if (!node || typeof node !== 'object') return results;
  if (Array.isArray(node)) {
    for (const child of node) collectElements(child, predicate, results);
    return results;
  }
  if (predicate(node)) results.push(node);
  if (node.props && 'children' in node.props) {
    collectElements(node.props.children, predicate, results);
  }
  return results;
}

test('BaggageClaimOverlay renders unclaimed state with claim button and error alert', () => {
  const html = renderToStaticMarkup(
    createElement(BaggageClaimOverlay, {
      claiming: false,
      claimed: false,
      error: 'Network timeout',
      onClaim: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /Collect Your Baggage/);
  assert.match(html, /Claim Baggage \(\$500\)/);
  assert.match(html, /Later/);
  assert.match(html, /Network timeout/);
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-label="Close baggage claim"/);
});

test('BaggageClaimOverlay renders claiming state with disabled button', () => {
  const html = renderToStaticMarkup(
    createElement(BaggageClaimOverlay, {
      claiming: true,
      claimed: false,
      onClaim: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /Claiming…/);
  assert.match(html, /disabled=""/);
});

test('BaggageClaimOverlay renders claimed celebration with coinsGranted and Continue button', () => {
  const html = renderToStaticMarkup(
    createElement(BaggageClaimOverlay, {
      claiming: false,
      claimed: true,
      coinsGranted: 500,
      onClaim: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /Baggage Claimed!/);
  assert.match(html, /Starter Funds Received/);
  assert.match(html, /\+\$500/);
  assert.match(html, /Continue/);
});

test('BaggageClaimOverlay uses semantic color variables and no hex literals', () => {
  const html = renderToStaticMarkup(
    createElement(BaggageClaimOverlay, {
      claiming: false,
      claimed: true,
      coinsGranted: 500,
      onClaim: () => {},
      onClose: () => {},
    }),
  );

  assert.match(html, /var\(--color-card\)/);
  assert.match(html, /var\(--color-ink\)/);
  assert.match(html, /var\(--color-success-surface\)/);
  assert.match(html, /var\(--color-green\)/);
  assert.doesNotMatch(html, /#[0-9a-fA-F]{3,8}/);
});

test('BaggageClaimOverlay wires onClaim and onClose callbacks to buttons', () => {
  let claimCalls = 0;
  let closeCalls = 0;

  const unclaimedTree = BaggageClaimOverlay({
    claiming: false,
    claimed: false,
    onClaim: () => {
      claimCalls += 1;
    },
    onClose: () => {
      closeCalls += 1;
    },
  });

  const buttons = collectElements(unclaimedTree, (el) => el.type === 'button');
  const claimBtn = buttons.find((b) => String(b.props.children).includes('Claim Baggage'));
  const laterBtn = buttons.find((b) => b.props.children === 'Later');
  const closeBtn = buttons.find((b) => b.props['aria-label'] === 'Close baggage claim');

  assert.ok(claimBtn, 'Expected Claim Baggage button');
  assert.ok(laterBtn, 'Expected Later button');
  assert.ok(closeBtn, 'Expected Close button');

  claimBtn.props.onClick();
  laterBtn.props.onClick();
  closeBtn.props.onClick();

  assert.equal(claimCalls, 1);
  assert.equal(closeCalls, 2);

  const claimedTree = BaggageClaimOverlay({
    claiming: false,
    claimed: true,
    coinsGranted: 500,
    onClaim: () => {},
    onClose: () => {
      closeCalls += 1;
    },
  });
  const claimedButtons = collectElements(claimedTree, (el) => el.type === 'button');
  const continueBtn = claimedButtons.find((b) => b.props.children === 'Continue');
  assert.ok(continueBtn, 'Expected Continue button in claimed state');
  continueBtn.props.onClick();
  assert.equal(closeCalls, 3);
});
