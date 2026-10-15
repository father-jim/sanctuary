export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (email: string): boolean => email.length <= 254 && EMAIL_PATTERN.test(email);
