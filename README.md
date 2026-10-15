# Sanctuary

A local tool to clean up your online presence. Enter your email, see the
services it's tied to, and remove yourself from them one at a time.

Everything runs on your own computer. Your email password is used once for a
scan and never stored; nothing is sent anywhere except directly to your own
mail provider and the sites you choose to open.

## Run it

Needs Node.js 22.18 or newer (it runs TypeScript directly, no build step).

```sh
npm install
npm start
```

Then open <http://localhost:4545>.

## Finding your accounts

**Scan my inbox** — connect your mailbox read-only. Sanctuary reads only the
*senders* of your mail (never message contents) and matches them to services
you can leave. This finds the most, and because it needs to sign into your
mailbox it only works for an address that's actually yours.

Most providers require an **app password** rather than your normal password:

| Provider | App password |
| --- | --- |
| Gmail | <https://myaccount.google.com/apppasswords> (needs 2-step verification) |
| Outlook / Hotmail | <https://account.microsoft.com/security> |
| iCloud | <https://support.apple.com/en-us/102654> |
| Yahoo | <https://help.yahoo.com/kb/SLN15241.html> |
| Fastmail | Settings → Privacy & Security → App passwords |
| Proton Mail | Use Proton Mail Bridge; point the host at `127.0.0.1` |

Other providers: open **Mail server settings** and enter your IMAP host and port.

**Pick from a list** — don't want to connect your mailbox? Tick the services
you know you use and work through them manually.

## Removing yourself

Each matched service gets a card with:

- a direct link to its account-deletion page, with the steps to follow;
- a **Write erasure request** button that drafts a GDPR or CCPA data-deletion
  request filled in with your email, ready to send to the service's privacy
  contact;
- a status dropdown (To do → Removed) so you can track your progress. Status is
  saved in your browser per email address. **Export checklist** saves it as a
  text file.

## Keeping the data current

Deletion pages and privacy contacts move. The service directory lives in
[`src/directory.ts`](src/directory.ts); each entry records the month it was
last checked by hand. Sender-to-service matching is in
[`src/match.ts`](src/match.ts).

## Tests

```sh
npm test         # unit tests
npm run typecheck
```

## A note on limits

Sanctuary points you at the right place and drafts the request; it doesn't log
into services or click delete for you. That keeps you in control of
irreversible actions, and means a site changing its layout can't make the tool
do the wrong thing. Sender matching covers the services in the directory — an
email from a service that isn't listed shows up under **Other senders** with a
search link instead of guided steps.
