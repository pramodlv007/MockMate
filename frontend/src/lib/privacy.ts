import type { User } from '../api';

/** Change this date whenever the privacy notice changes in a way people must agree to again. */
export const PRIVACY_UPDATED = '2026-11-12';
export const PRIVACY_CONTACT = 'mockmate.site@gmail.com';

/** True until the user has accepted the current notice (Google sign-ups and older accounts never did). */
export const needsPrivacyConsent = (user: User | null) =>
    !!user && !(user.privacy_accepted_at && user.privacy_accepted_at >= PRIVACY_UPDATED);
