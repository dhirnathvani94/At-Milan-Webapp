import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDB, saveDB, saveTable, supabaseAdmin } from '../db/database';
import { generateToken } from '../services/token.service';
import { generateOTP, verifyOTP as verifyOTPService, clearOTP } from '../services/otp.service';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
} from '../services/email.service';
import { createAuditLog } from '../services/audit.service';
import { env } from '../config/env';

// ─── Internal types ───────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  is_active: boolean;
  email_verified: boolean;
  email_verify_token: string | null;
  email_verify_token_expiry: string | null;
  password_reset_token: string | null;
  password_reset_token_expiry: string | null;
  last_login: string | null;
  login_attempts: number;
  login_locked_until: string | null;
  provider: string | null;
  provider_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  phone: string | null;
  profile_complete: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

interface CreditRow {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'
  );
}

function safeUser(user: UserRow) {
  const { password_hash, email_verify_token, password_reset_token, ...safe } = user;
  return safe;
}

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const VERIFY_TOKEN_EXPIRY_HOURS = 24;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// ─── register ─────────────────────────────────────────────────────────────────

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, first_name, last_name, gender, date_of_birth, phone } = req.body as {
      email: string; password: string; first_name: string; last_name: string;
      gender: string; date_of_birth: string; phone?: string;
    };

    const db = await getDB();
    const users = db.users as UserRow[];

    // Check duplicate email
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      return;
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Generate email verification token
    const email_verify_token = crypto.randomBytes(32).toString('hex');
    const email_verify_token_expiry = new Date(
      Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    ).toISOString();

    const now = new Date().toISOString();
    const userId = uuidv4();
    const profileId = uuidv4();

    // Create user row
    const newUser: UserRow = {
      id: userId,
      email: email.toLowerCase().trim(),
      password_hash,
      role: 'user',
      is_active: true,
      email_verified: false,
      email_verify_token,
      email_verify_token_expiry,
      password_reset_token: null,
      password_reset_token_expiry: null,
      last_login: null,
      login_attempts: 0,
      login_locked_until: null,
      provider: null,
      provider_id: null,
      created_at: now,
      updated_at: now,
    };

    // Create profile row
    const newProfile: ProfileRow = {
      id: profileId,
      user_id: userId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      gender,
      date_of_birth,
      phone: phone ?? null,
      profile_complete: false,
      is_verified: false,
      created_at: now,
      updated_at: now,
    };

    // Create credits row (start with 0 balance)
    const newCredits: CreditRow = {
      id: uuidv4(),
      user_id: userId,
      balance: 0,
      created_at: now,
      updated_at: now,
    };

    (db.users as UserRow[]).push(newUser);
    (db.profiles as ProfileRow[]).push(newProfile);
    (db.credits as CreditRow[]).push(newCredits);
    await saveTable('users', db.users as any[]);
    await saveTable('profiles', db.profiles as any[]);
    await saveTable('credits', db.credits as any[]);

    // Send verification email — non-blocking
    const baseUrl = env.FRONTEND_URL;
    sendVerificationEmail(email, email_verify_token, first_name, baseUrl).catch(() => {});

    // Generate JWT
    const token = generateToken(userId, email, 'user');

    // Emit to admin panel for real-time sync
    try {
      const { emitToAdmin } = await import('../services/socket.service');
      emitToAdmin('admin:new-user', { user: safeUser(newUser), profile: newProfile });
    } catch (e) {
      console.error('Socket emit failed in register:', e);
    }

    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email to verify your account.',
      user: safeUser(newUser),
      profile: newProfile,
      token,
    });
  } catch (err) {
    console.error('[Auth] register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
}

// ─── login ────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const ip = getClientIp(req);
  try {
    const { email, password } = req.body as { email: string; password: string };

    // --- Fetch user directly from Supabase so role is always read fresh from DB
    const { data: userRows, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('email', email.trim())
      .limit(1);

    if (userFetchError) {
      console.error('[Auth] login — DB fetch error:', userFetchError.message);
      res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
      return;
    }

    const user: UserRow | undefined = userRows?.[0] as UserRow | undefined;

    // --- Account not found — still audit but give generic message
    if (!user) {
      createAuditLog({
        action: 'login_failed',
        actor_ip: ip,
        details: { email, reason: 'user_not_found' },
        severity: 'warning',
      });
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    // --- Check if account is locked
    if (user.login_locked_until && new Date(user.login_locked_until) > new Date()) {
      const unlockAt = new Date(user.login_locked_until);
      const minutesLeft = Math.ceil((unlockAt.getTime() - Date.now()) / 60000);
      res.status(429).json({
        success: false,
        error: `Account temporarily locked. Try again in ${minutesLeft} minute(s).`,
      });
      return;
    }

    // --- Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      user.login_attempts = (user.login_attempts || 0) + 1;
      user.updated_at = new Date().toISOString();

      if (user.login_attempts >= MAX_LOGIN_ATTEMPTS) {
        user.login_locked_until = new Date(
          Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000
        ).toISOString();
        await supabaseAdmin.from('users').upsert(user, { onConflict: 'id' });
        createAuditLog({
          action: 'login_failed',
          actor_id: user.id,
          actor_ip: ip,
          resource_type: 'user',
          resource_id: user.id,
          details: { reason: 'account_locked_after_max_attempts' },
          severity: 'critical',
        });
        res.status(429).json({
          success: false,
          error: `Too many failed attempts. Account locked for ${LOGIN_LOCK_MINUTES} minutes.`,
        });
        return;
      }

      await supabaseAdmin.from('users').upsert(user, { onConflict: 'id' });
      createAuditLog({
        action: 'login_failed',
        actor_id: user.id,
        actor_ip: ip,
        resource_type: 'user',
        resource_id: user.id,
        details: { reason: 'wrong_password', attempts: user.login_attempts },
        severity: 'warning',
      });
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    // --- Check is_active
    if (!user.is_active) {
      res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact support.',
      });
      return;
    }

    // --- Success: reset attempts, update last_login
    user.login_attempts = 0;
    user.login_locked_until = null;
    user.last_login = new Date().toISOString();
    user.updated_at = new Date().toISOString();

    // Get profile
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .limit(1);
    const profile = (profileData?.[0] as ProfileRow | undefined) ?? null;

    // Get credits
    const { data: creditsData } = await supabaseAdmin
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .limit(1);
    const credits = (creditsData?.[0] as CreditRow | undefined) ?? null;

    // Persist updated login metadata back to Supabase
    await supabaseAdmin.from('users').upsert(user, { onConflict: 'id' });

    console.log('[Login] User role from DB:', user.role);
    const token = generateToken(user.id, user.email, user.role);

    createAuditLog({
      action: 'login_success',
      actor_id: user.id,
      actor_ip: ip,
      actor_user_agent: req.headers['user-agent'],
      resource_type: 'user',
      resource_id: user.id,
      severity: 'info',
    });

    res.status(200).json({
      success: true,
      user: safeUser(user),
      profile,
      token,
      credits: credits ? { balance: credits.balance } : { balance: 0 },
    });
  } catch (err) {
    console.error('[Auth] login error:', err);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
}

// ─── adminLogin ───────────────────────────────────────────────────────────────

export async function adminLogin(req: Request, res: Response): Promise<void> {
  const ip = getClientIp(req);
  try {
    const { email, password } = req.body as { email: string; password: string };

    // Credentials come ONLY from env — no hardcoded values
    if (
      email.toLowerCase().trim() !== env.ADMIN_EMAIL.toLowerCase().trim()
    ) {
      createAuditLog({
        action: 'login_failed',
        actor_ip: ip,
        details: { email, reason: 'admin_email_mismatch' },
        severity: 'critical',
      });
      res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
      return;
    }

    const db = await getDB();
    const users = db.users as UserRow[];

    // On first run: create admin user if not present
    let adminUser = users.find(
      (u) => u.email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase() && u.role === 'admin'
    );

    if (!adminUser) {
      const now = new Date().toISOString();
      const adminId = uuidv4();
      const hashedPassword = await bcrypt.hash(env.ADMIN_PASSWORD, BCRYPT_ROUNDS);

      adminUser = {
        id: adminId,
        email: env.ADMIN_EMAIL.toLowerCase(),
        password_hash: hashedPassword,
        role: 'admin',
        is_active: true,
        email_verified: true,
        email_verify_token: null,
        email_verify_token_expiry: null,
        password_reset_token: null,
        password_reset_token_expiry: null,
        last_login: null,
        login_attempts: 0,
        login_locked_until: null,
        provider: null,
        provider_id: null,
        created_at: now,
        updated_at: now,
      };

      (db.users as UserRow[]).push(adminUser);
      await saveTable('users', db.users as any[]);
      console.log('[Auth] Admin user created from env credentials.');
    }

    // Compare submitted password against stored bcrypt hash
    const passwordMatch = await bcrypt.compare(password, adminUser.password_hash);
    if (!passwordMatch) {
      createAuditLog({
        action: 'login_failed',
        actor_ip: ip,
        details: { email, reason: 'admin_wrong_password' },
        severity: 'critical',
      });
      res.status(401).json({ success: false, error: 'Invalid admin credentials.' });
      return;
    }

    if (!adminUser.is_active) {
      res.status(403).json({ success: false, error: 'Admin account is deactivated.' });
      return;
    }

    // Update last_login
    adminUser.last_login = new Date().toISOString();
    adminUser.updated_at = new Date().toISOString();
    await saveTable('users', db.users as any[]);

    const token = generateToken(adminUser.id, adminUser.email, 'admin');

    createAuditLog({
      action: 'admin_login',
      actor_id: adminUser.id,
      actor_ip: ip,
      actor_user_agent: req.headers['user-agent'],
      resource_type: 'user',
      resource_id: adminUser.id,
      severity: 'warning',
    });

    res.status(200).json({
      success: true,
      user: safeUser(adminUser),
      token,
    });
  } catch (err) {
    console.error('[Auth] adminLogin error:', err);
    res.status(500).json({ success: false, error: 'Admin login failed.' });
  }
}

// ─── verifyEmail ──────────────────────────────────────────────────────────────

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      res.status(400).json({ success: false, error: 'Verification token is required.' });
      return;
    }

    const db = await getDB();
    const users = db.users as UserRow[];
    const user = users.find((u) => u.email_verify_token === token);

    if (!user) {
      res.status(400).json({ success: false, error: 'Invalid or expired verification link.' });
      return;
    }

    if (user.email_verified) {
      res.status(200).json({ success: true, message: 'Email already verified. You can log in.' });
      return;
    }

    // Check expiry
    if (
      user.email_verify_token_expiry &&
      new Date(user.email_verify_token_expiry) < new Date()
    ) {
      res.status(400).json({
        success: false,
        error: 'Verification link has expired. Please request a new one.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    // Mark verified
    user.email_verified = true;
    user.email_verify_token = null;
    user.email_verify_token_expiry = null;
    user.updated_at = new Date().toISOString();
    await saveTable('users', db.users as any[]);

    // Get first name from profile for welcome email
    const profiles = db.profiles as ProfileRow[];
    const profile = profiles.find((p) => p.user_id === user.id);
    const firstName = profile?.first_name ?? 'there';

    // Send welcome email — non-blocking
    sendWelcomeEmail(user.email, firstName).catch(() => {});

    createAuditLog({
      action: 'email_verified',
      actor_id: user.id,
      resource_type: 'user',
      resource_id: user.id,
      severity: 'info',
    });

    res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] verifyEmail error:', err);
    res.status(500).json({ success: false, error: 'Email verification failed.' });
  }
}

