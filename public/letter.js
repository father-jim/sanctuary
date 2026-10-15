// Builds the erasure request a person sends to a service's privacy team.

const LAWS = {
  gdpr: {
    basis: 'Article 17 of the General Data Protection Regulation (GDPR)',
    deadline: 'Under Article 12(3) of the GDPR, please respond without undue delay and within one month of receiving this request.',
    days: 30,
  },
  ccpa: {
    basis: 'the California Consumer Privacy Act (Cal. Civ. Code § 1798.105)',
    deadline: 'Under the CCPA, please respond within 45 days of receiving this request.',
    days: 45,
  },
  general: {
    basis: 'applicable data protection law',
    deadline: 'I would appreciate a response within 30 days.',
    days: 30,
  },
};

/** Days a service has to answer, used for the follow-up reminder. */
export const responseDays = (law) => (LAWS[law] ?? LAWS.general).days;

export function buildLetter({ service, email, law = 'gdpr', name = '' }) {
  const { basis, deadline } = LAWS[law] ?? LAWS.general;
  const signature = name.trim() || email;
  const subject = `Request to erase personal data: ${email}`;
  const body = `Hello ${service} privacy team,

I am asking ${service} to erase all personal data it holds about me, under ${basis}. Your records are linked to this email address: ${email}

Please:
1. Close any account registered to this email address and delete all personal data linked to it, including data held by your processors and anyone you have shared it with.
2. Remove this email address from all marketing and mailing lists.
3. Confirm in writing when the erasure is complete.
4. If you keep any of my data, tell me which data, and the legal grounds for keeping it.

${deadline}

You can verify this request by replying to this email address. Please do not ask for more personal information than you need to do that.

Thank you,
${signature}
`;
  return { subject, body };
}

export function mailtoUrl(to, { subject, body }) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
