import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/features/id-card/use-id-card-photo-flow.tsx', import.meta.url), 'utf8');

test('ID-card review is conversational and has no separate issue button', () => {
  assert.match(source, /send\(label === 'uploaded photo' \? 'Use this photo' : 'Use my character picture',/);
  assert.match(source, /application\?\.mode === 'edit'/);
  assert.match(source, /phase === 'review' \? detectContextIntent\(text, ID_CARD_REVIEW_PROFILE\) : null/);
  assert.match(source, /send\(text, \{ stream: false \}\)/);
  assert.match(source, /await waitForAcknowledgement\(\)/);
  assert.match(source, /setPhase\('reviewing'\)/);
  assert.doesNotMatch(source, /GameButton label=\{confirmationSaved/);
  assert.doesNotMatch(source, /Yes, issue my card.*onClick/);
  assert.doesNotMatch(source, /Selected \{photoLabel\}/);
  assert.match(source, /reviewPhoto\?: ReactNode/);
  assert.match(source, /\.\.\.\(reviewPhoto \? \{ reviewPhoto \} : \{\}\)/);
  assert.match(source, /Uploaded ID card photo preview/);
  assert.match(source, /Character picture preview/);
  assert.doesNotMatch(source, /Issuing your ID card…/);
});

test('the selected photo replaces Review and the summary uses the ID-card review layout', async () => {
  const conversation = await readFile(new URL('../src/features/dialogue/SavedConversation.tsx', import.meta.url), 'utf8');
  const review = await readFile(new URL('../src/features/id-card/IdCardApplicationReview.tsx', import.meta.url), 'utf8');
  assert.match(conversation, /message\.id === selectedPhotoMessageId \? reviewPhoto/);
  assert.match(conversation, /<IdCardApplicationReview text=\{message\.text\} photo=\{reviewPhoto\}/);
  assert.match(conversation, /isPhotoSelectionInput\(state\.retryMessage\.text\) \? reviewPhoto/);
  assert.match(source, /phase === 'review' \|\| phase === 'reviewing'/);
  assert.match(review, /grid-cols-\[6rem_minmax\(0,1fr\)\]/);
  assert.match(review, /grid-cols-\[7rem_minmax\(0,1fr\)\]/);
  assert.match(review, /border-t/);
});

test('Take photo opens a live camera capture instead of a file picker fallback', async () => {
  const camera = await readFile(new URL('../src/features/id-card/IdCardCameraCapture.tsx', import.meta.url), 'utf8');
  assert.match(source, /setPhase\('camera'\)/);
  assert.match(source, /<IdCardCameraCapture onCapture=\{choose\} onCancel=\{clearPreview\}/);
  assert.doesNotMatch(source, /capture="user"/);
  assert.match(camera, /getUserMedia\(\{ video: \{ facingMode: 'user' \}, audio: false \}\)/);
  assert.match(camera, /Camera access is not available in this browser/);
  assert.match(camera, /label="Capture photo"/);
  assert.match(camera, /getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
});

test('ID-card submission skips the redundant refresh before the issue request', async () => {
  const townsperson = await readFile(new URL('../src/features/npcs/TownspersonConversation.tsx', import.meta.url), 'utf8');
  assert.equal(townsperson.match(/if \(!turn\.idCardSubmit\) await onRefresh\(\);/g)?.length, 2);
});

test('ID-card issuance waits for the acknowledgement presentation to finish', async () => {
  const townsperson = await readFile(new URL('../src/features/npcs/TownspersonConversation.tsx', import.meta.url), 'utf8');
  const saved = await readFile(new URL('../src/features/dialogue/use-saved-conversation.ts', import.meta.url), 'utf8');
  assert.match(townsperson, /waitForAcknowledgement/);
  assert.match(townsperson, /onNpcMessagePresented=\{markNpcMessagePresented\}/);
  assert.match(townsperson, /issuingMessageId: photoFlow\.issuingMessageId/);
  assert.match(saved, /if \(lastNpc && !presentationBusy\) onNpcMessagePresented\?\.\(lastNpc\.id\)/);
  assert.match(source, /setIssuingMessageId\(await waitForAcknowledgement\(\)\);[\s\S]*?finishIssue\(\)/);
});

test('ID-card photo edits skip the summary and refresh the player portrait from the signed photo URL', async () => {
  const townsperson = await readFile(new URL('../src/features/npcs/TownspersonConversation.tsx', import.meta.url), 'utf8');
  const conversation = await readFile(new URL('../src/features/dialogue/SavedConversation.tsx', import.meta.url), 'utf8');
  assert.match(source, /application\?\.mode === 'edit'[\s\S]*?await finishIssue\(\)/);
  assert.match(townsperson, /setPlayerPortraitUrl\(result\.photoUrl\)/);
  assert.match(conversation, /playerPortraitUrl \? undefined : playerPortrait\.portraitPosition/);
});

test('issuance uses a spinner attached to the acknowledgement without visible status text', async () => {
  const conversation = await readFile(new URL('../src/features/dialogue/SavedConversation.tsx', import.meta.url), 'utf8');
  const spinner = await readFile(new URL('../src/features/id-card/IdCardIssuingSpinner.tsx', import.meta.url), 'utf8');
  assert.match(conversation, /message\.id === issuingMessageId \? <IdCardIssuingSpinner \/>/);
  assert.match(spinner, /role="status"/);
  assert.match(spinner, /aria-label="Issuing your ID card"/);
  assert.match(spinner, /animate-spin/);
  assert.doesNotMatch(spinner, />Issuing your ID card/);
});