// ─── resendVerification ───────────────────────────────────────────────────────

export async function resendVerification(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required.' });
      return;
    }

    const db = await getDB();
    const users = db.users as UserRow[];
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    // Always return success to prevent email enumeration
    if (!user || user.email_verified) {
      res.status(200).json({
        success: true,
        message: 'If that email exists and is unverified, a new link has been sent.',
      });
      return;
    }

    // Generate new token
    const newToken = crypto.randomBytes(32).toString('hex');
    user.email_verify_token = newToken;
    user.email_verify_token_expiry = new Date(
      Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    ).toISOString();
    user.updated_at = new Date().toISOString();
    await saveTable('users', db.users as any[]);

    const profiles = db.profiles as ProfileRow[];
    const profile = profiles.find((p) => p.user_id === user.id);
    const firstName = profile?.first_name ?? 'there';

    sendVerificationEmail(user.email, newToken, firstName, env.FRONTEND_URL).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'If that email exists and is unverified, a new link has been sent.',
    });
  } catch (err) {
    console.error('[Auth] resendVerification error:', err);
    res.status(500).json({ success: false, error: 'Could not resend verification email.' });
  }
}

// ─── sendOTP ──────────────────────────────────────────────────────────────────

export async function sendOTP(req: Request, res: Response): Promise<void> {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ success: false, error: 'Phone number required' });
      return;
    }

    const db = await getDB();
    const kv: Record<string, string> = {};
    (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (!db.otps) db.otps = [];
    const otps = db.otps as any[];
    const existingIndex = otps.findIndex((o: any) => o.phone === phone);
    if (existingIndex >= 0) {
      otps[existingIndex] = { phone, otp, expiry };
    } else {
      otps.push({ phone, otp, expiry });
    }
    await saveTable('otps', db.otps as any[]);

    const smsApiUrl = (kv['sms_api_url'] || '').trim();
    const smsApiKey = (kv['sms_api_key'] || '').trim();
    let smsSent = false;

    if (smsApiUrl) {
      try {
        const smsRes = await fetch(smsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(smsApiKey ? { 'Authorization': `Bearer ${smsApiKey}`, 'x-api-key': smsApiKey } : {})
          },
          body: JSON.stringify({
            phone: `91${phone}`,
            otp,
            message: `Your OTP is ${otp}. Valid for 10 minutes. Do not share with anyone.`
          })
        });
        smsSent = smsRes.ok;
      } catch (err) {
        console.error('[OTP] SMS API failed:', err);
      }
    }

    console.log(`[OTP] Phone +91${phone}: ${otp} | SMS: ${smsSent ? 'Sent' : 'Not configured'}`);

    res.status(200).json({
      success: true,
      message: smsSent ? 'OTP sent to your mobile number!' : 'OTP sent successfully!'
    });
  } catch (err) {
    console.error('[Auth] sendOTP error:', err);
    res.status(500).json({ success: false, error: 'Could not send OTP.' });
  }
}

