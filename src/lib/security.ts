// ──────────────────────────────────────────────
// Security & Compliance Infrastructure
// GDPR, OWASP Top 10, Encryption, Audit Logging, PCI DSS
// ──────────────────────────────────────────────

import crypto from 'crypto';

// ──────────────────────────────────────────────
// AES-256-GCM Encryption for PII at Rest
// ──────────────────────────────────────────────

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string): string {
  if (!text) return text;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  const parts = encryptedText.split(':');
  if (parts.length !== 3) return encryptedText;
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// PII fields that must be encrypted at rest
const PII_FIELDS = ['phone', 'email', 'aadhaar_number', 'pan_number'];

export function encryptPII(data: Record<string, any>): Record<string, any> {
  const encrypted = { ...data };
  for (const field of PII_FIELDS) {
    if (encrypted[field] && !isEncrypted(encrypted[field])) {
      encrypted[field] = encrypt(String(encrypted[field]));
    }
  }
  return encrypted;
}

export function decryptPII(data: Record<string, any>): Record<string, any> {
  if (!data) return data;
  const decrypted = { ...data };
  for (const field of PII_FIELDS) {
    if (decrypted[field] && isEncrypted(decrypted[field])) {
      try {
        decrypted[field] = decrypt(decrypted[field]);
      } catch {
        // If decryption fails, return as-is (might not be encrypted)
      }
    }
  }
  return decrypted;
}

function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.split(':').length === 3 && value.split(':').every(p => /^[0-9a-f]+$/i.test(p));
}

// ──────────────────────────────────────────────
// Input Sanitization (OWASP A03: Injection)
// ──────────────────────────────────────────────

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript\s*:/gi,
  /\bon(click|load|error|mouseover|mouseout|focus|blur|submit|change|keyup|keydown|input)\s*=/gi,
  /data\s*:\s*text\/html/gi,
  /vbscript\s*:/gi,
  /expression\s*\(/gi,
  /url\s*\(\s*javascript/gi,
];

const SQL_INJECTION_PATTERNS = [
  /(\bUNION\b\s+(ALL\s+)?SELECT\b)/gi,
  /(\bOR\b\s+1\s*=\s*1)/gi,
  /(\bAND\b\s+1\s*=\s*1)/gi,
  /('\s*(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  /(\bDROP\s+(TABLE|DATABASE)\b)/gi,
  /(\bEXEC(UTE)?\s*\()/gi,
  /(;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)\b)/gi,
  /(--\s*$)/gm,
  /(\bxp_|\bsp_)/gi,
  /(\bCHAR\s*\(\d+\))/gi,
  /(\bCONCAT\s*\()/gi,
  /(\bBENCHMARK\s*\()/gi,
  /(\bSLEEP\s*\(\d+\))/gi,
];

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    let sanitized = input;
    // Remove XSS patterns
    for (const pattern of XSS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    // Trim
    sanitized = sanitized.trim();
    return sanitized;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      sanitized[sanitizeInput(key)] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}

export function detectSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const combined = input;
  for (const pattern of SQL_INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(combined)) return true;
  }
  return false;
}

// ──────────────────────────────────────────────
// Security Headers (OWASP A05: Security Misconfiguration)
// ──────────────────────────────────────────────

export function getSecurityHeaders(): Record<string, string> {
  const isDev = process.env.NODE_ENV !== 'production';
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https: http:; connect-src 'self' ws: wss: http: https:; frame-ancestors 'self';",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self)',
  };
  // HSTS must NEVER be sent over plain HTTP — it causes browsers to
  // permanently redirect to HTTPS and break local development.
  // Only set it in production where HTTPS is guaranteed.
  if (!isDev) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }
  return headers;
}

// ──────────────────────────────────────────────
// GDPR Compliance
// ──────────────────────────────────────────────

export interface ConsentRecord {
  user_id: string;
  consent_type: string;
  consent_given: boolean;
  consent_text: string;
  ip_address: string;
  user_agent: string;
  given_at: string;
  withdrawn_at?: string;
}

export interface DataExportRequest {
  user_id: string;
  requested_at: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  download_url?: string;
  completed_at?: string;
}

export interface DataDeletionRequest {
  user_id: string;
  requested_at: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  scheduled_deletion_at?: string;
  completed_at?: string;
  cancellation_reason?: string;
}

// GDPR data categories that can be exported
export const GDPR_DATA_CATEGORIES = {
  profile: 'Personal profile data',
  education: 'Education & career information',
  family: 'Family details',
  lifestyle: 'Lifestyle preferences',
  horoscope: 'Horoscope details',
  preferences: 'Partner preferences',
  photos: 'Uploaded photographs',
  interests: 'Interest/sent interests',
  messages: 'Chat messages',
  payments: 'Payment & billing history',
  verification: 'Verification documents',
  settings: 'Account settings',
  consents: 'Consent records',
  audit_log: 'Activity audit log',
};

