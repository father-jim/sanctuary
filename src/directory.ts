// Where to go to leave each service. Deletion pages and privacy contacts move;
// `reviewed` records when an entry was last checked by hand. Only list a
// privacy email when the service's own policy publishes it, otherwise link
// the request form or policy so nobody mails personal data to a dead inbox.

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Service {
  id: string;
  name: string;
  domain: string;
  category: string;
  deletion: {
    url: string;
    /** What to click once the page is open. */
    steps: string;
    difficulty: Difficulty;
  };
  privacy: {
    /** Inbox for erasure requests, when the service publishes one. */
    email?: string;
    /** Request form, or the policy page that names the right channel. */
    url: string;
  };
  notes?: string;
  reviewed: string;
}

export const directory: Service[] = [
  {
    id: 'gravatar',
    name: 'Gravatar',
    domain: 'gravatar.com',
    category: 'Identity',
    deletion: {
      url: 'https://wordpress.com/me/account/close',
      steps: 'Gravatar runs on WordPress.com accounts. Close the account to remove the profile and avatar.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://automattic.com/privacy/' },
    notes: 'Your public avatar is shown by any site that uses Gravatar, even after you stop using them.',
    reviewed: '2026-10',
  },
  {
    id: 'wordpress',
    name: 'WordPress.com',
    domain: 'wordpress.com',
    category: 'Publishing',
    deletion: {
      url: 'https://wordpress.com/me/account/close',
      steps: 'Delete or transfer any sites first, then choose “Close account”.',
      difficulty: 'medium',
    },
    privacy: { url: 'https://automattic.com/privacy/' },
    reviewed: '2026-10',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    domain: 'spotify.com',
    category: 'Music',
    deletion: {
      url: 'https://support.spotify.com/article/close-account/',
      steps: 'Cancel any Premium plan, then follow “Close account” and confirm from the email Spotify sends.',
      difficulty: 'medium',
    },
    privacy: { email: 'privacy@spotify.com', url: 'https://www.spotify.com/legal/privacy-policy/' },
    reviewed: '2026-10',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    domain: 'pinterest.com',
    category: 'Social',
    deletion: {
      url: 'https://www.pinterest.com/settings/account-settings',
      steps: 'Scroll to “Deactivation and deletion” and choose “Delete your data and account”.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://help.pinterest.com/data-protection-officer-contact-form' },
    reviewed: '2026-10',
  },
  {
    id: 'github',
    name: 'GitHub',
    domain: 'github.com',
    category: 'Developer',
    deletion: {
      url: 'https://github.com/settings/admin',
      steps: 'Under “Delete account”, transfer or delete organizations you own, then confirm.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://support.github.com/contact/privacy' },
    notes: 'Commits you pushed to other people’s repositories keep your email after the account is gone.',
    reviewed: '2026-10',
  },
  {
    id: 'mozilla',
    name: 'Mozilla account',
    domain: 'accounts.firefox.com',
    category: 'Software',
    deletion: {
      url: 'https://accounts.firefox.com/settings#delete-account',
      steps: 'Choose “Delete account” at the bottom of the settings page.',
      difficulty: 'easy',
    },
    privacy: { email: 'compliance@mozilla.com', url: 'https://www.mozilla.org/privacy/mozilla-accounts/' },
    reviewed: '2026-10',
  },
  {
    id: 'lastpass',
    name: 'LastPass',
    domain: 'lastpass.com',
    category: 'Security',
    deletion: {
      url: 'https://lastpass.com/delete_account.php',
      steps: 'Export your vault first. Deleting needs your master password, or an email confirmation if you forgot it.',
      difficulty: 'medium',
    },
    privacy: { email: 'privacy@lastpass.com', url: 'https://www.lastpass.com/legal-center/privacy-policy' },
    reviewed: '2026-10',
  },
  {
    id: 'eventbrite',
    name: 'Eventbrite',
    domain: 'eventbrite.com',
    category: 'Events',
    deletion: {
      url: 'https://www.eventbrite.com/account-close/',
      steps: 'Pick a reason, type “CLOSE” and confirm with your password.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://www.eventbrite.com/help/en-us/articles/460838/eventbrite-privacy-policy/' },
    reviewed: '2026-10',
  },
  {
    id: 'strava',
    name: 'Strava',
    domain: 'strava.com',
    category: 'Fitness',
    deletion: {
      url: 'https://www.strava.com/account',
      steps: 'Choose “Delete Your Account” at the bottom of My Account. You can download your data first.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://www.strava.com/legal/privacy' },
    reviewed: '2026-10',
  },
  {
    id: 'codecademy',
    name: 'Codecademy',
    domain: 'codecademy.com',
    category: 'Learning',
    deletion: {
      url: 'https://www.codecademy.com/account',
      steps: 'Cancel any Pro plan, then use “Delete account” in account settings.',
      difficulty: 'medium',
    },
    privacy: { url: 'https://www.codecademy.com/policy' },
    reviewed: '2026-10',
  },
  {
    id: 'codepen',
    name: 'CodePen',
    domain: 'codepen.io',
    category: 'Developer',
    deletion: {
      url: 'https://codepen.io/settings/account',
      steps: 'Scroll to “Delete Account” and confirm.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://blog.codepen.io/documentation/privacy/' },
    reviewed: '2026-10',
  },
  {
    id: 'replit',
    name: 'Replit',
    domain: 'replit.com',
    category: 'Developer',
    deletion: {
      url: 'https://replit.com/account',
      steps: 'Cancel any paid plan, then use “Delete account” under Danger zone.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://replit.com/privacy-policy' },
    reviewed: '2026-10',
  },
  {
    id: 'freelancer',
    name: 'Freelancer',
    domain: 'freelancer.com',
    category: 'Work',
    deletion: {
      url: 'https://www.freelancer.com/users/settings',
      steps: 'Under Account, choose “Close account”. Settle any open projects and balances first.',
      difficulty: 'hard',
    },
    privacy: { url: 'https://www.freelancer.com/about/privacy' },
    reviewed: '2026-10',
  },
  {
    id: 'flickr',
    name: 'Flickr',
    domain: 'flickr.com',
    category: 'Photos',
    deletion: {
      url: 'https://www.flickr.com/account/delete',
      steps: 'Download your photos first. Deleting removes every photo for good.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://www.flickr.com/help/privacy' },
    reviewed: '2026-10',
  },
  {
    id: 'imgur',
    name: 'Imgur',
    domain: 'imgur.com',
    category: 'Photos',
    deletion: {
      url: 'https://imgur.com/account/settings',
      steps: 'Choose “Delete account” at the bottom of the settings page.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://imgur.com/privacy' },
    reviewed: '2026-10',
  },
  {
    id: 'patreon',
    name: 'Patreon',
    domain: 'patreon.com',
    category: 'Creators',
    deletion: {
      url: 'https://www.patreon.com/settings/basics',
      steps: 'End memberships, then use “Delete account” at the bottom of Basics.',
      difficulty: 'medium',
    },
    privacy: { url: 'https://privacy.patreon.com/' },
    reviewed: '2026-10',
  },
  {
    id: 'lastfm',
    name: 'Last.fm',
    domain: 'last.fm',
    category: 'Music',
    deletion: {
      url: 'https://www.last.fm/settings/account',
      steps: 'Choose “Delete account” and confirm with your password.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://www.last.fm/legal/privacy' },
    reviewed: '2026-10',
  },
  {
    id: 'duolingo',
    name: 'Duolingo',
    domain: 'duolingo.com',
    category: 'Learning',
    deletion: {
      url: 'https://drive-thru.duolingo.com/',
      steps: 'Duolingo’s privacy portal handles deletion. Choose “Erase personal data”.',
      difficulty: 'easy',
    },
    privacy: { url: 'https://drive-thru.duolingo.com/' },
    notes: 'Your Duolingo profile, including username, is publicly searchable by email.',
    reviewed: '2026-10',
  },
  {
    id: 'chesscom',
    name: 'Chess.com',
    domain: 'chess.com',
    category: 'Games',
    deletion: {
      url: 'https://www.chess.com/settings/close-account',
      steps: 'Pick “Close account”. Chess.com keeps closed accounts reopenable unless you ask for full deletion.',
      difficulty: 'medium',
    },
    privacy: { url: 'https://www.chess.com/legal/privacy' },
    reviewed: '2026-10',
  },
];

export const serviceById = new Map(directory.map((s) => [s.id, s]));