// ─── verifyOTP ────────────────────────────────────────────────────────────────

export async function verifyOTP(req: Request, res: Response): Promise<void> {
  try {
    const { phone, otp } = req.body as { phone?: string; otp?: string };
    if (!phone || !otp) {
      res.status(400).json({ success: false, error: 'Phone and OTP required' });
      return;
    }

    const db = await getDB();
    if (!db.otps) db.otps = [];
    const otps = db.otps as any[];

    const kv: Record<string, string> = {};
    (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
    const masterOtp = (kv['master_otp'] || '').trim();

    if (masterOtp && otp.trim() === masterOtp) {
      console.log(`[OTP] Master OTP used for +91${phone}`);
      db.otps = otps.filter((o: any) => o.phone !== phone);
      await saveTable('otps', db.otps as any[]);
      res.status(200).json({ success: true, message: 'Phone verified successfully!' });
      return;
    }

    const otpRecord = otps.find((o: any) => o.phone === phone);
    if (!otpRecord) {
      res.status(400).json({ success: false, error: 'No OTP found. Please request a new OTP.' });
      return;
    }

    if (new Date(otpRecord.expiry) < new Date()) {
      db.otps = otps.filter((o: any) => o.phone !== phone);
      await saveTable('otps', db.otps as any[]);
      res.status(400).json({ success: false, error: 'OTP expired. Please request a new one.' });
      return;
    }

    if (otpRecord.otp !== otp.trim()) {
      res.status(400).json({ success: false, error: 'Incorrect OTP. Please try again.' });
      return;
    }

    db.otps = otps.filter((o: any) => o.phone !== phone);
    await saveTable('otps', db.otps as any[]);
    res.status(200).json({ success: true, message: 'Phone verified successfully!' });
  } catch (err) {
    console.error('[Auth] verifyOTP error:', err);
    res.status(500).json({ success: false, error: 'OTP verification failed.' });
  }
}

// ─── socialLogin ──────────────────────────────────────────────────────────────

export async function socialLogin(req: Request, res: Response): Promise<void> {
  try {
    const { email, provider, provider_id, first_name, last_name, gender } = req.body as {
      email: string;
      provider: string;
      provider_id: string;
      first_name?: string;
      last_name?: string;
      gender?: string;
    };

    if (!email || !provider || !provider_id) {
      res.status(400).json({ success: false, error: 'email, provider, and provider_id are required.' });
      return;
    }

    const db = await getDB();
    const users = db.users as UserRow[];
    const profiles = db.profiles as ProfileRow[];

    let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    let profile = user ? profiles.find((p) => p.user_id === user!.id) ?? null : null;
    let isNew = false;

    if (!user) {
      // Create new user via social login
      const now = new Date().toISOString();
      const userId = uuidv4();
      const profileId = uuidv4();

      user = {
        id: userId,
        email: email.toLowerCase().trim(),
        password_hash: '',   // No password for social users
        role: 'user',
        is_active: true,
        email_verified: true, // Social providers verify email
        email_verify_token: null,
        email_verify_token_expiry: null,
        password_reset_token: null,
        password_reset_token_expiry: null,
        last_login: now,
        login_attempts: 0,
        login_locked_until: null,
        provider,
        provider_id,
        created_at: now,
        updated_at: now,
      };

      profile = {
        id: profileId,
        user_id: userId,
        first_name: first_name?.trim() ?? '',
        last_name: last_name?.trim() ?? '',
        gender: gender ?? '',
        date_of_birth: '',
        phone: null,
        profile_complete: false,
        is_verified: false,
        created_at: now,
        updated_at: now,
      };

      const newCredits: CreditRow = {
        id: uuidv4(),
        user_id: userId,
        balance: 0,
        created_at: now,
        updated_at: now,
      };

      (db.users as UserRow[]).push(user);
      (db.profiles as ProfileRow[]).push(profile);
      (db.credits as CreditRow[]).push(newCredits);
      isNew = true;
    } else {
      // Update provider info and last_login for existing user
      user.provider = provider;
      user.provider_id = provider_id;
      user.last_login = new Date().toISOString();
      user.updated_at = new Date().toISOString();
    }

    if (!user.is_active) {
      res.status(403).json({ success: false, error: 'Account is deactivated.' });
      return;
    }

    if (isNew) {
      await saveTable('users', db.users as any[]);
      await saveTable('profiles', db.profiles as any[]);
      await saveTable('credits', db.credits as any[]);
    } else {
      await saveTable('users', db.users as any[]);
    }

    const token = generateToken(user.id, user.email, user.role);

    createAuditLog({
      action: 'login_success',
      actor_id: user.id,
      actor_ip: getClientIp(req),
      details: { provider, is_new_user: isNew },
      severity: 'info',
    });

    res.status(isNew ? 201 : 200).json({
      success: true,
      isNewUser: isNew,
      user: safeUser(user),
      profile,
      token,
    });
  } catch (err) {
    console.error('[Auth] socialLogin error:', err);
    res.status(500).json({ success: false, error: 'Social login failed.' });
  }
}

// ─── forgotPassword ───────────────────────────────────────────────────────────

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required.' });
      return;
    }

    const db = await getDB();
    const users = db.users as UserRow[];
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    const genericResponse = {
      success: true,
      message: 'If that email is registered, a password reset link has been sent.',
    };

    if (!user || !user.is_active) {
      res.status(200).json(genericResponse);
      return;
    }

    const profiles = db.profiles as ProfileRow[];
    const profile = profiles.find((p) => p.user_id === user.id);
    const firstName = profile?.first_name ?? user.email;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabaseAdmin.from("otps").upsert({
      id: uuidv4(),
      phone: email,
      otp,
      expiry,
      user_id: user.id
    });

    await sendOTPEmail(user.email, otp, firstName);

    createAuditLog({
      action: 'password_reset',
      actor_id: user.id,
      actor_ip: getClientIp(req),
      resource_type: 'user',
      resource_id: user.id,
      severity: 'warning',
    });

    res.status(200).json({ success: true, message: "OTP sent to your email" });
  } catch (err) {
    console.error('[Auth] forgotPassword error:', err);
    res.status(500).json({ success: false, error: 'Could not process request.' });
  }
}

