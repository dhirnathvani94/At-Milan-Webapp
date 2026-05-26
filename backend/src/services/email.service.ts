import nodemailer, { Transporter } from 'nodemailer';
import { getDBSync } from '../db/database';

// ─── Read SMTP settings from DB ───────────────────────────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

function getSmtpConfig(): SmtpConfig | null {
  try {
    const db = getDBSync();
    const kv = db.admin_settings_kv as Array<{ key: string; value: string }>;

    const get = (key: string): string =>
      kv.find((r) => r.key === key)?.value ?? '';

    const host      = get('smtp_host');
    const portStr   = get('smtp_port');
    const user      = get('smtp_user');
    const pass      = get('smtp_pass');
    const fromName  = get('smtp_from_name')  || 'AtMilan';
    const fromEmail = get('smtp_from_email') || user;

    if (!host || !portStr || !user || !pass) return null;

    return {
      host,
      port: parseInt(portStr, 10) || 587,
      user,
      pass,
      fromName,
      fromEmail,
    };
  } catch {
    return null;
  }
}

// ─── Build transporter on demand ─────────────────────────────────────────────

function createTransporter(cfg: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,   // true for port 465, STARTTLS for others
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: process.env['NODE_ENV'] === 'production',
    },
  });
}

// ─── Core send function ───────────────────────────────────────────────────────

/**
 * Sends an email. Never throws — all errors are caught and logged.
 * Returns true on success, false on failure.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const cfg = getSmtpConfig();

  if (!cfg) {
    console.warn('[Email] SMTP not configured. Skipping email to:', to);
    return false;
  }

  try {
    const transporter = createTransporter(cfg);
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to} | subject: "${subject}" | id: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send to ${to} | subject: "${subject}" |`, (err as Error).message);
    return false;
  }
}

// ─── Shared HTML wrapper ──────────────────────────────────────────────────────

function getAppName(): string {
  try {
    const db = getDBSync();
    const kv = db.admin_settings_kv as Array<{ key: string; value: string }>;
    return kv.find((r) => r.key === 'platform_name')?.value || 'AtMilan';
  } catch {
    return 'AtMilan';
  }
}

function getSupportEmail(): string {
  try {
    const db = getDBSync();
    const kv = db.admin_settings_kv as Array<{ key: string; value: string }>;
    return kv.find((r) => r.key === 'contact_email')?.value || 'support@atmilan.com';
  } catch {
    return 'support@atmilan.com';
  }
}

function wrapHtml(title: string, body: string): string {
  const appName = getAppName();
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f4; font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #c0392b, #e74c3c); padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; letter-spacing: 1px; }
    .header p  { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .body { padding: 36px 40px; color: #333333; line-height: 1.6; }
    .body h2 { margin-top: 0; color: #c0392b; }
    .otp-box { display: inline-block; background: #fdf2f2; border: 2px dashed #e74c3c; border-radius: 8px; padding: 16px 32px; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #c0392b; margin: 20px 0; }
    .btn { display: inline-block; background: #c0392b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 20px 40px; text-align: center; font-size: 12px; color: #999999; border-top: 1px solid #eeeeee; }
    .note { background: #fff8e1; border-left: 4px solid #f39c12; padding: 12px 16px; border-radius: 4px; font-size: 13px; color: #7d6608; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💍 ${appName}</h1>
      <p>Your Trusted Matrimonial Partner</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.<br/>
      This is an automated email. Please do not reply.
    </div>
  </div>
</body>
</html>`;
}

// ─── sendOTPEmail ─────────────────────────────────────────────────────────────

export async function sendOTPEmail(
  to: string,
  otp: string,
  name: string
): Promise<boolean> {
  const body = `
    <h2>Your OTP Code</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Use the following One-Time Password to complete your verification:</p>
    <div style="text-align:center;">
      <div class="otp-box">${otp}</div>
    </div>
    <div class="note">
      ⏱ This OTP is valid for <strong>10 minutes</strong> and can only be used once.<br/>
      Never share this code with anyone — ${getAppName()} will never ask for it.
    </div>`;

  return sendEmail(to, `Your ${getAppName()} OTP Code`, wrapHtml('OTP Code', body));
}

// ─── sendVerificationEmail ────────────────────────────────────────────────────

export async function sendVerificationEmail(
  to: string,
  token: string,
  name: string,
  baseUrl: string
): Promise<boolean> {
  const link = `${baseUrl}/verify-email?token=${token}`;
  const body = `
    <h2>Verify Your Email Address</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Welcome to ${getAppName()}! Please verify your email address to activate your account.</p>
    <div style="text-align:center;">
      <a href="${link}" class="btn">Verify Email Address</a>
    </div>
    <p style="font-size:13px;color:#666;">Or copy and paste this link into your browser:</p>
    <p style="font-size:12px;word-break:break-all;color:#c0392b;">${link}</p>
    <div class="note">
      ⏱ This link expires in <strong>24 hours</strong>.<br/>
      If you did not create an account, you can safely ignore this email.
    </div>`;

  return sendEmail(to, `Verify Your ${getAppName()} Account`, wrapHtml('Verify Email', body));
}

// ─── sendWelcomeEmail ─────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  to: string,
  name: string
): Promise<boolean> {
  const body = `
    <h2>Welcome to ${getAppName()}! 🎉</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your email has been verified and your account is now active. We're delighted to have you as part of the ${getAppName()} family.</p>
    <p>Here's what you can do next:</p>
    <ul>
      <li>Complete your profile to attract the right matches</li>
      <li>Upload your photos</li>
      <li>Browse profiles and send interests</li>
      <li>Use filters to find your perfect match</li>
    </ul>
    <p>We wish you the very best on your journey to finding your life partner.</p>
    <p>With warm regards,<br/><strong>The ${getAppName()} Team</strong></p>`;

  return sendEmail(to, `Welcome to ${getAppName()}!`, wrapHtml('Welcome', body));
}

// ─── sendInterestEmail ────────────────────────────────────────────────────────

export async function sendInterestEmail(
  to: string,
  fromName: string
): Promise<boolean> {
  const body = `
    <h2>Someone is Interested in You! 💌</h2>
    <p>Great news! <strong>${fromName}</strong> has sent you an interest on ${getAppName()}.</p>
    <p>Log in to your account to view their profile and respond to their interest.</p>
    <div style="text-align:center;">
      <a href="#" class="btn">View Profile</a>
    </div>
    <div class="note">
      Log in to ${getAppName()} to accept or decline this interest.
    </div>`;

  return sendEmail(to, `${fromName} is interested in you on ${getAppName()}`, wrapHtml('New Interest', body));
}

// ─── sendPasswordResetEmail ───────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  name: string,
  baseUrl: string
): Promise<boolean> {
  const link = `${baseUrl}/reset-password?token=${token}`;
  const body = `
    <h2>Reset Your Password</h2>
    <p>Hello <strong>${name}</strong>,</p>
    <p>We received a request to reset the password for your ${getAppName()} account.</p>
    <div style="text-align:center;">
      <a href="${link}" class="btn">Reset Password</a>
    </div>
    <p style="font-size:13px;color:#666;">Or copy and paste this link into your browser:</p>
    <p style="font-size:12px;word-break:break-all;color:#c0392b;">${link}</p>
    <div class="note">
      ⏱ This link expires in <strong>1 hour</strong>.<br/>
      If you did not request a password reset, please ignore this email — your password will not change.
    </div>`;

  return sendEmail(to, `Reset Your ${getAppName()} Password`, wrapHtml('Reset Password', body));
}
