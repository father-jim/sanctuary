import { test } from 'node:test';
import assert from 'node:assert/strict';
import { domainFromAddress, matchService, registrableDomain } from '../src/match.ts';

test('registrableDomain strips subdomains', () => {
  assert.equal(registrableDomain('notifications.github.com'), 'github.com');
  assert.equal(registrableDomain('e.spotify.com'), 'spotify.com');
  assert.equal(registrableDomain('spotify.com'), 'spotify.com');
});

test('registrableDomain keeps three labels for known multi-label suffixes', () => {
  assert.equal(registrableDomain('mail.example.co.uk'), 'example.co.uk');
  assert.equal(registrableDomain('example.co.uk'), 'example.co.uk');
});

test('domainFromAddress extracts the domain', () => {
  assert.equal(domainFromAddress('no-reply@e.spotify.com'), 'e.spotify.com');
  assert.equal(domainFromAddress('bad-address'), undefined);
});

test('matchService maps a sender to a directory service', () => {
  assert.equal(matchService('no-reply@notifications.github.com')?.id, 'github');
  assert.equal(matchService('news@e.spotify.com')?.id, 'spotify');
});

test('matchService returns undefined for unknown senders', () => {
  assert.equal(matchService('hello@some-random-shop.example'), undefined);
});
