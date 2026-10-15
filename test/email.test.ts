import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmail, normalizeEmail } from '../src/email.ts';
import { providerForEmail } from '../src/providers.ts';

test('isEmail accepts and rejects', () => {
  assert.ok(isEmail('you@example.com'));
  assert.ok(!isEmail('nope'));
  assert.ok(!isEmail('a@b'));
  assert.ok(!isEmail('a @b.com'));
  assert.ok(!isEmail(`${'a'.repeat(250)}@example.com`));
});

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  You@Example.COM '), 'you@example.com');
});

test('providerForEmail resolves known hosts', () => {
  assert.equal(providerForEmail('me@gmail.com')?.host, 'imap.gmail.com');
  assert.equal(providerForEmail('me@icloud.com')?.port, 993);
  assert.equal(providerForEmail('me@self-hosted.example'), undefined);
});