// Right to be forgotten - data to anonymize/delete
export function anonymizeUserData(profile: Record<string, any>): Record<string, any> {
  return {
    ...profile,
    first_name: 'DELETED',
    last_name: 'USER',
    email: `deleted-${(profile?.id || '')}@anonymized.com`,
    phone: null,
    date_of_birth: null,
    profile_photo_url: null,
    about_me: null,
    aadhaar_number: null,
    pan_number: null,
    is_active: false,
    is_verified: false,
    gdpr_deleted: true,
    gdpr_deleted_at: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────
// Audit Logging (OWASP A09: Security Logging)
// ──────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actor_id: string;
  actor_ip: string;
  actor_user_agent: string;
  resource_type: string;
  resource_id: string;
  details: string;
  severity: 'info' | 'warn' | 'error' | 'critical';
}

const auditLogs: AuditLogEntry[] = [];
const MAX_AUDIT_LOGS = 10000;

export function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
  const log: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogs.push(log);
  if (auditLogs.length > MAX_AUDIT_LOGS) auditLogs.shift();
  return log;
}

export function getAuditLogs(filters?: {
  actor_id?: string;
  action?: string;
  resource_type?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): AuditLogEntry[] {
  let logs = [...auditLogs];
  if (filters) {
    if (filters.actor_id) logs = logs.filter(l => l.actor_id === filters.actor_id);
    if (filters.action) logs = logs.filter(l => l.action === filters.action);
    if (filters.resource_type) logs = logs.filter(l => l.resource_type === filters.resource_type);
    if (filters.severity) logs = logs.filter(l => l.severity === filters.severity);
  }
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const offset = filters?.offset || 0;
  const limit = filters?.limit || 100;
  return logs.slice(offset, offset + limit);
}

// ──────────────────────────────────────────────
// PCI DSS Compliance for Payments
// ──────────────────────────────────────────────

// NEVER store raw card numbers - only tokens and last 4 digits
export function sanitizeCardData(cardData: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  // Only allow safe fields
  if (cardData.last4) sanitized.last4 = String(cardData.last4).slice(-4);
  if (cardData.brand) sanitized.brand = String(cardData.brand);
  if (cardData.expiry_month) sanitized.expiry_month = String(cardData.expiry_month);
  if (cardData.expiry_year) sanitized.expiry_year = String(cardData.expiry_year);
  if (cardData.token) sanitized.token = String(cardData.token);
  if (cardData.gateway) sanitized.gateway = String(cardData.gateway);
  // Explicitly remove dangerous fields
  delete sanitized.card_number;
  delete sanitized.cvv;
  delete sanitized.cvc;
  delete sanitized.full_number;
  return sanitized;
}

// Validate card number is NOT being stored
export function validateNoCardStorage(data: Record<string, any>): boolean {
  const dangerousKeys = ['card_number', 'cvv', 'cvc', 'full_number', 'cardnumber'];
  const stringValues = Object.values(data).map(v => String(v));
  
  for (const key of Object.keys(data)) {
    if (dangerousKeys.includes(key.toLowerCase())) return false;
  }
  
  // Check if any value looks like a card number (16+ digits)
  for (const val of stringValues) {
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && /^\d+$/.test(digitsOnly)) {
      // Could be a card number - reject
      return false;
    }
  }
  
  return true;
}

// ──────────────────────────────────────────────
// Login Security (OWASP A07: Auth Failures)
// ──────────────────────────────────────────────

const loginAttempts: Map<string, { count: number; lockedUntil: number }> = new Map();
const MAX_LOGIN_ATTEMPTS = 20;
const LOCKOUT_DURATION = 2 * 60 * 1000; // 2 minutes

export function checkLoginAttempts(identifier: string): { allowed: boolean; remainingAttempts: number; lockedUntil?: number } {
  const attempts = loginAttempts.get(identifier);
  if (!attempts) {
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
  
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    return { allowed: false, remainingAttempts: 0, lockedUntil: attempts.lockedUntil };
  }
  
  if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
    // Lockout expired, reset
    loginAttempts.delete(identifier);
    return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }
  
  return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count };
}

export function recordLoginAttempt(identifier: string, success: boolean): void {
  if (success) {
    loginAttempts.delete(identifier);
    return;
  }
  
  const attempts = loginAttempts.get(identifier) || { count: 0, lockedUntil: 0 };
  attempts.count++;
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
  }
  
  loginAttempts.set(identifier, attempts);
}

// ──────────────────────────────────────────────
// Password Policy (OWASP A07)
// ──────────────────────────────────────────────

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (password.length > 128) errors.push('Password must be less than 128 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain at least one special character');
  
  // Check common passwords
  const commonPasswords = ['password', '12345678', 'qwerty123', 'Password1!', 'Admin123!'];
  if (commonPasswords.some(p => password.toLowerCase().includes(p.toLowerCase()))) {
    errors.push('Password is too common');
  }
  
  return { valid: errors.length === 0, errors };
}

// ──────────────────────────────────────────────
// Session Security
// ──────────────────────────────────────────────

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validateCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

// Token rotation - generate new JWT with short expiry
export const JWT_EXPIRY = '2h';
export const REFRESH_TOKEN_EXPIRY = '7d';