// ─── verifyResetOTP ───────────────────────────────────────────────────────────

export async function verifyResetOTP(req: Request, res: Response): Promise<void> {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ success: false, error: 'Email and OTP are required.' });
      return;
    }

    const { data: records, error } = await supabaseAdmin
      .from("otps")
      .select("*")
      .eq("phone", email)
      .eq("otp", otp.trim());

    if (error || !records || records.length === 0) {
      res.status(400).json({ success: false, error: 'Invalid OTP.' });
      return;
    }

    const record = records[0];

    if (new Date(record.expiry) < new Date()) {
      res.status(400).json({ success: false, error: 'OTP has expired.' });
      return;
    }

    await supabaseAdmin.from("otps").delete().eq("id", record.id);

    res.status(200).json({ success: true, userId: record.user_id });
  } catch (err) {
    console.error('[Auth] verifyResetOTP error:', err);
    res.status(500).json({ success: false, error: 'Could not verify OTP.' });
  }
}

// ─── resetPassword ────────────────────────────────────────────────────────────

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body as { token?: string; password?: string };

    if (!token || !password) {
      res.status(400).json({ success: false, error: 'Token and new password are required.' });
      return;
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      res.status(400).json({
        success: false,
        error:
          'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
      });
      return;
    }

    const db = await getDB();
    const users = db.users as UserRow[];
    const user = users.find((u) => u.password_reset_token === token);

    if (!user) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset link.' });
      return;
    }

    if (
      user.password_reset_token_expiry &&
      new Date(user.password_reset_token_expiry) < new Date()
    ) {
      res.status(400).json({
        success: false,
        error: 'Reset link has expired. Please request a new one.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    // Hash new password
    const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.password_hash = newHash;
    user.password_reset_token = null;
    user.password_reset_token_expiry = null;
    user.login_attempts = 0;
    user.login_locked_until = null;
    user.updated_at = new Date().toISOString();
    await saveTable('users', db.users as any[]);

    createAuditLog({
      action: 'password_changed',
      actor_id: user.id,
      actor_ip: getClientIp(req),
      resource_type: 'user',
      resource_id: user.id,
      severity: 'warning',
    });

    res.status(200).json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] resetPassword error:', err);
    res.status(500).json({ success: false, error: 'Password reset failed.' });
  }
}

