/**
 * The emailed sign-in code.
 *
 * Its length is a Supabase project setting (Auth → Sign In / Providers → email
 * OTP length), not a fixed six. Hardcoding a length means the box rejects a
 * perfectly good code the moment that setting differs, so this accepts any
 * plausible length and lets the server decide whether the code is real.
 */
export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 10;

/** Strips whatever a person pasted down to the digits. */
export function normalizeSignInCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, MAX_CODE_LENGTH);
}

/** Whether the code is worth sending to the server at all. */
export function isPlausibleSignInCode(code: string): boolean {
  const digits = normalizeSignInCode(code);
  return digits.length >= MIN_CODE_LENGTH && digits.length === code.replace(/\D/g, "").length;
}
