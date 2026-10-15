// IMAP connection details for common mail providers, keyed by the domain in
// the address. Most of these require an app-specific password rather than your
// normal one; `help` links to where you create it.

export interface Provider {
  name: string;
  host: string;
  port: number;
  /** Where to create an app password, when the provider needs one. */
  help?: string;
  note?: string;
}

const PROVIDERS: Record<string, Provider> = {
  'gmail.com': {
    name: 'Gmail',
    host: 'imap.gmail.com',
    port: 993,
    help: 'https://myaccount.google.com/apppasswords',
    note: 'Needs an app password with 2-step verification turned on.',
  },
  'googlemail.com': { name: 'Gmail', host: 'imap.gmail.com', port: 993, help: 'https://myaccount.google.com/apppasswords' },
  'outlook.com': {
    name: 'Outlook',
    host: 'outlook.office365.com',
    port: 993,
    help: 'https://account.microsoft.com/security',
    note: 'Needs an app password if two-step verification is on.',
  },
  'hotmail.com': { name: 'Outlook', host: 'outlook.office365.com', port: 993, help: 'https://account.microsoft.com/security' },
  'live.com': { name: 'Outlook', host: 'outlook.office365.com', port: 993, help: 'https://account.microsoft.com/security' },
  'icloud.com': {
    name: 'iCloud Mail',
    host: 'imap.mail.me.com',
    port: 993,
    help: 'https://support.apple.com/en-us/102654',
    note: 'Requires an app-specific password from appleid.apple.com.',
  },
  'me.com': { name: 'iCloud Mail', host: 'imap.mail.me.com', port: 993, help: 'https://support.apple.com/en-us/102654' },
  'yahoo.com': {
    name: 'Yahoo Mail',
    host: 'imap.mail.yahoo.com',
    port: 993,
    help: 'https://help.yahoo.com/kb/SLN15241.html',
    note: 'Requires an app password from your Yahoo account security page.',
  },
  'aol.com': { name: 'AOL Mail', host: 'imap.aol.com', port: 993, help: 'https://help.aol.com/articles/Create-and-manage-app-password' },
  'fastmail.com': {
    name: 'Fastmail',
    host: 'imap.fastmail.com',
    port: 993,
    help: 'https://www.fastmail.help/hc/en-us/articles/360058752854',
    note: 'Create an app password with IMAP access in Settings → Privacy & Security.',
  },
  'proton.me': {
    name: 'Proton Mail',
    host: '127.0.0.1',
    port: 1143,
    note: 'Proton needs the local Proton Mail Bridge app; use the address and password it gives you.',
  },
  'protonmail.com': { name: 'Proton Mail', host: '127.0.0.1', port: 1143, note: 'Requires Proton Mail Bridge running locally.' },
};

export function providerForEmail(email: string): Provider | undefined {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? PROVIDERS[domain] : undefined;
}
