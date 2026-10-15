import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLetter, mailtoUrl, responseDays } from '../public/letter.js';

test('buildLetter includes the email and cites the chosen law', () => {
  const { subject, body } = buildLetter({ service: 'Spotify', email: 'you@example.com', law: 'gdpr' });
  assert.match(subject, /you@example\.com/);
  assert.match(body, /Spotify/);
  assert.match(body, /GDPR/);
  assert.match(body, /you@example\.com/);
});

test('buildLetter falls back to the email when no name is given', () => {
  const withName = buildLetter({ service: 'X', email: 'you@example.com', name: 'Jo Doe' });
  assert.match(withName.body, /Jo Doe/);
  const without = buildLetter({ service: 'X', email: 'you@example.com' });
  assert.match(without.body, /you@example\.com\n$/);
});

test('responseDays reflects the law', () => {
  assert.equal(responseDays('ccpa'), 45);
  assert.equal(responseDays('gdpr'), 30);
  assert.equal(responseDays('unknown'), 30);
});

test('mailtoUrl encodes subject and body', () => {
  const url = mailtoUrl('privacy@x.com', { subject: 'a b', body: 'c&d' });
  assert.match(url, /^mailto:privacy@x\.com\?subject=a%20b&body=c%26d$/);
});
