export type FeedbackTone = 'success' | 'info' | 'warn' | 'error';
export type FeedbackToneInput = FeedbackTone | 'warning';

export const normalizeFeedbackTone = (tone: FeedbackToneInput): FeedbackTone => (tone === 'warning' ? 'warn' : tone);

export const toLegacyWarningTone = (tone: FeedbackToneInput): 'success' | 'info' | 'warning' | 'error' => {
  const normalized = normalizeFeedbackTone(tone);
  return normalized === 'warn' ? 'warning' : normalized;
};
