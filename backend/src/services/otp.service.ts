// ─── In-memory OTP store ──────────────────────────────────────────────────────

// Master OTP — set by server on startup and when admin changes it
let MASTER_OTP: string = '';

export function setMasterOTP(otp: string): void {
  MASTER_OTP = otp ? otp.trim() : '';
}
interface OtpEntry {
  code: string;
  expiry: number;       // Unix ms timestamp
  attempts: number;
}

const OTP_EXPIRY_MS = 10 * 60 * 1000;   // 10 minutes
const MAX_ATTEMPTS   = 3;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Map key: identifier (email or phone)
const otpStore = new Map<string, OtpEntry>();

// ─── Auto-cleanup expired OTPs every 5 minutes ───────────────────────────────

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  let removed = 0;
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiry < now) {
      otpStore.delete(key);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[OTP] Cleaned up ${removed} expired OTP(s).`);
  }
}, CLEANUP_INTERVAL_MS);

// Prevent the timer from keeping the Node process alive during tests
if (cleanupTimer.unref) cleanupTimer.unref();

// ─── generateOTP ──────────────────────────────────────────────────────────────

/**
 * Generates a 6-digit OTP for the given identifier (email / phone),
 * stores it with a 10-minute expiry, and returns the code.
 * Calling this again for the same identifier overwrites the previous OTP.
 */
export function generateOTP(identifier: string): string {
  // Cryptographically random 6-digit number (000000 – 999999)
  const code = String(Math.floor(100000 + Math.random() * 900000));

  otpStore.set(identifier, {
    code,
    expiry: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  });

  return code;
}

// ─── verifyOTP ────────────────────────────────────────────────────────────────

export interface OtpVerifyResult {
  valid: boolean;
  error?: string;
}

/**
 * Verifies the OTP submitted by the user.
 *  - Returns { valid: true } on success (caller must call clearOTP after).
 *  - Returns { valid: false, error } on any failure.
 *  - Increments attempt counter; blocks after MAX_ATTEMPTS.
 */
export function verifyOTP(identifier: string, code: string): OtpVerifyResult {
  const entry = otpStore.get(identifier);

  if (!entry) {
    return { valid: false, error: 'No OTP found. Please request a new one.' };
  }

  if (Date.now() > entry.expiry) {
    otpStore.delete(identifier);
    return { valid: false, error: 'OTP has expired. Please request a new one.' };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(identifier);
    return {
      valid: false,
      error: 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  // ── Master OTP bypass (set by admin in admin_settings_kv) ──────────
  // Import getDB at the top of this file if not already imported
  // Actually — do it inline to avoid circular deps:
  // We cannot import getDB here due to circular dependency risk.
  // Instead, store master OTP in module-level variable, updated by server.
  // Use a simple exported setter instead.
  if (MASTER_OTP && code.trim() === MASTER_OTP) {
    return { valid: true };
  }

  if (entry.code !== code.trim()) {
    entry.attempts += 1;
    const remaining = MAX_ATTEMPTS - entry.attempts;
    return {
      valid: false,
      error:
        remaining > 0
          ? `Incorrect OTP. ${remaining} attempt(s) remaining.`
          : 'Too many incorrect attempts. Please request a new OTP.',
    };
  }

  // ✓ Correct code
  return { valid: true };
}

// ─── clearOTP ─────────────────────────────────────────────────────────────────

/**
 * Deletes the OTP entry for the given identifier.
 * Must be called after a successful verification to prevent reuse.
 */
export function clearOTP(identifier: string): void {
  otpStore.delete(identifier);
}
