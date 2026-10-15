// Each probe asks a site's own signup, login or profile endpoint whether an
// email is registered. These are undocumented and change without notice; run
// `npm run check-probes` with an address you know is registered to see which
// still work.

import { createHash } from 'node:crypto';
import { metaCsrfToken } from '../http.ts';
import { found, notFound, unexpected, unknown, type Probe } from './types.ts';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const probes: Probe[] = [
  {
    id: 'gravatar',
    async check(email, http) {
      const res = await http.get(`https://api.gravatar.com/v3/profiles/${sha256(email)}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.status === 200) return found(res.json?.profile_url);
      if (res.status === 404) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'wordpress',
    async check(email, http) {
      const res = await http.get(
        `https://public-api.wordpress.com/rest/v1.1/users/${encodeURIComponent(email)}/auth-options`,
        { query: { http_envelope: '1' } },
      );
      const body = res.json?.body;
      if (body && 'email_verified' in body) return found();
      if (body?.error === 'unknown_user') return notFound();
      if (body?.error) return unknown(`Site replied “${body.error}”`);
      return unexpected(res.status);
    },
  },
  {
    id: 'spotify',
    async check(email, http) {
      const res = await http.get('https://spclient.wg.spotify.com/signup/public/v1/account', {
        query: { validate: '1', email },
        headers: { Accept: 'application/json' },
      });
      if (res.json?.status === 20) return found();
      if (res.json?.status === 1) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'pinterest',
    async check(email, http) {
      const res = await http.get('https://www.pinterest.com/_ngjs/resource/EmailExistsResource/get/', {
        query: { source_url: '/', data: JSON.stringify({ options: { email }, context: {} }) },
      });
      const data = res.json?.resource_response?.data;
      if (data === true) return found();
      if (data === false) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'github',
    async check(email, http) {
      const page = await http.get('https://github.com/signup');
      const token = /<auto-check[^>]+src="\/signup_check\/email"[\s\S]*?value="([^"]+)"/.exec(page.text)?.[1];
      if (!token) return unknown('Could not read the signup form token');
      const res = await http.post('https://github.com/signup_check/email', {
        form: { value: email, authenticity_token: token },
        headers: { Origin: 'https://github.com', Referer: 'https://github.com/signup' },
      });
      if (res.text.includes('did something unexpected')) return unknown('Blocked by the site’s bot protection');
      if (res.status === 422) return found();
      if (res.status === 200) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'mozilla',
    async check(email, http) {
      const res = await http.post('https://api.accounts.firefox.com/v1/account/status', { json: { email } });
      if (res.json?.exists === true) return found();
      if (res.json?.exists === false) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'lastpass',
    async check(email, http) {
      const res = await http.get('https://lastpass.com/create_account.php', {
        query: { check: 'avail', skipcontent: '1', mistype: '1', username: email },
        headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://lastpass.com/' },
      });
      const text = res.text.trim();
      if (text === 'no') return found();
      if (text === 'ok' || text === 'emailinvalid') return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'eventbrite',
    async check(email, http) {
      await http.get('https://www.eventbrite.com/signin/');
      const csrf = http.cookie('csrftoken');
      if (!csrf) return unknown('Could not get a session token');
      const res = await http.post('https://www.eventbrite.com/api/v3/users/lookup/', {
        json: { email },
        headers: {
          'X-CSRFToken': csrf,
          'X-Requested-With': 'XMLHttpRequest',
          Origin: 'https://www.eventbrite.com',
          Referer: 'https://www.eventbrite.com/signin/',
        },
      });
      if (res.json?.exists === true) return found();
      if (res.json?.exists === false) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'strava',
    async check(email, http) {
      const page = await http.get('https://www.strava.com/register/free');
      const token = metaCsrfToken(page.text);
      if (!token) return unknown('Could not read the signup form token');
      const res = await http.get('https://www.strava.com/athletes/email_unique', {
        query: { email },
        headers: { 'X-CSRF-Token': token, 'X-Requested-With': 'XMLHttpRequest' },
      });
      const text = res.text.trim();
      if (text === 'false') return found();
      if (text === 'true') return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'codecademy',
    async check(email, http) {
      const page = await http.get('https://www.codecademy.com/register');
      const token = metaCsrfToken(page.text);
      if (!token) return unknown('Could not read the signup form token');
      const res = await http.post('https://www.codecademy.com/register/validate', {
        json: { user: { email } },
        headers: { 'X-CSRF-Token': token, Accept: 'application/json', Origin: 'https://www.codecademy.com' },
      });
      if (res.text.includes('already taken')) return found();
      if (res.json && (res.status === 200 || res.status === 422)) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'codepen',
    async check(email, http) {
      const page = await http.get('https://codepen.io/accounts/signup/user/free');
      const token = metaCsrfToken(page.text);
      if (!token) return unknown('Could not read the signup form token');
      const res = await http.post('https://codepen.io/accounts/duplicate_check', {
        form: { attribute: 'email', value: email, context: 'user' },
        headers: { 'X-CSRF-Token': token, 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://codepen.io' },
      });
      if (res.text.includes('already taken')) return found();
      if (res.status === 200) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'replit',
    async check(email, http) {
      const res = await http.post('https://replit.com/data/user/exists', {
        json: { email },
        headers: { 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://replit.com', Accept: 'application/json' },
      });
      if (res.json?.exists === true) return found();
      if (res.json?.exists === false) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'freelancer',
    async check(email, http) {
      const res = await http.post('https://www.freelancer.com/api/users/0.1/users/check', {
        query: { compact: 'true', new_errors: 'true' },
        json: { user: { email } },
        headers: { Origin: 'https://www.freelancer.com', Accept: 'application/json' },
      });
      if (res.status === 409 && res.text.includes('EMAIL_ALREADY_IN_USE')) return found();
      if (res.status === 200 && res.json) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'flickr',
    async check(email, http) {
      const res = await http.get('https://identity-api.flickr.com/migration', {
        query: { email },
        headers: { Origin: 'https://identity.flickr.com', Referer: 'https://identity.flickr.com/login' },
      });
      const code = res.json?.state_code;
      if (code === '5') return found();
      if (code !== undefined) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'imgur',
    async check(email, http) {
      await http.get('https://imgur.com/register');
      const res = await http.post('https://imgur.com/signin/ajax_email_available', {
        form: { email },
        headers: { 'X-Requested-With': 'XMLHttpRequest', Origin: 'https://imgur.com' },
      });
      const available = res.json?.data?.available;
      if (available === false) return found();
      if (available === true) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'patreon',
    async check(email, http) {
      const res = await http.post('https://www.patreon.com/api/email/available', {
        query: { 'json-api-version': '1.0' },
        json: { data: { attributes: { email }, relationships: {} } },
        headers: { 'Content-Type': 'application/vnd.api+json', Origin: 'https://www.patreon.com' },
      });
      const available = res.json?.data?.is_available;
      if (available === false) return found();
      if (available === true) return notFound();
      return unexpected(res.status);
    },
  },
  {
    id: 'lastfm',
    async check(email, http) {
      await http.get('https://www.last.fm/join');
      const csrf = http.cookie('csrftoken');
      if (!csrf) return unknown('Could not get a session token');
      const res = await http.post('https://www.last.fm/join/partial/validate', {
        form: { csrfmiddlewaretoken: csrf, userName: '', email },
        headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://www.last.fm/join' },
      });
      const field = res.json?.email;
      if (!field) return unexpected(res.status);
      const errors: string[] = field.error_messages ?? [];
      if (errors.some((m) => m.includes('already registered'))) return found();
      return notFound();
    },
  },
  {
    id: 'duolingo',
    async check(email, http) {
      const res = await http.get('https://www.duolingo.com/2017-06-30/users', {
        query: { email },
        headers: { Accept: 'application/json' },
      });
      const users = res.json?.users;
      if (!Array.isArray(users)) return unexpected(res.status);
      if (users.length === 0) return notFound();
      return found(users[0]?.username ? `Username: ${users[0].username}` : undefined);
    },
  },
  {
    id: 'chesscom',
    async check(email, http) {
      const res = await http.get('https://www.chess.com/callback/email/available', {
        query: { email },
        headers: { Accept: 'application/json' },
      });
      const available = res.json?.isEmailAvailable;
      if (available === false) return found();
      if (available === true) return notFound();
      return unexpected(res.status);
    },
  },
];