// ─── checkDuplicate ─────────────────────────────────────────────────────────────

export async function checkDuplicate(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, phone, exclude_id } = req.body as {
      email?: string; phone?: string; exclude_id?: string;
    };

    const db = await getDB();
    const errors: string[] = [];

    if (email && email.trim()) {
      const emailExists = (db.users as any[]).find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase().trim()
          && u.id !== exclude_id
      );
      if (emailExists) errors.push(`Email (${email}) is already registered.`);
    }

    if (phone && phone.trim()) {
      const phoneClean = phone.replace(/\D/g, '');
      if (phoneClean.length >= 10) {
        const phoneExists = (db.profiles as any[]).find((p: any) => {
          if (p.id === exclude_id) return false;
          const pPhone = (p.phone || '').replace(/\D/g, '');
          return pPhone && pPhone === phoneClean;
        });
        if (phoneExists) errors.push(`Phone (${phone}) is already registered.`);
      }
    }

    if (errors.length > 0) {
      res.status(409).json({ duplicate: true, message: errors.join(' ') });
      return;
    }

    res.status(200).json({ duplicate: false });
  } catch (err) {
    console.error('[Auth] checkDuplicate error:', err);
    res.status(500).json({ success: false, error: 'Could not check duplicate.' });
  }
}
