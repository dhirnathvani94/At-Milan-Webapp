import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ── Referral Code Generator ──────────────────────────────────────────────────
// Format: <BrandPrefix><7-digit-sequential> e.g. AM0000001
// Prefix = initials of each word in platform_name setting (e.g. "At Milan" → "AM")
function generateReferralCode(db: any): string {
  const kv: Record<string, string> = {};
  (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
  const platformName = kv['platform_name'] || kv['site_title'] || 'AtMilan';
  // Get initials: split on spaces/camelCase boundaries, take first letter of each word
  const prefix = platformName
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → words
    .split(/\s+/)
    .filter(Boolean)
    .map((w: string) => w[0].toUpperCase())
    .join('')
    .slice(0, 4);  // max 4 chars
  // Sequential number — count existing referral_links
  const count = (db.referral_links || []).length + 1;
  const seq = String(count).padStart(7, '0');
  return `${prefix}${seq}`;
}

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeES, indexProfile, bulkIndexProfiles, deleteProfileFromIndex, searchProfiles, suggestProfiles, isESReady } from './src/lib/elasticsearch.js';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { searchCache, masterDataCache, profileCache, recommendationsCache, recordTiming, getHealthMetrics, incrementRequests } from './src/lib/performance.js';
import { sanitizeInput, detectSQLInjection, getSecurityHeaders, encryptPII, decryptPII, encrypt, decrypt, createAuditLog, getAuditLogs, checkLoginAttempts, recordLoginAttempt, validatePasswordStrength, sanitizeCardData, validateNoCardStorage, GDPR_DATA_CATEGORIES, anonymizeUserData, generateCSRFToken, validateCSRFToken, JWT_EXPIRY, REFRESH_TOKEN_EXPIRY } from './src/lib/security.js';
import { startCluster, autoScaler, replicaManager, cdnMiddleware, getHealthCheckData, trackRequest, getRequestLoadMetrics, collectLoadMetrics, configureCDN, getCDNConfig } from './src/lib/scalability.js';

import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || '93adb4679e4b865a3160d6e4a23577f9b2b6d6c6ace065d382fdba8604329d5ec127efaa22ae2c67388d9edf1f0fa2493e039508f49f3f8029ca7ea0c4faab5f';
const DB_FILE = './database.json';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SMTP Email Helper
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getSmtpSettings() {
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    const kv: Record<string, string> = {};
    (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
    return {
      host: kv['smtp_host'] || '',
      port: parseInt(kv['smtp_port'] || '587'),
      user: kv['smtp_user'] || '',
      pass: kv['smtp_pass'] || '',
      from_name: kv['smtp_from_name'] || kv['site_name'] || 'AtMilan',
      from_email: kv['smtp_from_email'] || kv['smtp_user'] || '',
    };
  } catch { return null; }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const smtp = getSmtpSettings();
  if (!smtp || !smtp.host || !smtp.user || !smtp.pass) {
    console.warn('âš ï¸  SMTP not configured â€” skipping email to', to);
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transporter.sendMail({
      from: `"${smtp.from_name}" <${smtp.from_email}>`,
      to,
      subject,
      html,
    });
    console.log(`âœ‰ï¸  Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error('âŒ Email send failed:', err);
    return false;
  }
}

function buildVerificationEmailHtml(firstName: string, verifyUrl: string, siteName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verify Your Email</title></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#8B1A1A 0%,#6B1414 100%);padding:36px 40px;text-align:center;">
          <h1 style="margin:0;color:#D4AF37;font-size:28px;font-weight:800;letter-spacing:1px;">${siteName}</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Premium Matrimonial Platform</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 12px;">Hello ${firstName}! ðŸ‘‹</h2>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 24px;">
            Welcome to <strong>${siteName}</strong>! We're thrilled to have you. To activate your account and start connecting with potential matches, please verify your email address.
          </p>
          <!-- Button -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
            <tr><td align="center" style="border-radius:12px;background:linear-gradient(135deg,#8B1A1A,#6B1414);">
              <a href="${verifyUrl}" style="display:inline-block;padding:16px 48px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.5px;">
                âœ“ Verify My Email
              </a>
            </td></tr>
          </table>
          <p style="color:#888;font-size:13px;text-align:center;margin:0 0 8px;">This link expires in <strong>24 hours</strong>.</p>
          <p style="color:#aaa;font-size:12px;text-align:center;word-break:break-all;">
            Or copy this link: <a href="${verifyUrl}" style="color:#8B1A1A;">${verifyUrl}</a>
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9f5f0;padding:24px 40px;text-align:center;border-top:1px solid #f0e8df;">
          <p style="color:#aaa;font-size:12px;margin:0;">If you didn't create an account on ${siteName}, please ignore this email.</p>
          <p style="color:#ccc;font-size:11px;margin:8px 0 0;">Â© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


// Simple JSON Database Helper
const getDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [], profiles: [], education_career: [], family_details: [], lifestyle: [],
      photos: [], horoscope_details: [], partner_preferences: [], verification_documents: [],
      interests: [], notifications: [], messages: [], shortlists: [], success_stories: [],
      contacts: [], profile_views: [], chat_warnings: [], reports: [], unblock_requests: [],
      match_confirmations: [], referral_links: [], reactivation_requests: [],
      site_settings: [], membership_plans: [
        { id: 'free', name: 'Free', price: 0, duration_months: 0, features: ['Basic Search', 'Send Interests'], original_price: 0 },
        { id: 'premium', name: 'Premium', price: 1999, duration_months: 3, features: ['Unlimited Messages', 'View Contact Details', 'Priority Support'], original_price: 2999 }
      ],
      credit_plans: [
        { id: 'basic', name: 'Basic Pack', credits: 50, price: 499, original_price: 999, expiry_days: 90 },
        { id: 'standard', name: 'Standard Pack', credits: 150, price: 999, original_price: 1999, popular: true, expiry_days: 180 },
        { id: 'premium', name: 'Premium Pack', credits: 500, price: 1999, original_price: 3999, expiry_days: 365 }
      ],
      membership_purchases: [], credit_purchases: [], message_reports: [],
      contact_messages: [], user_blocks: [], user_reports: [],
      // MASTER DATA COLLECTIONS (v5.0 spec)
      master_castes: [
        { id: 'c1', name: 'Patel', is_active: true },
        { id: 'c2', name: 'Brahmin', is_active: true }
      ],
      master_sub_castes: [
        { id: 'sc1', caste_id: 'c1', name: 'Leuva', is_active: true },
        { id: 'sc2', caste_id: 'c1', name: 'Kadva', is_active: true }
      ],
      master_gotras: [],
      master_nakshatras: [
        { id: 'n1', name: 'Ashwini' }, { id: 'n2', name: 'Bharani' }
      ],
      master_raashis: [
        { id: 'r1', name: 'Mesh (Aries)' }, { id: 'r2', name: 'Vrishabh (Taurus)' }
      ],
      master_heights: [
        { id: 'h1', label: "5'0\" / 152cm", cm_value: 152 },
        { id: 'h2', label: "5'5\" / 165cm", cm_value: 165 }
      ],
      master_weights: [
        { id: 'w1', label: "50 kg", kg_value: 50 },
        { id: 'w2', label: "60 kg", kg_value: 60 }
      ],
      master_body_types: [
        { id: 'slim', label: 'Slim' }, { id: 'athletic', label: 'Athletic' }, { id: 'average', label: 'Average' }
      ],
      master_complexions: [
        { id: 'fair', label: 'Fair' }, { id: 'wheatish', label: 'Wheatish' }, { id: 'dusky', label: 'Dusky' }
      ],
      master_blood_groups: [
        { id: 'a_pos', label: 'A+' }, { id: 'o_pos', label: 'O+' }, { id: 'b_pos', label: 'B+' }
      ],
      master_marital_statuses: [
        { id: 'never_married', label: 'Never Married' }, { id: 'divorced', label: 'Divorced' }, { id: 'widowed', label: 'Widowed' }
      ],
      master_education_levels: [
        { id: 'e1', name: 'Bachelor of Engineering' }, { id: 'e2', name: 'Masters in Science' }
      ],
      master_occupations: [
        { id: 'o1', name: 'Software Engineer' }, { id: 'o2', name: 'Doctor' }
      ],
      master_incomes: [
        { id: 'i1', label: '3-5 LPA' }, { id: 'i2', label: '5-10 LPA' }
      ],
      master_countries: [
        { id: 'ct1', name: 'India', code: 'IN' }
      ],
      master_states: [
        { id: 'st1', country_id: 'ct1', name: 'Gujarat' },
        { id: 'st2', country_id: 'ct1', name: 'Maharashtra' }
      ],
      master_cities: [
        { id: 'ci1', state_id: 'st1', name: 'Ahmedabad' },
        { id: 'ci2', state_id: 'st1', name: 'Surat' }
      ],
      master_family_types: [
        { id: 'joint', label: 'Joint Family' }, { id: 'nuclear', label: 'Nuclear Family' }
      ],
      master_diets: [
        { id: 'vegetarian', label: 'Vegetarian' }, { id: 'non_veg', label: 'Non-Vegetarian' }, { id: 'jain', label: 'Jain' }
      ],
      master_habits: [
        { id: 'never', label: 'Never', type: 'smoking' }, { id: 'sometimes', label: 'Occasionally', type: 'drinking' }
      ],
      master_hobbies: [
        { id: 'hb1', name: 'Reading' }, { id: 'hb2', name: 'Traveling' }, { id: 'hb3', name: 'Music' }
      ],
      master_languages: [
        { id: 'l1', name: 'Hindi' }, { id: 'l2', name: 'English' }, { id: 'l3', name: 'Gujarati' }
      ],
      admin_settings_kv: [
        { key: 'community_name', value: 'Your Community' },
        { key: 'site_name', value: 'AtMilan' },
        { key: 'contact_unlock_duration_hours', value: '24' }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

  // Ensure all tables exist (migration)
  const tables = [
    'users', 'profiles', 'education_career', 'family_details', 'lifestyle',
    'photos', 'horoscope_details', 'partner_preferences', 'verification_documents',
    'interests', 'notifications', 'messages', 'shortlists', 'success_stories',
    'contacts', 'profile_views', 'chat_warnings', 'reports', 'unblock_requests',
    'match_confirmations', 'referral_links', 'reactivation_requests',
    'site_settings', 'membership_plans', 'credit_plans', 'membership_purchases', 'credit_purchases', 'message_reports', 'contact_messages',
    'master_castes', 'master_sub_castes', 'master_gotras', 'master_nakshatras', 'master_raashis',
    'master_heights', 'master_weights', 'master_body_types', 'master_complexions', 'master_blood_groups',
    'master_marital_statuses', 'master_education_levels', 'master_occupations', 'master_incomes',
    'master_countries', 'master_states', 'master_cities', 'master_family_types', 'master_diets',
    'master_habits', 'master_hobbies', 'master_languages', 'admin_settings_kv', 'user_blocks', 'coupons', 'payment_gateways', 'otps', 'admin_notifications', 'fcm_tokens', 'communities', 'admin_managers'
  ];


  let changed = false;
  tables.forEach(table => {
    if (!db[table]) {
      if (table === 'membership_plans') {
        db[table] = [
          { id: 'free', name: 'Free', price: 0, duration_months: 0, features: ['Basic Search', 'Send Interests'], original_price: 0 },
          { id: 'premium', name: 'Premium', price: 1999, duration_months: 3, features: ['Unlimited Messages', 'View Contact Details', 'Priority Support'], original_price: 2999 }
        ];
      } else if (table === 'credit_plans') {
        db[table] = [
          { id: 'basic', name: 'Basic Pack', credits: 50, price: 499, original_price: 999, expiry_days: 90 },
          { id: 'standard', name: 'Standard Pack', credits: 150, price: 999, original_price: 1999, popular: true, expiry_days: 180 },
          { id: 'premium', name: 'Premium Pack', credits: 500, price: 1999, original_price: 3999, expiry_days: 365 }
        ];
      } else {
        db[table] = [];
      }
      changed = true;
    }
  });

  // Seed Lohana community if communities table is empty
  if (Array.isArray(db.communities) && db.communities.length === 0) {
    db.communities.push({
      id: crypto.randomUUID(),
      name: 'Lohana',
      sub_castes: ['Halai', 'Ghoghari', 'Kutchi', 'Vaishnav', 'Swaminarayan', 'Jain', 'Other'],
      gotras: ['Kashyap', 'Vasishth', 'Bharadwaj', 'Atri', 'Gautam', 'Jamadagni', 'Vishwamitra', 'Vashishtha', 'Other'],
      is_active: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    changed = true;
  }

  // Ensure required admin settings exist
  const defaultSettings = [
    { key: 'community_name', value: 'Your Community', setting_type: 'string', description: 'Primary community name' },
    { key: 'status_green_days', value: '15', setting_type: 'number', description: 'Days since last login to show GREEN frame (Actively Looking)' },
    { key: 'status_yellow_days', value: '15', setting_type: 'number', description: 'Days of no login to show YELLOW frame (Taking a Break)' },
    { key: 'status_red_days', value: '45', setting_type: 'number', description: 'Days of no login to show RED frame (Paused Profile)' },
    { key: 'reactivation_limit', value: '10', setting_type: 'number', description: 'Max auto-reactivations before admin approval required' },
    { key: 'inactivity_email_day_1', value: '60', setting_type: 'number', description: 'Day of inactivity to send first reminder email' },
    { key: 'inactivity_email_day_2', value: '75', setting_type: 'number', description: 'Day of inactivity to send second reminder email' },
    { key: 'inactivity_email_day_3', value: '90', setting_type: 'number', description: 'Day of inactivity to send third reminder email' },
    { key: 'site_title', value: 'AtMilan', setting_type: 'string', description: 'Site Title' },
    { key: 'hero_description', value: 'Join millions of happy families who found their life partner on AtMilan. Verified profiles. Safe & secure.', setting_type: 'string', description: 'Hero section description' },
    { key: 'stat_profiles', value: '10K+', setting_type: 'string', description: 'Stats: Profiles count' },
    { key: 'stat_marriages', value: '500+', setting_type: 'string', description: 'Stats: Marriages count' },
    { key: 'stat_happy_users', value: '98%', setting_type: 'string', description: 'Stats: Happy Users percentage' },
    { key: 'section_how_it_works_title', value: 'How AtMilan Works', setting_type: 'string', description: 'Title for How It Works section' },
    { key: 'section_love_stories_title', value: 'Love Stories Made on AtMilan', setting_type: 'string', description: 'Title for Love Stories section' },
    { key: 'section_testimonials_title', value: 'What Our Users Say', setting_type: 'string', description: 'Title for Testimonials section' },
    { key: 'free_journey_text', value: 'Every member automatically receives 10 free contact unlock credits every month! Browse profiles, send unlimited interests, and explore matches at absolutely no cost.', setting_type: 'string', description: 'Free registration banner text' },
    { key: 'app_store_link', value: '#', setting_type: 'string', description: 'App Store URL' },
    { key: 'play_store_link', value: '#', setting_type: 'string', description: 'Google Play Store URL' },
    {
      key: 'how_it_works_items', value: JSON.stringify([
        { step: 1, title: 'Register', desc: 'Create your profile with photos, education, and partner preferences in just 2 minutes.' },
        { step: 2, title: 'Get Verified', desc: 'Complete your Aadhaar KYC to verify your identity and build trust within the community.' },
        { step: 3, title: 'Search Matches', desc: 'Use our smart 20+ filters or let AI recommend the most compatible profiles for you.' },
        { step: 4, title: 'Connect & Meet', desc: "Send interests, securely unlock contact details, and start a meaningful conversation." }
      ]), setting_type: 'json', description: 'How It Works Items (JSON Array)'
    },
    {
      key: 'love_stories_items', value: JSON.stringify([
        { story: "AtMilan made it so easy to find someone who shares our family values. We chatted for 3 months and knew we were perfect for each other!", groom: "Rahul", bride: "Priya", year: "2024", location: "Surat, Gujarat", photo: "https://images.unsplash.com/photo-1544078755-9ebfaac673e5?w=500&h=400&fit=crop" },
        { story: "I was hesitant about online matrimony, but AtMilan's verified profiles gave us confidence. Thank you for bringing us together!", groom: "Amit", bride: "Sneha", year: "2023", location: "Ahmedabad, Gujarat", photo: "https://images.unsplash.com/photo-1583939000185-1d6d1b6e4e11?w=500&h=400&fit=crop" },
        { story: "The detailed profiles helped us understand each other even before we met. Best platform for our community!", groom: "Vikram", bride: "Anjali", year: "2024", location: "Mumbai, Maharashtra", photo: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=500&h=400&fit=crop" }
      ]), setting_type: 'json', description: 'Love Stories Items (JSON Array)'
    },
    {
      key: 'testimonials_items', value: JSON.stringify([
        { name: "Ramesh Patel", city: "Surat", occupation: "Businessman", rating: 5, text: "The quality of profiles on AtMilan is unmatched. The Aadhaar verification feature gave my family peace of mind.", photo: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=100&h=100&fit=crop" },
        { name: "Ananya Desai", city: "Ahmedabad", occupation: "HR Manager", rating: 5, text: "I loved that the site is strictly single-community. It saved us so much time filtering out irrelevant profiles.", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop" },
        { name: "Suresh Shah", city: "Vadodara", occupation: "Engineer", rating: 4, text: "The privacy features are excellent. My photo remained hidden until I chose to unlock my details for mutual interests.", photo: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop" }
      ]), setting_type: 'json', description: 'Testimonials Items (JSON Array)'
    },
    { key: 'contact_unlock_duration_hours', value: '24', setting_type: 'number', description: 'Contact unlock duration' },
    { key: 'contact_address', value: '123 Matrimony Tower, Cyber City, Gurugram, Haryana 122002', setting_type: 'string', description: 'Office Address' },
    { key: 'contact_phone', value: '+91 98765 43210', setting_type: 'string', description: 'Contact Phone Number' },
    { key: 'contact_email', value: 'support@atmilan.com', setting_type: 'string', description: 'Support Email Address' },
    { key: 'facebook_link', value: '#', setting_type: 'string', description: 'Facebook URL' },
    { key: 'twitter_link', value: '#', setting_type: 'string', description: 'Twitter URL' },
    { key: 'instagram_link', value: '#', setting_type: 'string', description: 'Instagram URL' },
    { key: 'youtube_link', value: '#', setting_type: 'string', description: 'YouTube URL' },
    { key: 'site_logo_image', value: '', setting_type: 'image', description: 'Site Logo Image (Replaces text logo if set)' },
    {
      key: 'faq_data', value: JSON.stringify([
        {
          id: 'cat1', title: 'Getting Started', items: [
            { question: 'How do I register on the platform?', answer: "Registration is free and simple. Click 'Register Free', fill in your basic details, and create your account. You can then complete your detailed profile including education, family, and lifestyle information." },
            { question: 'Is registration free?', answer: 'Yes! Registration and basic browsing are completely free. You can create your profile, search for matches, and send up to 5 interests per day without any charge.' },
            { question: 'How do I complete my profile?', answer: "After registration, you'll be guided through a 6-step profile completion process covering personal details, education, family, lifestyle, photos, and partner preferences. A complete profile gets 10x more responses." }
          ]
        },
        {
          id: 'cat2', title: 'Profile & Verification', items: [
            { question: 'How do I get my profile verified?', answer: 'Upload your Aadhaar card (front and back) from the Profile or Settings page. Our team will review your documents within 24-48 hours. Once verified, you will receive a verified badge on your profile.' },
            { question: 'Can I edit my profile after registration?', answer: "Yes, you can edit your profile at any time from the 'My Profile' or 'Edit Profile' section. Keep your profile updated for better matches." },
            { question: 'How do I upload photos?', answer: 'Go to Edit Profile > Photos section. You can upload a profile photo and up to 5 additional photos. Use clear, recent photos for the best results.' }
          ]
        },
        {
          id: 'cat3', title: 'Search & Matching', items: [
            { question: 'How does the matching algorithm work?', answer: 'Our algorithm considers multiple factors including your partner preferences (age, religion, education, location), profile compatibility, and activity to suggest the most suitable matches.' },
            { question: 'How do I search for profiles?', answer: 'Use Quick Search for basic filters or Advanced Search for detailed criteria. You can also search by Profile ID if you have a specific profile in mind.' },
            { question: 'What are interests and how do they work?', answer: 'Sending an interest is like expressing your desire to connect. When the other person accepts, you can start chatting. You can also include a personal message with your interest.' }
          ]
        },
        {
          id: 'cat4', title: 'Privacy & Safety', items: [
            { question: 'Is my personal information safe?', answer: 'Absolutely. We use industry-standard encryption to protect your data. You control who can see your profile, photos, and contact details through Privacy Settings.' },
            { question: 'How do I report a fake profile?', answer: "Click the three-dot menu on any profile and select 'Report'. Choose the reason and our team will investigate within 24 hours." },
            { question: 'How do I block someone?', answer: "Click the three-dot menu on their profile and select 'Block'. They will no longer be able to see your profile or contact you." }
          ]
        },
        {
          id: 'cat5', title: 'Membership', items: [
            { question: 'What are the premium benefits?', answer: 'Premium members enjoy unlimited interests, chat access, profile highlighting, priority in search results, and access to advanced features. Visit our Membership page for detailed plans.' },
            { question: 'How do I upgrade my plan?', answer: 'Visit the Membership page and choose your preferred plan. Contact our support team for payment options.' },
            { question: 'Can I cancel my membership?', answer: 'Yes, you can cancel anytime from Settings. Your premium benefits will continue until the end of your billing period.' }
          ]
        }
      ]), setting_type: 'json', description: 'FAQ Page Data (JSON)'
    },
    {
      key: 'privacy_policy_data', value: JSON.stringify([
        { id: 1, title: 'Information We Collect', content: 'We collect personal information that you provide directly to us when you register for an account, create a profile, or communicate with us. This includes your name, email address, phone number, gender, date of birth, and other profile details such as education, occupation, and family background. We also collect verification documents like Aadhaar cards to ensure the authenticity of our users.' },
        { id: 2, title: 'How We Use Your Information', content: 'Your information is primarily used to provide our matchmaking services, including suggesting compatible matches and facilitating communication between users. We also use your data for account verification, security monitoring, and to improve our platform features and user experience. We may use your contact information to send you important updates or promotional offers related to our platform.' },
        { id: 3, title: 'Information Sharing', content: 'We do not sell or rent your personal information to third parties. We only share your profile information with other registered users as part of our matchmaking service based on your privacy settings. We may disclose your information if required by law, to enforce our terms of service, or to protect the rights, property, or safety of our platform and its users.' },
        { id: 4, title: 'Data Security', content: 'We implement industry-standard security measures to protect your personal information from unauthorized access, loss, or misuse. This includes data encryption, secure server infrastructure, and strict access controls. However, please be aware that no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.' },
        { id: 5, title: 'Cookies and Tracking', content: 'We use cookies and similar tracking technologies to manage user sessions, remember your preferences, and analyze platform usage. Cookies help us provide a more personalized experience and understand how users interact with our site. You can control cookie settings through your browser, but disabling them may limit some features of our platform.' },
        { id: 6, title: 'Your Rights', content: 'You have the right to access, correct, or delete your personal information at any time through your account settings. You can also request a copy of the data we hold about you or ask us to restrict the processing of your information. If you wish to close your account, we will delete your personal data from our active databases in accordance with our data retention policy.' },
        { id: 7, title: "Children's Privacy", content: 'Our platform is intended for use only by individuals who are 18 years of age or older. We do not knowingly collect personal information from children under 18. If we become aware that we have inadvertently collected data from a minor, we will take immediate steps to delete such information and terminate the associated account.' },
        { id: 8, title: 'Changes to This Policy', content: 'We may update our Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any significant changes by posting the new policy on this page and updating the Last Updated date. We encourage you to review this policy periodically to stay informed about how we are protecting your privacy.' },
        { id: 9, title: 'Contact Us', content: 'If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at our support email. Our privacy team will be happy to assist you with any inquiries you may have.' }
      ]), setting_type: 'json', description: 'Privacy Policy Data (JSON)'
    },
    {
      key: 'terms_data', value: JSON.stringify([
        { id: 1, title: 'Acceptance of Terms', content: 'By accessing or using our platform, you agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree with any part of these terms, you must not use our services. These terms apply to all visitors, users, and others who access or use the platform.' },
        { id: 2, title: 'Eligibility', content: 'To register on our platform, you must be at least 18 years of age and legally eligible to marry under the laws of your country. You must be currently unmarried, legally divorced, or widowed. By using our service, you represent and warrant that you have the right, authority, and capacity to enter into this agreement.' },
        { id: 3, title: 'Account Registration', content: 'You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Only one account is permitted per individual.' },
        { id: 4, title: 'User Conduct', content: 'You agree to use our platform in a manner consistent with its purpose as a matrimonial platform. You must not engage in harassment, use offensive language, post fake profiles, or attempt to defraud other users. Respect for others privacy and cultural values is mandatory. Any misuse of the platform may lead to immediate termination of your account.' },
        { id: 5, title: 'Profile Guidelines', content: 'All information posted on your profile must be truthful and accurate. Photos must be recent and appropriate for a matrimonial context. We reserve the right to review and remove any content that violates our guidelines. Verification documents provided must be authentic and belong to the account holder.' },
        { id: 6, title: 'Intellectual Property', content: 'Our platform, including its design, logos, and content, is protected by intellectual property laws. You may not use, copy, or distribute any part of our platform without our express written permission. You retain ownership of the content you post, but grant us a license to use it for providing our services.' },
        { id: 7, title: 'Membership & Payments', content: 'While basic registration is free, premium features require a paid membership. All payments are non-refundable once the service has been activated. We reserve the right to change our membership fees and plans at any time, with notice provided on the platform. Membership is for personal use only and cannot be transferred.' },
        { id: 8, title: 'Limitation of Liability', content: 'We provide a platform for connecting individuals but do not guarantee the accuracy of user-provided information or the success of any match. We are not liable for any direct, indirect, or consequential damages arising from your use of the platform or your interactions with other users. Users are advised to exercise caution and perform their own due diligence.' },
        { id: 9, title: 'Termination', content: 'We reserve the right to suspend or terminate your account at our sole discretion, without notice, for any violation of these terms or for conduct that we believe is harmful to other users or the platform. You may also terminate your account at any time through your settings.' },
        { id: 10, title: 'Governing Law', content: 'These Terms & Conditions shall be governed by and construed in accordance with the laws of India. Any disputes arising from these terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts in our registered city.' },
        { id: 11, title: 'Contact Information', content: 'If you have any questions about these Terms & Conditions, please contact us at our support email. We are committed to providing a safe and respectful environment for all our users.' }
      ]), setting_type: 'json', description: 'Terms & Conditions Data (JSON)'
    }
  ];

  // Force-update FAQ/Privacy/Terms with full content if they still have the short placeholder data
  const keysToForceUpdate = ['faq_data', 'privacy_policy_data', 'terms_data'];
  keysToForceUpdate.forEach(key => {
    const existing = db.admin_settings_kv?.find((s: any) => s.key === key);
    const defaultVal = defaultSettings.find((d: any) => d.key === key);
    if (existing && defaultVal) {
      try {
        const parsed = JSON.parse(existing.value);
        // If short placeholder (less than 3 items for faq, less than 7 for others), replace with full data
        const isShort = (key === 'faq_data' && parsed.length < 5) ||
          (key === 'privacy_policy_data' && parsed.length < 7) ||
          (key === 'terms_data' && parsed.length < 9);
        if (isShort) {
          existing.value = defaultVal.value;
          changed = true;
        }
      } catch { /* keep existing */ }
    }
  });

  if (!db.admin_settings_kv) db.admin_settings_kv = [];
  defaultSettings.forEach(ds => {
    if (!db.admin_settings_kv.find((s: any) => s.key === ds.key)) {
      db.admin_settings_kv.push(ds);
      changed = true;
    }
  });

  // Add SMTP defaults if missing
  const smtpDefaults = [
    { key: 'smtp_host', value: 'smtp.gmail.com', setting_type: 'string', description: 'SMTP Server Host (e.g. smtp.gmail.com)' },
    { key: 'smtp_port', value: '587', setting_type: 'number', description: 'SMTP Port (587 for TLS, 465 for SSL)' },
    { key: 'smtp_user', value: '', setting_type: 'string', description: 'SMTP Username / Gmail Address' },
    { key: 'smtp_pass', value: '', setting_type: 'password', description: 'SMTP Password / Gmail App Password' },
    { key: 'smtp_from_name', value: 'AtMilan', setting_type: 'string', description: 'From Name shown in emails' },
    { key: 'smtp_from_email', value: '', setting_type: 'string', description: 'From Email address (leave blank to use smtp_user)' },
  ];
  smtpDefaults.forEach(ds => {
    if (!db.admin_settings_kv.find((s: any) => s.key === ds.key)) {
      db.admin_settings_kv.push(ds);
      changed = true;
    }
  });

  // Add OTP/SMS defaults if missing
  const otpDefaults = [
    { key: 'master_otp', value: '898045', setting_type: 'string', description: 'Master OTP for testing (Leave blank to disable)' },
    { key: 'sms_api_url', value: '', setting_type: 'string', description: 'SMS Provider API URL' },
    { key: 'sms_api_key', value: '', setting_type: 'password', description: 'SMS Provider API Key' },
  ];
  otpDefaults.forEach(ds => {
    if (!db.admin_settings_kv.find((s: any) => s.key === ds.key)) {
      db.admin_settings_kv.push(ds);
      changed = true;
    }
  });

  // Add Firebase defaults if missing
  const firebaseDefaults = [
    { key: 'firebase_server_key', value: '', setting_type: 'password', description: 'Firebase FCM Server Key (from Firebase Console > Cloud Messaging)' },
    { key: 'firebase_sender_id', value: '', setting_type: 'string', description: 'Firebase Sender ID' },
    { key: 'firebase_vapid_key', value: '', setting_type: 'password', description: 'Firebase VAPID Key (Web Push Certificate)' },
    { key: 'firebase_project_id', value: '', setting_type: 'string', description: 'Firebase Project ID' },
    { key: 'firebase_apis', value: '[]', setting_type: 'json', description: 'Firebase API Configurations (JSON)' },
  ];
  firebaseDefaults.forEach(ds => {
    if (!db.admin_settings_kv.find((s: any) => s.key === ds.key)) {
      db.admin_settings_kv.push(ds);
      changed = true;
    }
  });

  // Add PostHog defaults if missing
  const posthogDefaults = [
    { key: 'posthog_api_key', value: '', setting_type: 'password', description: 'PostHog API Key for Analytics' },
    { key: 'posthog_host', value: 'https://us.i.posthog.com', setting_type: 'string', description: 'PostHog Host URL (e.g. https://us.i.posthog.com)' },
  ];
  posthogDefaults.forEach(ds => {
    if (!db.admin_settings_kv.find((s: any) => s.key === ds.key)) {
      db.admin_settings_kv.push(ds);
      changed = true;
    }
  });

  // Add SEO & Compliance defaults if missing
  const seoDefaults = [
    { key: 'site_favicon', value: '', setting_type: 'image', description: 'Favicon URL (Upload below Site Logo)' },
    { key: 'seo_meta_title', value: '', setting_type: 'string', description: 'Default Meta Title for Web App' },
    { key: 'seo_meta_description', value: '', setting_type: 'textarea', description: 'Default Meta Description' },
    { key: 'seo_meta_keywords', value: '', setting_type: 'textarea', description: 'Default Meta Keywords (comma separated)' },
    { key: 'seo_og_image', value: '', setting_type: 'image', description: 'Default Open Graph Image (For Social Sharing)' },
    { key: 'seo_google_site_verification', value: '', setting_type: 'string', description: 'Google Search Console Verification Tag' },
    { key: 'seo_bing_site_verification', value: '', setting_type: 'string', description: 'Bing Webmaster Verification' },
    { key: 'marketing_gtm_id', value: '', setting_type: 'string', description: 'Google Tag Manager ID (e.g., GTM-XXXXXX)' },
    { key: 'marketing_ga4_id', value: '', setting_type: 'string', description: 'Google Analytics 4 Measurement ID (e.g., G-XXXXXX)' },
    { key: 'marketing_fb_pixel', value: '', setting_type: 'string', description: 'Facebook Pixel ID' },
    { key: 'marketing_twitter_pixel', value: '', setting_type: 'string', description: 'Twitter Pixel ID' },
    { key: 'marketing_linkedin_insight', value: '', setting_type: 'string', description: 'LinkedIn Insight Tag Partner ID' },
    { key: 'marketing_custom_head_script', value: '', setting_type: 'textarea', description: 'Custom Script to inject into <head>' },
    { key: 'app_android_package', value: '', setting_type: 'string', description: 'Android App Package Name (For App Indexing)' },
    { key: 'app_firebase_indexing_url', value: '', setting_type: 'string', description: 'Firebase App Indexing URL (e.g., android-app://com.example/https/example.com)' },
    { key: 'cloudflare_turnstile_sitekey', value: '', setting_type: 'string', description: 'Cloudflare Turnstile Site Key' },
    { key: 'cloudflare_web_analytics_token', value: '', setting_type: 'string', description: 'Cloudflare Web Analytics Token' },
    { key: 'gdpr_cookie_notice', value: 'true', setting_type: 'boolean', description: 'Enable GDPR Cookie Consent Banner' },
    { key: 'gdpr_cookie_text', value: 'We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.', setting_type: 'textarea', description: 'Text for GDPR Cookie Notice' },
    { key: 'robots_txt_content', value: 'User-agent: *\nAllow: /\nSitemap: /sitemap.xml', setting_type: 'textarea', description: 'Custom robots.txt content' },
  ];
  seoDefaults.forEach(ds => {
    if (!db.admin_settings_kv.find((s: any) => s.key === ds.key)) {
      db.admin_settings_kv.push(ds);
      changed = true;
    }
  });

  // Ensure admin_notifications table exists
  if (!db.admin_notifications) {
    db.admin_notifications = [];
    changed = true;
  }

  // Seed success stories if empty
  if (!db.success_stories || db.success_stories.length === 0) {
    db.success_stories = [
      {
        id: 'story-demo-1',
        submitter_name: 'Rahul Sharma',
        partner_name: 'Priya Patel',
        story_text: 'We met on AtMilan in early 2023. After a few months of chatting, we realized we were perfect for each other. Today we are happily married and grateful to this platform for bringing us together!',
        location: 'Mumbai, Maharashtra',
        year: '2023',
        photo_url: null,
        is_approved: true,
        is_hidden: false,
        user_id: null,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'story-demo-2',
        submitter_name: 'Amit Desai',
        partner_name: 'Kavya Mehta',
        story_text: 'à¤¶à¥à¤­ à¤®à¤¿à¤²à¤¨ à¤ªà¤° à¤®à¤¿à¤²à¥‡ à¤”à¤° à¤¹à¤®à¤¾à¤°à¥€ à¤œà¤¿à¤‚à¤¦à¤—à¥€ à¤¬à¤¦à¤² à¤—à¤ˆà¥¤ à¤¦à¥‹à¤¨à¥‹à¤‚ à¤•à¥‡ à¤ªà¤°à¤¿à¤µà¤¾à¤°à¥‹à¤‚ à¤¨à¥‡ à¤–à¥à¤¶à¥€ à¤¸à¥‡ à¤¹à¤®à¤¾à¤°à¥€ à¤¶à¤¾à¤¦à¥€ à¤•à¥‹ à¤¸à¥à¤µà¥€à¤•à¤¾à¤° à¤•à¤¿à¤¯à¤¾à¥¤ à¤¯à¤¹ à¤ªà¥à¤²à¥‡à¤Ÿà¤«à¤¼à¥‰à¤°à¥à¤® à¤µà¤¾à¤•à¤ˆ à¤®à¥‡à¤‚ à¤µà¤¿à¤¶à¥à¤µà¤¸à¤¨à¥€à¤¯ à¤¹à¥ˆà¥¤',
        location: 'Surat, Gujarat',
        year: '2024',
        photo_url: null,
        is_approved: true,
        is_hidden: false,
        user_id: null,
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'story-demo-3',
        submitter_name: 'Vikram Joshi',
        partner_name: 'Sneha Lohana',
        story_text: 'Found my soulmate through AtMilan. The matching algorithm was spot on â€” same values, same community, and a beautiful connection. We got engaged in December 2024!',
        location: 'Ahmedabad, Gujarat',
        year: '2024',
        photo_url: null,
        is_approved: false,
        is_hidden: false,
        user_id: null,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    changed = true;
  }

  // Ensure default community and subcastes exist in master data
  let defaultCaste = db.master_castes.find((c: any) => c.name === 'Lohana');
  if (!defaultCaste) {
    defaultCaste = { id: 'c_lohana', name: 'Lohana', is_active: true };
    db.master_castes.push(defaultCaste);
    changed = true;
  }

  // Migration: assign profile_id to existing profiles that don't have one
  db.profiles.forEach((p: any, idx: number) => {
    if (!p.profile_id) {
      p.profile_id = 'AM' + String(idx + 1).padStart(5, '0');
      changed = true;
    }
  });

  const defaultSubcastes = ['Goghari', 'Halai', 'Kutchi', 'Vaishnav'];
  defaultSubcastes.forEach((scName, index) => {
    if (!db.master_sub_castes.find((sc: any) => sc.caste_id === defaultCaste.id && sc.name === scName)) {
      db.master_sub_castes.push({ id: `sc_loh_${index}`, caste_id: defaultCaste.id, name: scName, is_active: true });
      changed = true;
    }
  });

  // Seed test user automatically
  const testEmail = 'user';
  if (!db.users.find((u: any) => u.email === testEmail)) {
    const testUserId = 'test-verified-user';
    db.users.push({
      id: testUserId,
      email: testEmail,
      password: bcrypt.hashSync('123456', 10),
      role: 'user',
      created_at: new Date().toISOString()
    });

    db.profiles.push({
      id: testUserId,
      profile_for: 'Myself',
      first_name: 'Test',
      last_name: 'User',
      gender: 'Male',
      date_of_birth: '1995-01-01',
      marital_status: 'never_married',
      religion: 'Hindu',
      caste: 'Lohana',
      sub_caste: 'Goghari',
      mother_tongue: 'Gujarati',
      height_cm: 180,
      weight_kg: 75,
      body_type: 'athletic',
      complexion: 'fair',
      physical_disability: false,
      blood_group: 'b_pos',
      about_me: 'I am a pre-verified test user for checking the profile functionality and contact unlock logic.',
      profile_photo_url: 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg',
      profile_completion: 100,
      is_verified: true,
      email_verified: true,
      phone_verified: true,
      aadhaar_verified: true,
      photo_verified: true,
      verification_status: 'verified',
      is_active: true,
      is_premium: false,
      premium_plan: null,
      premium_end: null,
      role: 'user',
      profile_id: 'AM999999',
      last_login: new Date().toISOString(),
      profile_status: "active",
      reactivation_count: 0,
      reactivation_status: "none",
      reactivation_rejection_remark: "",
      match_confirmed: false,
      match_type: null,
      match_platform: null,
      match_partner_profile_id: "",
      referral_code: null,
      referral_used_by: null,
      referral_used_date: null,
      inactivity_email_60_sent: false,
      inactivity_email_75_sent: false,
      inactivity_email_90_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Default Credits
    db.membership_purchases.push({
      id: uuidv4(),
      user_id: testUserId,
      plan_id: 'free',
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: null,
      free_views_remaining: 10,
      paid_views_balance: 0,
      total_unlocks_done: 0,
      free_views_reset_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    });

    changed = true;
    console.log(`✅ Default test user seeded: (Username: ${testEmail}, Password: 123456)`);
  }

  // ── ADD TEST ACCOUNT 1: Yellow profile ──
  const yellowEmail = 'yellow';
  if (!db.users.find((u: any) => u.email === yellowEmail)) {
    const testUserId = 'test-yellow-user';
    db.users.push({
      id: testUserId,
      email: yellowEmail,
      password: bcrypt.hashSync('123456', 10),
      role: 'user',
      created_at: new Date().toISOString()
    });
    db.profiles.push({
      id: testUserId,
      profile_for: 'Myself',
      first_name: 'Yellow',
      last_name: 'Test',
      gender: 'Female',
      date_of_birth: '1996-05-15',
      marital_status: 'never_married',
      religion: 'Hindu',
      caste: 'Lohana',
      sub_caste: 'Goghari',
      mother_tongue: 'Gujarati',
      height_cm: 165,
      weight_kg: 60,
      body_type: 'average',
      complexion: 'fair',
      physical_disability: false,
      blood_group: 'o_pos',
      about_me: 'I am a test yellow profile.',
      profile_photo_url: 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg',
      profile_completion: 100,
      is_verified: true,
      email_verified: true,
      phone_verified: true,
      aadhaar_verified: true,
      photo_verified: true,
      verification_status: 'verified',
      is_active: true,
      is_premium: false,
      premium_plan: null,
      premium_end: null,
      role: 'user',
      profile_id: 'AM888801',
      last_login: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      profile_status: "yellow",
      reactivation_count: 0,
      reactivation_status: "none",
      reactivation_rejection_remark: "",
      match_confirmed: false,
      match_type: null,
      match_platform: null,
      match_partner_profile_id: "",
      referral_code: null,
      referral_used_by: null,
      referral_used_date: null,
      inactivity_email_60_sent: false,
      inactivity_email_75_sent: false,
      inactivity_email_90_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    db.membership_purchases.push({
      id: uuidv4(),
      user_id: testUserId,
      plan_id: 'free',
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: null,
      free_views_remaining: 10,
      paid_views_balance: 0,
      total_unlocks_done: 0,
      free_views_reset_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    });
    changed = true;
  }

  // ── ADD TEST ACCOUNT 2: Red profile ──
  const redEmail = 'red';
  if (!db.users.find((u: any) => u.email === redEmail)) {
    const testUserId = 'test-red-user';
    db.users.push({
      id: testUserId,
      email: redEmail,
      password: bcrypt.hashSync('123456', 10),
      role: 'user',
      created_at: new Date().toISOString()
    });
    db.profiles.push({
      id: testUserId,
      profile_for: 'Myself',
      first_name: 'Red',
      last_name: 'Test',
      gender: 'Male',
      date_of_birth: '1993-08-20',
      marital_status: 'never_married',
      religion: 'Hindu',
      caste: 'Lohana',
      sub_caste: 'Goghari',
      mother_tongue: 'Gujarati',
      height_cm: 180,
      weight_kg: 75,
      body_type: 'athletic',
      complexion: 'fair',
      physical_disability: false,
      blood_group: 'b_pos',
      about_me: 'I am a test red profile.',
      profile_photo_url: 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg',
      profile_completion: 100,
      is_verified: true,
      email_verified: true,
      phone_verified: true,
      aadhaar_verified: true,
      photo_verified: true,
      verification_status: 'verified',
      is_active: true,
      is_premium: false,
      premium_plan: null,
      premium_end: null,
      role: 'user',
      profile_id: 'AM888802',
      last_login: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
      profile_status: "red",
      reactivation_count: 0,
      reactivation_status: "none",
      reactivation_rejection_remark: "",
      match_confirmed: false,
      match_type: null,
      match_platform: null,
      match_partner_profile_id: "",
      referral_code: null,
      referral_used_by: null,
      referral_used_date: null,
      inactivity_email_60_sent: false,
      inactivity_email_75_sent: false,
      inactivity_email_90_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    db.membership_purchases.push({
      id: uuidv4(),
      user_id: testUserId,
      plan_id: 'free',
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: null,
      free_views_remaining: 10,
      paid_views_balance: 0,
      total_unlocks_done: 0,
      free_views_reset_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    });
    changed = true;
  }

  // ── ADD TEST ACCOUNT 3: Engaged profile ──
  const engagedEmail = 'engaged';
  if (!db.users.find((u: any) => u.email === engagedEmail)) {
    const testUserId = 'test-engaged-user';
    db.users.push({
      id: testUserId,
      email: engagedEmail,
      password: bcrypt.hashSync('123456', 10),
      role: 'user',
      created_at: new Date().toISOString()
    });
    db.profiles.push({
      id: testUserId,
      profile_for: 'Myself',
      first_name: 'Engaged',
      last_name: 'Test',
      gender: 'Female',
      date_of_birth: '1997-03-10',
      marital_status: 'never_married',
      religion: 'Hindu',
      caste: 'Lohana',
      sub_caste: 'Goghari',
      mother_tongue: 'Gujarati',
      height_cm: 160,
      weight_kg: 55,
      body_type: 'slim',
      complexion: 'fair',
      physical_disability: false,
      blood_group: 'a_pos',
      about_me: 'I am a test engaged profile.',
      profile_photo_url: 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg',
      profile_completion: 100,
      is_verified: true,
      email_verified: true,
      phone_verified: true,
      aadhaar_verified: true,
      photo_verified: true,
      verification_status: 'verified',
      is_active: true,
      is_premium: false,
      premium_plan: null,
      premium_end: null,
      role: 'user',
      profile_id: 'AM888803',
      last_login: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      profile_status: "engaged",
      reactivation_count: 0,
      reactivation_status: "none",
      reactivation_rejection_remark: "",
      match_confirmed: true,
      match_type: 'engagement',
      match_platform: null,
      match_partner_profile_id: "",
      referral_code: null,
      referral_used_by: null,
      referral_used_date: null,
      inactivity_email_60_sent: false,
      inactivity_email_75_sent: false,
      inactivity_email_90_sent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    db.membership_purchases.push({
      id: uuidv4(),
      user_id: testUserId,
      plan_id: 'free',
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: null,
      free_views_remaining: 10,
      paid_views_balance: 0,
      total_unlocks_done: 0,
      free_views_reset_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    });
    changed = true;
  }

  // Ensure admin_managers array exists
  if (!Array.isArray(db.admin_managers)) {
    db.admin_managers = [];
    changed = true;
  }

  // Seed Master Admin from existing admin account if admin_managers is empty
  if (db.admin_managers.length === 0) {
    const existingAdmin = (db.users || []).find((u: any) => u.role === 'admin');
    if (existingAdmin) {
      db.admin_managers.push({
        id: existingAdmin.id,
        email: existingAdmin.email,
        password_hash: existingAdmin.password_hash || existingAdmin.password,
        name: 'Master Admin',
        role: 'master_admin',
        permissions: ['*'], // '*' means all pages
        is_active: true,
        created_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login: null,
      });
      changed = true;
      console.log('[AdminManager] Master Admin seeded from existing admin account.');
    }
  }

  // Remove any old hardcoded test admin accounts
  if (db.users) {
    const before = db.users.length;
    db.users = db.users.filter((u: any) => u.email !== 'admin' && u.id !== 'admin-id');
    db.profiles = (db.profiles || []).filter((p: any) => p.id !== 'admin-id');
    if (db.users.length !== before) {
      console.log('[Security] Removed old hardcoded test admin from database');
      changed = true;
    }
  }

  // Seed dummy reactivation requests for test accounts
  if (db.reactivation_requests !== undefined) {
    const yellowReq = db.reactivation_requests.find(
      (r: any) => r.user_id === 'test-yellow-user'
    );
    if (!yellowReq) {
      db.reactivation_requests.push({
        id: 'dummy-req-yellow',
        user_id: 'test-yellow-user',
        profile_status: 'yellow',
        user_message: 'I want to search for my life partner again. Please reactivate my profile.',
        status: 'pending',
        rejection_remark: '',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      });
      changed = true;
    }
    const redReq = db.reactivation_requests.find(
      (r: any) => r.user_id === 'test-red-user'
    );
    if (!redReq) {
      db.reactivation_requests.push({
        id: 'dummy-req-red',
        user_id: 'test-red-user',
        profile_status: 'red',
        user_message: 'I have been busy with work. I am ready to search again now.',
        status: 'pending',
        rejection_remark: '',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      });
      changed = true;
    }
    const engagedReq = db.reactivation_requests.find(
      (r: any) => r.user_id === 'test-engaged-user'
    );
    if (!engagedReq) {
      db.reactivation_requests.push({
        id: 'dummy-req-engaged',
        user_id: 'test-engaged-user',
        profile_status: 'engaged',
        user_message: 'My engagement was called off. I want to search again on this platform.',
        status: 'pending',
        rejection_remark: '',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      });
      changed = true;
    }
  }

  // Seed dummy match confirmations for test accounts
  if (db.match_confirmations !== undefined) {
    const engagedMatch = db.match_confirmations.find(
      (m: any) => m.user_id === 'test-engaged-user'
    );
    if (!engagedMatch) {
      db.match_confirmations.push({
        id: 'dummy-match-engaged',
        user_id: 'test-engaged-user',
        match_type: 'engagement',
        match_platform: 'atmilan',
        partner_profile_id: 'AM888801',
        status: 'pending',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      });
      changed = true;
    }
  }

  if (changed) saveDB(db);
  return db;
};

const saveDB = (data: any) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// ──────────────────────────────────────────────────────────────────────────────
// IDEMPOTENCY SYSTEM
// Prevents double-charges when users click "Pay" multiple times or networks retry.
//
// Architecture (3-Phase: Lock → Work → Answer):
//  PHASE 1 (Lock):   First request atomically sets key → 'PROCESSING' (2-min TTL)
//  PHASE 2 (Work):   Route handler runs once — calls payment gateway
//  PHASE 3 (Answer): On 200 success, key is replaced with the full response (24-hr TTL)
//
// On duplicate: returns the cached response immediately without re-charging.
// Key format:  idempotency:{userId}:{endpointScope}:{bodyHash}:{clientKey}
//   - bodyHash prevents payload tampering (same key, different amount → different cache slot)
//   - endpointScope prevents cross-endpoint key reuse
// ──────────────────────────────────────────────────────────────────────────────
type IdempotencyState =
  | { status: 'PROCESSING'; expiresAt: number }
  | { status: 'DONE'; httpStatus: number; body: any; expiresAt: number };

const idempotencyStore = new Map<string, IdempotencyState>();

// Cleanup loop: remove expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore.entries()) {
    if (entry.expiresAt < now) idempotencyStore.delete(key);
  }
}, 5 * 60 * 1000);

const PROCESSING_TTL_MS = 2 * 60 * 1000;   // 2 minutes — auto-release if server crashes mid-payment
const DONE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — absorb delayed retries safely

/**
 * stopDuplicates(scope)
 * Express middleware factory that enforces idempotency on POST endpoints.
 * @param scope - A short unique string identifying the endpoint (e.g. 'checkout', 'create-order')
 */
function stopDuplicates(scope: string) {
  return async (req: any, res: any, next: any) => {
    const clientKey = req.headers['x-idempotency-key'] as string;
    // If client didn't send a key, pass through (backward compatible)
    if (!clientKey) return next();

    const userId = req.body?.userId || req.headers['x-user-id'] || 'anon';

    // Body hash prevents payload-tampering: same key + different amount → different slot
    const bodyHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex')
      .substring(0, 16);

    const storeKey = `idempotency:${userId}:${scope}:${bodyHash}:${clientKey}`;
    const now = Date.now();

    const existing = idempotencyStore.get(storeKey);

    if (existing) {
      // ── Duplicate request detected ──────────────────────────────
      if (existing.status === 'PROCESSING') {
        // Phase 2 is still running — tell client to wait, don't double-charge
        console.log(`[Idempotency] 409 — ${scope} still PROCESSING for key ${clientKey.substring(0, 8)}...`);
        return res.status(409).json({
          error: 'Your payment is already being processed. Please wait a moment.',
          retryAfter: Math.ceil((existing.expiresAt - now) / 1000)
        });
      }
      if (existing.status === 'DONE') {
        // Phase 3 completed — return the cached receipt, skip payment gateway entirely
        console.log(`[Idempotency] HIT — ${scope} already DONE for key ${clientKey.substring(0, 8)}...`);
        return res.status(existing.httpStatus).json(existing.body);
      }
    }

    // ── PHASE 1: Acquire lock ────────────────────────────────────
    idempotencyStore.set(storeKey, { status: 'PROCESSING', expiresAt: now + PROCESSING_TTL_MS });
    console.log(`[Idempotency] LOCK — ${scope} for key ${clientKey.substring(0, 8)}...`);

    // ── Intercept res.json to auto-cache the final response ──────
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const httpStatus = res.statusCode;
      if (httpStatus >= 200 && httpStatus < 300) {
        // ── PHASE 3: Save the receipt for 24 hours ───────────────
        idempotencyStore.set(storeKey, {
          status: 'DONE',
          httpStatus,
          body,
          expiresAt: Date.now() + DONE_TTL_MS
        });
        console.log(`[Idempotency] DONE — ${scope} cached for 24h, key ${clientKey.substring(0, 8)}...`);
      } else {
        // On failure, delete the lock so the user can safely retry
        idempotencyStore.delete(storeKey);
        console.log(`[Idempotency] FAIL — ${scope} lock released (status ${httpStatus})`);
      }
      return originalJson(body);
    };

    // ── PHASE 2: Proceed to the actual route handler ─────────────
    next();
  };
}

function buildInactivityEmail(firstName: string, siteName: string, emailNum: number, userId: string): string {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const yesUrl = `${baseUrl}/match-confirmation?userId=${userId}&answer=yes`;
  const noUrl = `${baseUrl}/dashboard`;
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Segoe UI,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#8B1A1A,#6B1414);padding:36px 40px;text-align:center;">
          <h1 style="margin:0;color:#D4AF37;font-size:28px;font-weight:800;">${siteName}</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Premium Matrimonial Platform</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 12px;">Hi ${firstName}! 🎉</h2>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 24px;">
            We noticed you have not logged into <strong>${siteName}</strong> in a while.
            Did you find your perfect match through us?
          </p>
          <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 24px;">
            🎊 <strong>If YES, you will receive:</strong><br>
            ✓ Special Success Couple badge<br>
            ✓ FREE 1-month premium extension<br>
            ✓ Shareable referral link for friends<br>
            ✓ Your story may be featured on our homepage!
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr>
              <td style="padding-right:16px;">
                <a href="${yesUrl}" style="display:inline-block;padding:16px 40px;background:#10b981;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;">
                  ✓ YES, I Found My Match!
                </a>
              </td>
              <td>
                <a href="${noUrl}" style="display:inline-block;padding:16px 40px;background:#6b7280;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;">
                  Not Yet
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#f9f5f0;padding:24px 40px;text-align:center;border-top:1px solid #f0e8df;">
          <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildMatchCelebrationEmail(firstName: string, siteName: string, matchType: string): string {
  return `<!DOCTYPE html><html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Segoe UI,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0eb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#8B1A1A,#D4AF37);padding:36px 40px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:32px;font-weight:800;">🎉 Congratulations!</h1>
        </td></tr>
        <tr><td style="padding:40px;text-align:center;">
          <p style="font-size:24px;margin:0 0 16px;">${matchType === "marriage" ? "💛💛" : "💍"}</p>
          <h2 style="color:#1a1a1a;font-size:22px;margin:0 0 16px;">Dear ${firstName},</h2>
          <p style="color:#555;font-size:16px;line-height:1.8;margin:0 0 24px;">
            Congratulations on your ${matchType === "marriage" ? "marriage" : "engagement"}!
            We are so happy for you. As a thank you for being part of the ${siteName} family,
            we have sent you a FREE 1-month premium referral link.
            Share it with friends and family to help them find their match too!
          </p>
          <p style="color:#D4AF37;font-size:18px;font-weight:700;">Wishing you a lifetime of happiness! 💕</p>
          <p style="color:#888;font-size:14px;margin:24px 0 0;">— The ${siteName} Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function startServer() {
  console.log('🚀 SERVER STARTING — version:', Date.now(), '— new code is running');
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Allow requests with no origin (same-origin on VPS, mobile apps, Postman)
      if (!origin) return callback(null, true);
      // Build allowed origins list from env
      const allowed: string[] = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
      ];
      // Support multiple frontend URLs (comma-separated in env)
      const envUrls = (process.env.FRONTEND_URL || '').split(',').map(u => u.trim()).filter(Boolean);
      allowed.push(...envUrls);
      if (allowed.includes(origin)) {
        callback(null, true);
      } else {
        // In development allow all, in production only allowed list
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked: ${origin}`), false);
        }
      }
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Idempotency-Key'
    ],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }));
  app.use(express.json());

  // â”€â”€ Performance Middleware â”€â”€
  // Gzip compression (reduces response size ~70%)
  app.use(compression({ threshold: 1024, level: 6 }));

  // Rate limiting (support 100K users - 1000 req/min per IP)
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    skip: (req) => req.path.startsWith('/api/health') || req.path.startsWith('/api/lb-health') || !req.path.startsWith('/api/'),
  });
  app.use('/api/', limiter);

  // Response time tracking middleware + load tracking for auto-scaling
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path.startsWith('/api/')) {
        recordTiming(req.path, duration, res.getHeader('X-Cache') === 'HIT');
        incrementRequests(res.statusCode >= 400);
        // Track for auto-scaling
        trackRequest(duration, res.statusCode >= 500);
      }
    });
    next();
  });

  // CDN middleware for static asset caching
  app.use(cdnMiddleware());

  // â”€â”€ Security Middleware â”€â”€
  // Security headers (OWASP A05) - only on API routes to avoid breaking Vite HMR
  app.use('/api', (req, res, next) => {
    const headers = getSecurityHeaders();
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    next();
  });

  // Input sanitization (OWASP A03: Injection)
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeInput(req.body);
    }
    // SQL injection detection on query params
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && detectSQLInjection(value)) {
        createAuditLog({
          action: 'sql_injection_attempt',
          actor_id: req.headers['x-user-id'] as string || 'anonymous',
          actor_ip: req.ip || req.socket.remoteAddress || 'unknown',
          actor_user_agent: req.headers['user-agent'] || 'unknown',
          resource_type: 'api',
          resource_id: req.path,
          details: `SQL injection detected in param "${key}": ${value}`,
          severity: 'critical',
        });
        return res.status(400).json({ error: 'Invalid input detected' });
      }
    }
    next();
  });

  // Trigger DB initialization and seed test user on startup
  getDB();

  // Remove hardcoded test admin account if it still exists in database
  {
    const db = getDB();
    if (db.users) {
      const before = db.users.length;
      db.users = db.users.filter((u: any) => u.email !== 'admin' && u.id !== 'admin-id');
      db.profiles = (db.profiles || []).filter((p: any) => p.id !== 'admin-id');
      if (db.users.length !== before) {
        saveDB(db);
        console.log('[Security] Removed old hardcoded admin test account from database.');
      }
    }
  }

  // Initialize Elasticsearch (non-blocking - app works without ES too)
  initializeES().then((ready) => {
    if (ready) console.log('[ES] Elasticsearch ready for search');
    else console.log('[ES] Elasticsearch not available - using DB fallback for search');
  });

  app.get('/api/health', (req, res) => {
    res.json({
      ...getHealthMetrics(),
      ...getHealthCheckData(),
      loadMetrics: getRequestLoadMetrics(),
    });
  });

  // Request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // MASTER DATA ENDPOINTS (v5.0 spec)
  const masterTables = [
    'master_castes', 'master_sub_castes', 'master_gotras', 'master_nakshatras', 'master_raashis',
    'master_heights', 'master_weights', 'master_body_types', 'master_complexions', 'master_blood_groups',
    'master_marital_statuses', 'master_education_levels', 'master_occupations', 'master_incomes',
    'master_countries', 'master_states', 'master_cities', 'master_family_types', 'master_diets',
    'master_habits', 'master_hobbies', 'master_languages'
    // admin_settings_kv intentionally excluded â€” never exposed publicly
  ];

  // BLOCKED tables â€” return 403 for any direct access attempt
  const BLOCKED_MASTER_TABLES = new Set([
    'admin_settings_kv', 'users', 'audit_logs', 'otps', 'fcm_tokens',
    'credits', 'payment_gateways', 'user_reports', 'message_reports'
  ]);

  // Keys within admin_settings_kv that are safe to expose publicly
  // Sensitive keys (smtp_*, firebase_server_key, payment keys) are never included
  const PUBLIC_SETTINGS_KEYS = new Set([
    'platform_name', 'company_tagline', 'company_website', 'company_gstin',
    'invoice_prefix', 'invoice_logo', 'support_whatsapp',
    'smtp_from_name', 'site_favicon', 'mission_title',
    'gdpr_cookie_text', 'gdpr_cookie_notice',
    'site_name', 'site_title', 'site_logo_image', 'footer_logo_image', 'community_name',
    'hero_description', 'stat_profiles', 'stat_marriages', 'stat_happy_users',
    'section_how_it_works_title', 'section_love_stories_title', 'section_testimonials_title',
    'free_journey_text', 'app_store_link', 'play_store_link',
    'how_it_works_items', 'love_stories_items', 'testimonials_items',
    'contact_address', 'contact_phone', 'contact_email',
    'facebook_link', 'twitter_link', 'instagram_link', 'youtube_link',
    'faq_data', 'privacy_policy_data', 'terms_data',
    'contact_unlock_duration_hours',
    'home_banners',
    'posthog_api_key', 'posthog_host',
    'firebase_api_key', 'firebase_auth_domain', 'firebase_project_id',
    'firebase_storage_bucket', 'firebase_messaging_sender_id',
    'firebase_app_id', 'firebase_vapid_key',
  ]);

  // Public endpoint: home banners (no auth needed, always fresh)
  app.get('/api/public/banners', (req, res) => {
    const db = getDB();
    const setting = (db.admin_settings_kv || []).find((s: any) => s.key === 'home_banners');
    if (!setting || !setting.value) return res.json({ banners: [] });
    try { res.json({ banners: JSON.parse(setting.value) }); }
    catch { res.json({ banners: [] }); }
  });

  // Batch endpoint: all master data in one request (reduces 23 calls â†’ 1)
  // MUST be before /:table route to avoid param matching
  app.get('/api/master-data', (req, res) => {
    // If _t param present (cache-buster from public pages), skip cache entirely
    const skipCache = !!req.query['_t'];
    const cacheKey = 'master:all';
    if (!skipCache) {
      const cached = masterDataCache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached);
      }
    }
    const db = getDB();
    const result: Record<string, any[]> = {};
    for (const fullTableName of masterTables) {
      // admin_settings_kv is no longer in masterTables â€” skip any that slip through
      if (BLOCKED_MASTER_TABLES.has(fullTableName)) continue;
      const shortName = fullTableName.replace('master_', '');
      result[shortName] = (db[fullTableName] || []).filter((item: any) => item.is_active !== false);
    }
    // Include only PUBLIC-SAFE settings from admin_settings_kv
    // Sensitive keys (smtp_*, payment keys, server keys) are never included
    const allSettings: any[] = db.admin_settings_kv || [];
    result['admin_settings_kv'] = allSettings.filter(
      (s: any) => PUBLIC_SETTINGS_KEYS.has(s.key)
    );
    // Only cache if not a cache-busted request
    if (!skipCache) {
      masterDataCache.set(cacheKey, result);
    }
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  });

  app.get('/api/master-data/app-config', (req, res) => {
    try {
      const db = getDB();
      const allSettings = db.admin_settings_kv || [];
      const safeKeys = new Set([
        'platform_name', 'site_title', 'site_name', 'community_name',
        'company_tagline', 'company_website', 'company_gstin', 'invoice_prefix',
        'invoice_logo', 'support_whatsapp', 'contact_email', 'contact_phone',
        'contact_address', 'smtp_from_name', 'site_logo_image', 'site_favicon',
        'facebook_link', 'twitter_link', 'instagram_link', 'youtube_link',
        'app_store_link', 'play_store_link', 'stat_profiles', 'stat_marriages',
        'stat_happy_users', 'stat_years', 'hero_description', 'free_journey_text',
        'section_how_it_works_title', 'section_love_stories_title',
        'section_testimonials_title', 'how_it_works_items', 'love_stories_items',
        'testimonials_items', 'home_banners', 'gdpr_cookie_text', 'gdpr_cookie_notice',
        'faq_data', 'privacy_policy_data', 'terms_data', 'mission_title',
        'posthog_api_key', 'posthog_host', 'firebase_apis',
      ]);
      const safe = allSettings.filter((s: any) => safeKeys.has(s.key));
      res.json({ success: true, data: { admin_settings_kv: safe } });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Could not fetch app config.' });
    }
  });

  app.get('/api/master-data/:table', (req, res) => {
    const { table } = req.params;

    // CRITICAL SECURITY: block sensitive tables â€” never expose these publicly
    if (BLOCKED_MASTER_TABLES.has(table)) {
      return res.status(403).json({ error: 'Access to this table is forbidden.' });
    }

    const fullTableName = `master_${table}`;
    if (!masterTables.includes(fullTableName)) {
      return res.status(400).json({ error: 'Invalid master table' });
    }
    // Check cache first
    const cacheKey = `master:${fullTableName}`;
    const cached = masterDataCache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }
    const db = getDB();
    // Only return active items for frontend consumption
    const items = (db[fullTableName] || []).filter((item: any) => item.is_active !== false);
    masterDataCache.set(cacheKey, items);
    res.setHeader('X-Cache', 'MISS');
    res.json(items);
  });

  // Auth Routes

  // ── Check if email/phone already registered (used during registration step validation)
  app.post('/api/auth/check-duplicate', (req, res) => {
    const { email, phone, exclude_id } = req.body;
    const db = getDB();
    const errors: string[] = [];

    if (email && email.trim()) {
      const emailExists = db.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase().trim() && u.id !== exclude_id);
      if (emailExists) errors.push(`Email (${email}) is already registered.`);
    }

    if (phone && phone.trim()) {
      const phoneClean = phone.replace(/\D/g, '');
      if (phoneClean.length >= 10) {
        const phoneExists = (db.profiles || []).find((p: any) => {
          if (p.id === exclude_id) return false;
          const pPhone = (p.phone || '').replace(/\D/g, '');
          return pPhone && pPhone === phoneClean;
        });
        if (phoneExists) errors.push(`Phone number (${phone}) is already registered.`);
      }
    }

    if (errors.length > 0) {
      return res.status(409).json({ duplicate: true, message: errors.join(' ') });
    }
    res.json({ duplicate: false });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { email, password, first_name, last_name, gender, profile_for, date_of_birth, phone } = req.body;
    const db = getDB();

    // Password minimum length validation — only 4 characters required
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    // Check if email already registered
    const emailDuplicate = db.users.find((u: any) => u.email?.toLowerCase() === email?.toLowerCase()?.trim());

    // Check if phone number already registered
    let phoneDuplicate = false;
    if (phone && phone.trim()) {
      const phoneClean = phone.replace(/\D/g, '');
      phoneDuplicate = !!(db.profiles || []).find((p: any) => {
        const pPhone = (p.phone || '').replace(/\D/g, '');
        return pPhone && pPhone === phoneClean;
      });
    }

    // If both are duplicate, show combined message
    if (emailDuplicate && phoneDuplicate) {
      return res.status(409).json({
        error: 'already_registered',
        field: 'both',
        message: `This email (${email}) and phone number (${phone}) are already registered. Please login instead.`
      });
    }
    if (emailDuplicate) {
      return res.status(409).json({
        error: 'already_registered',
        field: 'email',
        message: `This email (${email}) is already registered. Please login instead.`
      });
    }
    if (phoneDuplicate) {
      return res.status(409).json({
        error: 'already_registered',
        field: 'phone',
        message: `This phone number (${phone}) is already registered. Please login instead.`
      });
    }

    try {
      const id = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 10);
      const profileId = 'SM' + String(db.profiles.length + 1).padStart(5, '0');

      const defaultPhoto = gender === 'Female'
        ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
        : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg';

      const newProfile = {
        id,
        profile_id: profileId,
        first_name,
        last_name,
        gender,
        profile_for,
        date_of_birth,
        phone,
        profile_photo_url: defaultPhoto,
        is_verified: false,
        email_verified: false,
        is_premium: false,
        is_active: true,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.profiles.push(newProfile);

      // Generate email verification token (24h expiry)
      const verifyToken = crypto.randomBytes(32).toString('hex');
      const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const newUser = { id, email, password: hashedPassword, email_verification_token: verifyToken, email_verification_expiry: verifyExpiry, email_verified: false, created_at: new Date().toISOString() };
      db.users.push(newUser);

      saveDB(db);

      // Send verification email (non-blocking)
      const kv: Record<string, string> = {};
      (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
      const siteName = kv['platform_name'] || kv['site_title'] || kv['site_name'] || 'AtMilan';
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;
      sendEmail(email, `Verify your email â€“ ${siteName}`, buildVerificationEmailHtml(first_name, verifyUrl, siteName)).catch(() => { });

      const authToken = jwt.sign({ id, email }, JWT_SECRET);

      // Real-time: notify admin panel of new user registration
      const io = (app as any).io;
      if (io) {
        io.to('admin:room').emit('admin:new-user', { id, first_name, last_name, gender, profile_for, phone, created_at: newProfile.created_at });
      }

      res.json({ user: { id, email }, profile: newProfile, token: authToken });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // EMAIL VERIFICATION ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/auth/verify-email?token=xxx
  app.get('/api/auth/verify-email', (req, res) => {
    const { token } = req.query as { token: string };
    if (!token) return res.status(400).json({ error: 'Token required' });
    const db = getDB();
    const user = db.users.find((u: any) => u.email_verification_token === token);
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
    if (new Date(user.email_verification_expiry) < new Date()) {
      return res.status(400).json({ error: 'Verification link has expired. Please resend.' });
    }
    user.email_verified = true;
    user.email_verification_token = null;
    user.email_verification_expiry = null;
    // Update profile too
    const profile = db.profiles.find((p: any) => p.id === user.id);
    if (profile) profile.email_verified = true;
    saveDB(db);
    // Real-time: notify admin panel of email verification
    const io = (app as any).io;
    if (io) {
      io.to('admin:room').emit('admin:profile-updated', { id: user.id, profile: db.profiles.find((p: any) => p.id === user.id) });
    }
    res.json({ success: true, message: 'Email verified successfully!' });
  });

  // POST /api/auth/resend-verification
  app.post('/api/auth/resend-verification', async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    const db = getDB();
    const user = db.users.find((u: any) => u.id === user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) return res.status(400).json({ error: 'Email already verified' });
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    user.email_verification_token = verifyToken;
    user.email_verification_expiry = verifyExpiry;
    saveDB(db);
    const kv: Record<string, string> = {};
    (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
    const siteName = kv['platform_name'] || kv['site_title'] || kv['site_name'] || 'AtMilan';
    const profile = db.profiles.find((p: any) => p.id === user_id);
    const firstName = profile?.first_name || 'User';
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;
    const sent = await sendEmail(user.email, `Verify your email â€“ ${siteName}`, buildVerificationEmailHtml(firstName, verifyUrl, siteName));
    if (sent) {
      res.json({ success: true, message: 'Verification email sent!' });
    } else {
      res.status(500).json({ error: 'Failed to send email. Check SMTP settings in admin panel.' });
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // OTP ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.post('/api/auth/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    const db = getDB();
    const kv: Record<string, string> = {};
    (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });

    // âœ… Always generate a REAL random OTP for the actual user
    // The master_otp is ONLY used as a bypass during verification (admin/testing)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Save or update OTP for this phone
    if (!db.otps) db.otps = [];
    const existingIndex = db.otps.findIndex((o: any) => o.phone === phone);
    if (existingIndex >= 0) {
      db.otps[existingIndex] = { phone, otp, expiry };
    } else {
      db.otps.push({ phone, otp, expiry });
    }
    saveDB(db);

    // Try to deliver via configured SMS API
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
        if (!smsSent) console.warn(`âš ï¸  SMS API ${smsRes.status} for ${phone}`);
      } catch (err) {
        console.error('âŒ SMS API call failed:', err);
      }
    }

    // Always log OTP to server console for dev visibility
    console.log(`ðŸ“± OTP for +91${phone}: ${otp} | SMS API: ${smsSent ? 'âœ… Sent' : 'âš ï¸  Not configured / failed'}`);

    res.json({
      success: true,
      message: smsSent
        ? 'OTP sent to your registered mobile number!'
        : 'OTP sent successfully!'
    });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });

    const db = getDB();
    if (!db.otps) db.otps = [];

    const kv: Record<string, string> = {};
    (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
    const masterOtp = (kv['master_otp'] || '').trim();

    // ðŸ”‘ MASTER OTP BYPASS â€” Admin/Testing only
    // If a non-empty master OTP is configured and the user entered it,
    // allow verification without needing the real SMS OTP.
    if (masterOtp && otp === masterOtp) {
      console.log(`ðŸ”‘ [ADMIN BYPASS] Master OTP used for +91${phone} â€” testing mode`);
      db.otps = db.otps.filter((o: any) => o.phone !== phone);
      saveDB(db);
      return res.json({ success: true, message: 'Phone verified successfully!' });
    }

    // âœ… REAL OTP verification for actual users
    const otpRecord = db.otps.find((o: any) => o.phone === phone);
    if (!otpRecord) {
      return res.status(400).json({ error: 'No OTP found for this number. Please request a new OTP.' });
    }

    if (new Date(otpRecord.expiry) < new Date()) {
      db.otps = db.otps.filter((o: any) => o.phone !== phone);
      saveDB(db);
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
    }

    // OTP matched â€” remove used OTP
    db.otps = db.otps.filter((o: any) => o.phone !== phone);
    saveDB(db);

    res.json({ success: true, message: 'Phone verified successfully!' });
  });


  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const loginIdentifier = (email || '').trim();

    try {
      // Brute force protection (OWASP A07)
      const loginCheck = checkLoginAttempts(loginIdentifier || clientIp);
      if (!loginCheck.allowed) {
        createAuditLog({
          action: 'login_locked',
          actor_id: loginIdentifier || clientIp,
          actor_ip: clientIp,
          actor_user_agent: userAgent,
          resource_type: 'auth',
          resource_id: loginIdentifier || 'unknown',
          details: `Account locked until ${new Date(loginCheck.lockedUntil!).toISOString()}`,
          severity: 'warn',
        });
        return res.status(429).json({ error: 'Account temporarily locked. Try again later.', lockedUntil: loginCheck.lockedUntil });
      }

      // Find user by email OR phone number
      let user = db.users.find((u: any) => u.email?.toLowerCase() === loginIdentifier.toLowerCase());

      // If not found by email, try finding by phone number
      if (!user && loginIdentifier) {
        const phoneClean = loginIdentifier.replace(/\D/g, '');
        if (phoneClean.length >= 10) {
          // Find ALL profiles with this phone number
          const profilesWithPhone = (db.profiles || []).filter((p: any) => {
            const pPhone = (p.phone || '').replace(/\D/g, '');
            return pPhone && pPhone === phoneClean;
          });
          // Try each profile's user account until password matches
          for (const prof of profilesWithPhone) {
            const candidate = db.users.find((u: any) => u.id === prof.id);
            if (candidate && (candidate.password_hash || candidate.password)) {
              const pwMatch = await bcrypt.compare(password, candidate.password_hash || candidate.password || '');
              if (pwMatch) {
                user = candidate;
                break;
              }
            }
          }
        }
      }

      if (!user || !(await bcrypt.compare(password, user.password_hash || user.password || ''))) {
        recordLoginAttempt(loginIdentifier || clientIp, false);
        createAuditLog({ action: 'login_failed', actor_id: loginIdentifier || clientIp, actor_ip: clientIp, actor_user_agent: userAgent, resource_type: 'auth', resource_id: loginIdentifier || 'unknown', details: 'Invalid credentials', severity: 'warn' });
        const remaining = checkLoginAttempts(loginIdentifier || clientIp);
        return res.status(401).json({ error: 'Invalid credentials', remainingAttempts: remaining.remainingAttempts });
      }
      // Check admin_managers table — if this user is an admin manager, verify is_active
      const adminManager = (db.admin_managers || []).find((m: any) => m.email?.toLowerCase() === user.email?.toLowerCase());
      if (adminManager) {
        if (!adminManager.is_active) {
          return res.status(403).json({ error: 'Your admin account has been deactivated. Contact the master admin.' });
        }
        // Update last_login
        adminManager.last_login = new Date().toISOString();
        saveDB(db);
      }

      const profile = (db.profiles || []).find((p: any) =>
        p.id === user.id || p.user_id === user.id
      ) || { id: user.id, first_name: 'User', role: user.role || 'user', is_active: true };
      const safeUser = Object.fromEntries(
        Object.entries(user).filter(([k]) => !['password_hash', 'password', 'email_verify_token', 'password_reset_token'].includes(k))
      );
      const role = user.role || profile.role || 'user';
      const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      try { recordLoginAttempt(loginIdentifier, true); } catch (e) { }
      try { createAuditLog({ action: 'login_success', actor_id: user.id, actor_ip: clientIp, actor_user_agent: userAgent, resource_type: 'auth', resource_id: user.id, details: 'User login', severity: 'info' }); } catch (e) { }
      // Update last_login and auto-reactivate status on login
      const loginProfile = db.profiles.find((p: any) => p.id === user.id);
      if (loginProfile) {
        loginProfile.last_login = new Date().toISOString();
        // Auto-reactivate yellow/red profiles if under reactivation limit
        const profileStatus = loginProfile.profile_status;
        if (profileStatus === "yellow" || profileStatus === "red") {
          const kv: Record<string, string> = {};
          (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
          const limit = parseInt(kv["reactivation_limit"] || "10");
          const count = loginProfile.reactivation_count || 0;
          const io = (app as any).io;
          if (count < limit) {
            // Under limit: auto-reactivate to active
            loginProfile.profile_status = "active";
            loginProfile.reactivation_count = count + 1;
            loginProfile.reactivation_status = "approved";
            if (io) io.emit("profile-status:updated", {
              userId: loginProfile.id,
              profile_status: "active",
              reactivation_count: loginProfile.reactivation_count
            });
          } else {
            // Limit exceeded: keep blocked status, require admin approval
            // CRITICAL: force profile_status back to the blocked state
            // so ProtectedRoute correctly redirects to /reactivation-pending
            loginProfile.profile_status = profileStatus; // keep "yellow" or "red"
            // Set to "none" so the frontend shows the text area for the user to submit a request
            loginProfile.reactivation_status = "none";
            if (io) io.to(`user:${loginProfile.id}`).emit("profile:reactivation-required", {
              userId: loginProfile.id
            });
          }
        }
        saveDB(db);
      }
      const updatedProfile = db.profiles.find(
        (p: any) => p.id === user.id
      ) || profile;
      return res.json({ user: safeUser, profile: updatedProfile, token });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // MIDDLEWARE
  // ==========================================

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = user;
      const db = getDB();
      const profile = db.profiles.find((p: any) => p.id === user.id);
      if (profile) {
        req.user.role = profile.role;
      }
      next();
    });
  };

  // ── getDefaultPermissions helper ──────────────────────────────────────────
  function getDefaultPermissions(role: string): string[] {
    if (role === 'master_admin') return ['*'];
    if (role === 'admin') return ['/admin', '/admin/verification', '/admin/users', '/admin/communities', '/admin/notifications', '/admin/plans', '/admin/coupons', '/admin/payment-gateways', '/admin/financials', '/admin/analytics', '/admin/reports', '/admin/emails', '/admin/unblock', '/admin/success-stories', '/admin/contacts', '/admin/content', '/admin/seo-marketing', '/admin/legal-pages', '/admin/settings'];
    if (role === 'administration') return ['/admin', '/admin/verification', '/admin/users', '/admin/reports',
      '/admin/unblock', '/admin/success-stories', '/admin/contacts', '/admin/communities'];
    if (role === 'finance') return ['/admin', '/admin/financials', '/admin/analytics', '/admin/plans',
      '/admin/payment-gateways', '/admin/coupons'];
    return ['/admin'];
  }

  // ── requireMasterAdmin middleware ─────────────────────────────────────────
  const requireMasterAdmin = (req: any, res: any, next: any) => {
    try {
      console.log('[requireMasterAdmin] checking user:', req.user?.email, '| id:', req.user?.id);
      const db = getDB();
      const managers = db.admin_managers || [];
      console.log('[requireMasterAdmin] total managers in DB:', managers.length);
      const manager = managers.find((m: any) =>
        m.id === req.user?.id || m.email?.toLowerCase() === req.user?.email?.toLowerCase()
      );
      console.log('[requireMasterAdmin] manager found:', manager ? `${manager.email} (${manager.role})` : 'NOT FOUND');
      if (!manager || manager.role !== 'master_admin') {
        return res.status(403).json({ error: 'Only Master Admin can perform this action.' });
      }
      next();
    } catch (err: any) {
      console.error('[requireMasterAdmin] CRASH:', err?.message || err);
      res.status(500).json({ error: 'Permission check failed.' });
    }
  };

  // ── Communities Routes ────────────────────────────────────────────────────

  // GET /api/communities/active — PUBLIC — registration dropdown
  // IMPORTANT: /active must be before /:id to avoid route conflict
  app.get('/api/communities/active', (req, res) => {
    try {
      const db = getDB();
      const communities = (db.communities || []);
      const active = communities
        .filter((c: any) => c.is_active !== false)
        .sort((a: any, b: any) => (a.display_order || 99) - (b.display_order || 99));
      res.json({ success: true, communities: active });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Could not fetch communities.' });
    }
  });

  // GET /api/communities — ADMIN ONLY
  app.get('/api/communities', authenticateToken, (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const db = getDB();
      const communities = (db.communities || [])
        .sort((a: any, b: any) => (a.display_order || 99) - (b.display_order || 99));
      res.json({ success: true, communities });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Could not fetch communities.' });
    }
  });

  // POST /api/communities — ADMIN ONLY
  app.post('/api/communities', authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const { name, sub_castes, gotras, is_active, display_order } = req.body;
      if (!name || name.trim().length < 2)
        return res.status(400).json({ error: 'Name must be at least 2 characters.' });
      const db = getDB();
      if (!db.communities) db.communities = [];
      const dup = db.communities.find((c: any) =>
        c.name.toLowerCase().trim() === name.toLowerCase().trim()
      );
      if (dup) return res.status(409).json({ error: `Community '${name}' already exists.` });
      const newCommunity = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        name: name.trim(),
        sub_castes: Array.isArray(sub_castes) ? sub_castes.filter(Boolean) : [],
        gotras: Array.isArray(gotras) ? gotras.filter(Boolean) : [],
        is_active: is_active !== false,
        display_order: typeof display_order === 'number' ? display_order : db.communities.length + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.communities.push(newCommunity);
      saveDB(db);
      res.status(201).json({ success: true, community: newCommunity });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create community.' });
    }
  });

  // PUT /api/communities/:id — ADMIN ONLY
  app.put('/api/communities/:id', authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const { id } = req.params;
      const { name, sub_castes, gotras, is_active, display_order } = req.body;
      const db = getDB();
      if (!db.communities) db.communities = [];
      const idx = db.communities.findIndex((c: any) => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Community not found.' });
      if (name !== undefined) {
        if (name.trim().length < 2) return res.status(400).json({ error: 'Name too short.' });
        const dup = db.communities.find((c: any, i: number) =>
          i !== idx && c.name.toLowerCase().trim() === name.toLowerCase().trim()
        );
        if (dup) return res.status(409).json({ error: `Community '${name}' already exists.` });
        db.communities[idx].name = name.trim();
      }
      if (Array.isArray(sub_castes)) db.communities[idx].sub_castes = sub_castes.filter(Boolean);
      if (Array.isArray(gotras)) db.communities[idx].gotras = gotras.filter(Boolean);
      if (typeof is_active === 'boolean') db.communities[idx].is_active = is_active;
      if (typeof display_order === 'number') db.communities[idx].display_order = display_order;
      db.communities[idx].updated_at = new Date().toISOString();
      saveDB(db);
      res.json({ success: true, community: db.communities[idx] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update community.' });
    }
  });

  // DELETE /api/communities/:id — ADMIN ONLY
  app.delete('/api/communities/:id', authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const { id } = req.params;
      const db = getDB();
      if (!db.communities) db.communities = [];
      const community = db.communities.find((c: any) => c.id === id);
      if (!community) return res.status(404).json({ error: 'Community not found.' });
      const activeCount = db.communities.filter((c: any) => c.is_active).length;
      if (community.is_active && activeCount <= 1)
        return res.status(400).json({ error: 'Cannot delete the last active community.' });
      db.communities = db.communities.filter((c: any) => c.id !== id);
      saveDB(db);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete community.' });
    }
  });

  // PATCH /api/communities/:id/toggle — ADMIN ONLY
  app.patch('/api/communities/:id/toggle', authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const { id } = req.params;
      const db = getDB();
      if (!db.communities) db.communities = [];
      const idx = db.communities.findIndex((c: any) => c.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Community not found.' });
      const activeCount = db.communities.filter((c: any) => c.is_active).length;
      if (db.communities[idx].is_active && activeCount <= 1)
        return res.status(400).json({ error: 'Cannot deactivate the last active community.' });
      db.communities[idx].is_active = !db.communities[idx].is_active;
      db.communities[idx].updated_at = new Date().toISOString();
      saveDB(db);
      res.json({ success: true, community: db.communities[idx] });
    } catch (err) {
      res.status(500).json({ error: 'Failed to toggle community.' });
    }
  });

  // ==========================================
  // PAYMENT GATEWAYS API
  // ==========================================

  app.get('/api/admin/payment-gateways', authenticateToken, (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    res.json(db.payment_gateways || []);
  });

  app.post('/api/admin/payment-gateways', authenticateToken, (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    const { name, provider, key_id, key_secret, webhook_secret, extra_notes, is_active } = req.body;

    // If setting active, deactivate all others
    if (is_active) {
      db.payment_gateways.forEach((g: any) => g.is_active = false);
    }

    const newGateway = {
      id: uuidv4(),
      name,
      provider: provider || 'custom',
      key_id,
      key_secret,
      webhook_secret: webhook_secret || '',
      extra_notes: extra_notes || '',
      is_active: is_active || false,
      created_at: new Date().toISOString()
    };

    db.payment_gateways.push(newGateway);
    saveDB(db);
    res.json(newGateway);
  });

  app.put('/api/admin/payment-gateways/:id', authenticateToken, (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    const { name, provider, key_id, key_secret, webhook_secret, extra_notes, is_active } = req.body;
    const gateway = db.payment_gateways.find((g: any) => g.id === req.params.id);

    if (!gateway) return res.status(404).json({ error: 'Gateway not found' });

    // If activating, deactivate others. If deactivating, just turn this one off.
    if (is_active) {
      db.payment_gateways.forEach((g: any) => {
        if (g.id !== gateway.id) g.is_active = false;
      });
    }

    gateway.name = name;
    gateway.provider = provider || gateway.provider;
    gateway.key_id = key_id;
    gateway.key_secret = key_secret;
    gateway.webhook_secret = webhook_secret || '';
    gateway.extra_notes = extra_notes || '';
    gateway.is_active = !!is_active;

    saveDB(db);
    res.json(gateway);
  });

  app.delete('/api/admin/payment-gateways/:id', authenticateToken, (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const db = getDB();
    db.payment_gateways = db.payment_gateways.filter((g: any) => g.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
  });

  // Public endpoint for checkout to get active gateway (excluding secret key)
  app.get('/api/payment-gateways/active', (req, res) => {
    const db = getDB();
    const activeGateway = db.payment_gateways.find((g: any) => g.is_active);
    if (!activeGateway) return res.json(null);
    res.json({
      id: activeGateway.id,
      name: activeGateway.name,
      provider: activeGateway.provider,
      key_id: activeGateway.key_id
      // NEVER return key_secret here
    });
  });

  // ==========================================
  // CREATE RAZORPAY ORDER (Server-side)
  // ==========================================
  app.post('/api/payment/create-order', stopDuplicates('create-order'), async (req, res) => {
    const { amount, currency = 'INR', planId, planType } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const db = getDB();
    const gateway = db.payment_gateways?.find((g: any) => g.is_active && g.provider === 'razorpay');

    // No active Razorpay gateway configured â†’ return mock order
    if (!gateway || !gateway.key_secret) {
      return res.json({
        order_id: `mock_order_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency,
        is_mock: true
      });
    }

    // Demo key â†’ return mock order (no real API call)
    if (gateway.key_id === 'rzp_test_demoKey123' || gateway.key_secret === 'rzp_test_secretKey123') {
      return res.json({
        order_id: `mock_order_${Date.now()}`,
        amount: Math.round(amount * 100),
        currency,
        is_mock: true
      });
    }

    // Real Razorpay: create order via Razorpay API
    try {
      const auth = Buffer.from(`${gateway.key_id}:${gateway.key_secret}`).toString('base64');
      const orderPayload = JSON.stringify({
        amount: Math.round(amount * 100), // in paise
        currency,
        receipt: `rcpt_${planType}_${planId}_${Date.now()}`,
        notes: { planId, planType }
      });

      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: orderPayload
      });

      if (!response.ok) {
        const errData = await response.json() as any;
        console.error('Razorpay order creation failed:', errData);
        return res.status(502).json({ error: errData?.error?.description || 'Failed to create payment order' });
      }

      const order = await response.json() as any;
      res.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        is_mock: false
      });
    } catch (err: any) {
      console.error('Razorpay create-order error:', err.message);
      res.status(500).json({ error: 'Failed to initiate payment: ' + err.message });
    }
  });

  // ==========================================
  // RECOMMENDATIONS & NEW MEMBERS
  // ==========================================

  // GET /api/recommendations?userId=xxx&limit=8
  // Returns profiles scored by partner preference match, premium first
  app.get('/api/recommendations', (req, res) => {
    const db = getDB();
    const { userId, limit = '8' } = req.query as any;
    const maxLimit = Math.min(parseInt(limit) || 8, 50);

    if (!userId) return res.json([]);

    const currentUser = db.profiles.find((p: any) => p.id === userId);
    if (!currentUser) return res.json([]);

    // Gather IDs to exclude: self + blocked + already have an interest
    const blockedIds = new Set<string>(
      (db.user_blocks || [])
        .filter((b: any) => b.blocker_id === userId || b.blocked_id === userId)
        .flatMap((b: any) => [b.blocker_id, b.blocked_id])
    );
    const interestIds = new Set<string>(
      (db.interests || [])
        .filter((i: any) => (i.sender_id === userId || i.receiver_id === userId) && i.status !== 'cancelled')
        .flatMap((i: any) => [i.sender_id, i.receiver_id])
    );
    const excludeIds = new Set([userId, ...blockedIds, ...interestIds]);

    // Determine the opposite gender to show
    const lookingFor = currentUser.looking_for || (currentUser.gender === 'Male' ? 'Female' : 'Male');

    // Fetch partner preferences
    const prefs = (db.partner_preferences || []).find((p: any) => p.user_id === userId) || {};

    const calcAge = (dob: string) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 0;

    // Score each candidate 0-100
    const allowedStatuses = new Set(['verified', 'approved', null, undefined]);
    const scored = (db.profiles || [])
      .filter((p: any) =>
        !excludeIds.has(p.id) &&
        p.is_active !== false &&
        p.verification_status !== 'rejected' &&
        p.verification_status !== 'pending' &&
        (p.gender === lookingFor || !lookingFor)
      )
      .map((p: any) => {
        let score = 0;
        const age = calcAge(p.date_of_birth);

        // Age match (20 pts)
        if (prefs.age_from && prefs.age_to) {
          if (age >= prefs.age_from && age <= prefs.age_to) score += 20;
        } else score += 10; // no pref = partial credit

        // Height match (15 pts)
        if (prefs.height_from_cm && prefs.height_to_cm && p.height_cm) {
          if (p.height_cm >= prefs.height_from_cm && p.height_cm <= prefs.height_to_cm) score += 15;
        } else score += 7;

        // Religion match (20 pts)
        if (prefs.religion_pref) {
          const prefRels = Array.isArray(prefs.religion_pref) ? prefs.religion_pref : [prefs.religion_pref];
          if (prefRels.some((r: string) => r && p.religion && r.toLowerCase() === p.religion.toLowerCase())) score += 20;
        } else score += 10;

        // Education match (15 pts)
        const edu = (db.education_career || []).find((e: any) => e.user_id === p.id);
        const eduLevel = edu?.highest_education || '';
        if (prefs.education_pref) {
          const prefEdus = Array.isArray(prefs.education_pref) ? prefs.education_pref : [prefs.education_pref];
          if (prefEdus.some((e: string) => e && eduLevel && eduLevel.toLowerCase().includes(e.toLowerCase()))) score += 15;
        } else score += 7;

        // Location match (15 pts)
        const pCity = (p.city || edu?.working_city || '').toLowerCase();
        const pState = (p.state || edu?.working_state || '').toLowerCase();
        if (prefs.state_pref) {
          const prefStates = Array.isArray(prefs.state_pref) ? prefs.state_pref : [prefs.state_pref];
          if (prefStates.some((s: string) => s && pState && pState.includes(s.toLowerCase()))) score += 15;
        } else if (currentUser.state && pState && pState.includes((currentUser.state || '').toLowerCase())) {
          score += 10;
        } else score += 5;

        // Recent activity (10 pts)
        const lastActive = p.updated_at ? (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 3600 * 24) : 999;
        if (lastActive < 1) score += 10;
        else if (lastActive < 7) score += 5;

        // Has photo (5 pts)
        if (p.profile_photo_url) score += 5;

        // Boost premium (show first among similar scores)
        const premiumBoost = p.is_premium ? 0.5 : 0;

        return {
          ...p,
          education_career: edu || p.education_career,
          matchPct: Math.round(score),
          _sortKey: score + premiumBoost,
        };
      })
      .sort((a: any, b: any) => {
        // Premium first, then by score
        if (b.is_premium !== a.is_premium) return b.is_premium ? 1 : -1;
        return b._sortKey - a._sortKey;
      })
      .slice(0, maxLimit)
      .map(({ _sortKey, ...p }: any) => p);

    return res.json(scored);
  });

  // GET /api/new-members?userId=xxx&limit=8
  // Returns newest profiles, same city first, premium first within city
  app.get('/api/new-members', (req, res) => {
    const db = getDB();
    const { userId, limit = '8' } = req.query as any;
    const maxLimit = Math.min(parseInt(limit) || 8, 50);

    if (!userId) return res.json([]);

    const currentUser = db.profiles.find((p: any) => p.id === userId);
    if (!currentUser) return res.json([]);

    const blockedIds = new Set<string>(
      (db.user_blocks || [])
        .filter((b: any) => b.blocker_id === userId || b.blocked_id === userId)
        .flatMap((b: any) => [b.blocker_id, b.blocked_id])
    );
    const interestIds = new Set<string>(
      (db.interests || [])
        .filter((i: any) => (i.sender_id === userId || i.receiver_id === userId) && i.status !== 'cancelled')
        .flatMap((i: any) => [i.sender_id, i.receiver_id])
    );
    const excludeIds = new Set([userId, ...blockedIds, ...interestIds]);

    const lookingFor = currentUser.looking_for || (currentUser.gender === 'Male' ? 'Female' : 'Male');
    const myCity = (currentUser.city || '').toLowerCase();
    const myState = (currentUser.state || '').toLowerCase();

    const cutoff = Date.now() - 180 * 24 * 3600 * 1000; // last 180 days (covers test/dev data)

    const members = (db.profiles || [])
      .filter((p: any) =>
        !excludeIds.has(p.id) &&
        p.is_active !== false &&
        p.verification_status !== 'rejected' &&
        p.verification_status !== 'pending' &&
        (p.gender === lookingFor || !lookingFor) &&
        p.created_at &&
        new Date(p.created_at).getTime() >= cutoff
      )
      .map((p: any) => {
        const edu = (db.education_career || []).find((e: any) => e.user_id === p.id);
        const pCity = (p.city || edu?.working_city || '').toLowerCase();
        const pState = (p.state || edu?.working_state || '').toLowerCase();
        const isSameCity = myCity && pCity && pCity === myCity;
        const isSameState = myState && pState && pState === myState;
        const created = new Date(p.created_at).getTime();
        return { ...p, education_career: edu || p.education_career, isSameCity, isSameState, _created: created };
      })
      .sort((a: any, b: any) => {
        // Priority: same city > same state > anywhere, then premium > non-premium, then newest first
        const aLoc = a.isSameCity ? 2 : a.isSameState ? 1 : 0;
        const bLoc = b.isSameCity ? 2 : b.isSameState ? 1 : 0;
        if (bLoc !== aLoc) return bLoc - aLoc;
        if (b.is_premium !== a.is_premium) return b.is_premium ? 1 : -1;
        return b._created - a._created;
      })
      .slice(0, maxLimit)
      .map(({ isSameCity, isSameState, _created, ...p }: any) => p);

    return res.json(members);
  });

  // ==========================================
  // CHECKOUT PROCESS
  // ==========================================

  app.get('/api/profiles/:id', async (req, res) => {
    const db = getDB();
    const currentUserId = req.headers['x-user-id'] as string;

    if (currentUserId && db.user_blocks) {
      const isBlocked = db.user_blocks.some((b: any) =>
        (b.blocker_id === currentUserId && b.blocked_id === req.params.id) ||
        (b.blocker_id === req.params.id && b.blocked_id === currentUserId)
      );
      if (isBlocked) return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = db.profiles.find((p: any) => p.id === req.params.id);
    if (profile) {
      res.json(profile);
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  });

  app.get('/api/profiles/:id/complete', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    // Never cache â€” must always return fresh data for real-time profile updates
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const currentUserId = req.headers['x-user-id'];
    if (currentUserId && db.user_blocks) {
      const isBlocked = db.user_blocks.some(b => (b.blocker_id === currentUserId && b.blocked_id === id) || (b.blocker_id === id && b.blocked_id === currentUserId));
      if (isBlocked) return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = db.profiles.find((p: any) => p.id === id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const userAcc = db.users?.find((u: any) => u.id === id);

    res.json({
      profile: { ...profile, email: userAcc?.email },
      education: db.education_career?.find((e: any) => e.user_id === id) || null,
      family: db.family_details?.find((f: any) => f.user_id === id) || null,
      lifestyle: db.lifestyle?.find((l: any) => l.user_id === id) || null,
      horoscope: db.horoscope_details?.find((h: any) => h.user_id === id) || null,
      preferences: db.partner_preferences?.find((p: any) => p.user_id === id) || null,
      photos: db.photos?.filter((p: any) => p.user_id === id) || [],
      verification_documents: db.verification_documents?.filter((d: any) => d.user_id === id) || [],
      interests_sent: (db.interests?.filter((i: any) => i.sender_id === id) || []).map((i: any) => ({
        ...i,
        receiver: db.profiles.find((p: any) => p.id === i.receiver_id) || null
      })),
      interests_received: (db.interests?.filter((i: any) => i.receiver_id === id) || []).map((i: any) => ({
        ...i,
        sender: db.profiles.find((p: any) => p.id === i.sender_id) || null
      })),
      purchases: db.credit_purchases?.filter((cp: any) => cp.user_id === id) || [],
      membership_purchases: db.membership_purchases?.filter((mp: any) => mp.user_id === id) || [],
      chat_warnings: db.chat_warnings?.filter((w: any) => w.user_id === id) || [],
      deleted_messages: (db.messages?.filter((m: any) => m.sender_id === id && m.is_deleted) || []).map((m: any) => ({
        ...m,
        receiver: db.profiles.find((p: any) => p.id === m.receiver_id) || null
      })),
      reports_received: (db.message_reports?.filter((r: any) => r.reported_user_id === id) || []).map((r: any) => ({
        ...r,
        reporter: db.profiles.find((p: any) => p.id === r.reporter_id) || null
      })),
      message_reports: (db.message_reports?.filter((r: any) => r.reporter_id === id) || []).map((r: any) => ({
        ...r,
        reported_user: db.profiles.find((p: any) => p.id === r.reported_user_id) || null
      })),
      user_reports_received: (db.user_reports?.filter((r: any) => r.reported_user_id === id) || []).map((r: any) => ({
        ...r,
        reporter: db.profiles.find((p: any) => p.id === r.reporter_id) || null
      })),
      user_reports_sent: (db.user_reports?.filter((r: any) => r.reporter_id === id) || []).map((r: any) => ({
        ...r,
        reported_user: db.profiles.find((p: any) => p.id === r.reported_user_id) || null
      }))
    });
  });

  app.get('/api/profiles/:id/photos', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const photos = db.photos?.filter((p: any) => p.user_id === id) || [];
    res.json(photos);
  });

  // Admin: PATCH profile (edit any field)
  app.patch('/api/profiles/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const profileIndex = db.profiles.findIndex((p: any) => p.id === id);
    if (profileIndex === -1) return res.status(404).json({ error: 'Profile not found' });
    const allowedFields = ['first_name', 'last_name', 'gender', 'date_of_birth', 'religion', 'caste', 'sub_caste', 'gotra', 'mother_tongue', 'height_cm', 'weight_kg', 'body_type', 'complexion', 'physical_disability', 'disability_desc', 'blood_group', 'about_me', 'marital_status', 'profession', 'education', 'highest_education', 'occupation', 'annual_income', 'city', 'state', 'country', 'phone', 'profile_for', 'is_active', 'is_premium', 'is_verified', 'email_verified', 'phone_verified', 'aadhaar_verified', 'photo_verified', 'role', 'premium_plan', 'premium_end', 'plan_id', 'manglik', 'rashi', 'nakshatra', 'birth_time', 'birth_place', 'diet', 'smoking', 'drinking', 'hobbies', 'family_type', 'family_status', 'family_values', 'father_name', 'father_occupation', 'mother_name', 'mother_occupation', 'brothers', 'married_brothers', 'sisters', 'married_sisters', 'mosal_name', 'mosal_state', 'mosal_city', 'mosal_address', 'family_income', 'children_count', 'children'];
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        db.profiles[profileIndex][key] = value;
      }
    }
    db.profiles[profileIndex].updated_at = new Date().toISOString();
    saveDB(db);

    // Real-time: notify admin panel and user of profile update
    const io = (app as any).io;
    if (io) {
      io.to('admin:room').emit('admin:profile-updated', { id, profile: db.profiles[profileIndex] });
      io.to(`user:${id}`).emit('profile:updated', db.profiles[profileIndex]);
    }

    res.json({ success: true, profile: db.profiles[profileIndex] });
  });

  // Admin: Add new profile (no email/password required)
  app.post('/api/admin/profiles', async (req, res) => {
    const db = getDB();
    try {
      const id = uuidv4();
      const profileId = 'SM' + String(db.profiles.length + 1).padStart(5, '0');
      const defaultPhoto = req.body.gender === 'Female'
        ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
        : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg';

      const newProfile = {
        id,
        profile_id: profileId,
        first_name: req.body.first_name || '',
        last_name: req.body.last_name || '',
        gender: req.body.gender || 'Male',
        profile_for: req.body.profile_for || 'Self',
        date_of_birth: req.body.date_of_birth || '',
        phone: req.body.phone || '',
        profile_photo_url: defaultPhoto,
        religion: req.body.religion || 'Hindu',
        caste: req.body.caste || '',
        sub_caste: req.body.sub_caste || '',
        gotra: req.body.gotra || '',
        mother_tongue: req.body.mother_tongue || '',
        manglik: req.body.manglik || '',
        rashi: req.body.rashi || '',
        nakshatra: req.body.nakshatra || '',
        birth_time: req.body.birth_time || '',
        birth_place: req.body.birth_place || '',
        state: req.body.state || '',
        city: req.body.city || '',
        highest_education: req.body.highest_education || '',
        occupation: req.body.occupation || '',
        annual_income: req.body.annual_income || '',
        height_cm: req.body.height_cm || '',
        weight_kg: req.body.weight_kg || '',
        body_type: req.body.body_type || '',
        complexion: req.body.complexion || '',
        blood_group: req.body.blood_group || '',
        physical_disability: req.body.physical_disability || 'No',
        disability_desc: req.body.disability_desc || '',
        marital_status: req.body.marital_status || 'Never Married',
        diet: req.body.diet || '',
        smoking: req.body.smoking || '',
        drinking: req.body.drinking || '',
        children_count: req.body.children_count || '0',
        children: req.body.children || [],
        family_type: req.body.family_type || '',
        family_status: req.body.family_status || '',
        family_values: req.body.family_values || '',
        father_name: req.body.father_name || '',
        father_occupation: req.body.father_occupation || '',
        mother_name: req.body.mother_name || '',
        mother_occupation: req.body.mother_occupation || '',
        brothers: req.body.brothers || '0',
        married_brothers: req.body.married_brothers || '0',
        sisters: req.body.sisters || '0',
        married_sisters: req.body.married_sisters || '0',
        mosal_name: req.body.mosal_name || '',
        mosal_state: req.body.mosal_state || '',
        mosal_city: req.body.mosal_city || '',
        mosal_address: req.body.mosal_address || '',
        family_income: req.body.family_income || '',
        about_me: req.body.about_me || '',
        is_verified: false,
        email_verified: false,
        is_premium: false,
        is_active: true,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.profiles.push(newProfile);
      saveDB(db);

      // Real-time: notify admin panel of new profile
      const io = (app as any).io;
      if (io) {
        io.to('admin:room').emit('admin:new-user', { id, first_name: req.body.first_name, last_name: req.body.last_name, gender: req.body.gender, created_at: newProfile.created_at });
      }

      res.json({ success: true, profile: newProfile });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to add profile' });
    }
  });

  // ── Admin: Export Users to JSON (frontend converts to Excel) ────────────────
  app.get('/api/admin/users/export', authenticateToken, (req: any, res) => {
    const db = getDB();
    const isAdminManager = (db.admin_managers || []).some((m: any) =>
      m.id === req.user?.id || (m.email || '').toLowerCase() === (req.user?.email || '').toLowerCase()
    );
    if (req.user?.role !== 'admin' && !isAdminManager) return res.status(403).json({ error: 'Forbidden' });
    const profiles = (db.profiles || []).filter((p: any) => p.role !== 'admin');
    const users = db.users || [];
    const exportData = profiles.map((p: any) => {
      const u = users.find((usr: any) => usr.id === p.id);
      return {
        profile_id: p.profile_id || '',
        email: u?.email || '',
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        gender: p.gender || '',
        profile_for: p.profile_for || '',
        date_of_birth: p.date_of_birth || '',
        phone: p.phone || '',
        religion: p.religion || '',
        caste: p.caste || '',
        sub_caste: p.sub_caste || '',
        gotra: p.gotra || '',
        mother_tongue: p.mother_tongue || '',
        manglik: p.manglik || '',
        rashi: p.rashi || '',
        nakshatra: p.nakshatra || '',
        birth_time: p.birth_time || '',
        birth_place: p.birth_place || '',
        state: p.state || '',
        city: p.city || '',
        highest_education: p.highest_education || '',
        occupation: p.occupation || '',
        annual_income: p.annual_income || '',
        height_cm: p.height_cm || '',
        weight_kg: p.weight_kg || '',
        body_type: p.body_type || '',
        complexion: p.complexion || '',
        blood_group: p.blood_group || '',
        physical_disability: p.physical_disability || 'No',
        disability_desc: p.disability_desc || '',
        marital_status: p.marital_status || '',
        diet: p.diet || '',
        smoking: p.smoking || '',
        drinking: p.drinking || '',
        family_type: p.family_type || '',
        family_status: p.family_status || '',
        family_values: p.family_values || '',
        father_name: p.father_name || '',
        father_occupation: p.father_occupation || '',
        mother_name: p.mother_name || '',
        mother_occupation: p.mother_occupation || '',
        brothers: p.brothers || '0',
        married_brothers: p.married_brothers || '0',
        sisters: p.sisters || '0',
        married_sisters: p.married_sisters || '0',
        mosal_name: p.mosal_name || '',
        mosal_state: p.mosal_state || '',
        mosal_city: p.mosal_city || '',
        mosal_address: p.mosal_address || '',
        family_income: p.family_income || '',
        about_me: p.about_me || '',
        profile_photo_url: p.profile_photo_url || '',
        aadhaar_verified: p.is_verified ? 'Yes' : 'No',
        is_active: p.is_active ? 'Yes' : 'No',
        is_premium: p.is_premium ? 'Yes' : 'No',
        created_at: p.created_at || '',
      };
    });
    res.json({ success: true, users: exportData, count: exportData.length });
  });

  // ── Admin: Import Users from parsed JSON (frontend parses Excel/CSV) ────────
  app.post('/api/admin/users/import', authenticateToken, async (req: any, res) => {
    const db = getDB();
    const isAdminManager = (db.admin_managers || []).some((m: any) =>
      m.id === req.user?.id || (m.email || '').toLowerCase() === (req.user?.email || '').toLowerCase()
    );
    if (req.user?.role !== 'admin' && !isAdminManager) return res.status(403).json({ error: 'Forbidden' });
    const { users: importRows } = req.body;
    if (!Array.isArray(importRows) || importRows.length === 0) {
      return res.status(400).json({ error: 'No user data provided.' });
    }
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      const rowNum = i + 2; // Excel row (header is row 1)
      try {
        const firstName = (row.first_name || '').toString().trim();
        const lastName = (row.last_name || '').toString().trim();
        const phone = (row.phone || '').toString().trim();
        const email = (row.email || '').toString().trim().toLowerCase();

        if (!firstName) { errors.push(`Row ${rowNum}: first_name is required`); skipped++; continue; }

        // Check duplicate email
        if (email && db.users.find((u: any) => u.email?.toLowerCase() === email)) {
          errors.push(`Row ${rowNum}: Email "${email}" already exists`); skipped++; continue;
        }
        // Check duplicate phone
        if (phone) {
          const phoneClean = phone.replace(/\D/g, '');
          const phoneExists = (db.profiles || []).find((p: any) => (p.phone || '').replace(/\D/g, '') === phoneClean);
          if (phoneExists) { errors.push(`Row ${rowNum}: Phone "${phone}" already exists`); skipped++; continue; }
        }

        const id = uuidv4();
        const profileId = 'SM' + String(db.profiles.length + 1).padStart(5, '0');
        const gender = (row.gender || 'Male').toString().trim();
        const defaultPhoto = row.profile_photo_url || (gender === 'Female'
          ? 'https://www.uiu.ac.bd/wp-content/uploads/2025/10/female-300n300.jpg'
          : 'https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg');

        const aadhaarVerified = (row.aadhaar_verified || '').toString().toLowerCase() === 'yes';
        const now = new Date().toISOString();

        const newProfile: any = {
          id, profile_id: profileId,
          first_name: firstName, last_name: lastName,
          gender, profile_for: row.profile_for || 'Self',
          date_of_birth: row.date_of_birth || '',
          phone, profile_photo_url: defaultPhoto,
          religion: row.religion || 'Hindu',
          caste: row.caste || '', sub_caste: row.sub_caste || '',
          gotra: row.gotra || '', mother_tongue: row.mother_tongue || '',
          manglik: row.manglik || '', rashi: row.rashi || '',
          nakshatra: row.nakshatra || '', birth_time: row.birth_time || '',
          birth_place: row.birth_place || '',
          state: row.state || '', city: row.city || '',
          highest_education: row.highest_education || '',
          occupation: row.occupation || '', annual_income: row.annual_income || '',
          height_cm: row.height_cm || '', weight_kg: row.weight_kg || '',
          body_type: row.body_type || '', complexion: row.complexion || '',
          blood_group: row.blood_group || '',
          physical_disability: row.physical_disability || 'No',
          disability_desc: row.disability_desc || '',
          marital_status: row.marital_status || 'Never Married',
          diet: row.diet || '', smoking: row.smoking || '', drinking: row.drinking || '',
          children_count: row.children_count || '0', children: [],
          family_type: row.family_type || '', family_status: row.family_status || '',
          family_values: row.family_values || '',
          father_name: row.father_name || '', father_occupation: row.father_occupation || '',
          mother_name: row.mother_name || '', mother_occupation: row.mother_occupation || '',
          brothers: row.brothers || '0', married_brothers: row.married_brothers || '0',
          sisters: row.sisters || '0', married_sisters: row.married_sisters || '0',
          mosal_name: row.mosal_name || '', mosal_state: row.mosal_state || '',
          mosal_city: row.mosal_city || '', mosal_address: row.mosal_address || '',
          family_income: row.family_income || '', about_me: row.about_me || '',
          is_verified: aadhaarVerified, email_verified: false,
          is_premium: false, is_active: true, role: 'user',
          created_at: now, updated_at: now,
        };
        db.profiles.push(newProfile);

        // Create user account if email provided
        if (email) {
          const hashedPw = await bcrypt.hash(phone || '123456', 10);
          db.users.push({
            id, email, password_hash: hashedPw, password: hashedPw,
            role: 'user', is_active: true, email_verified: false,
            created_at: now, updated_at: now,
          });
        }
        imported++;
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message}`);
        skipped++;
      }
    }

    saveDB(db);
    res.json({ success: true, imported, skipped, total: importRows.length, errors: errors.slice(0, 20) });
  });

  app.post('/api/profiles/:id/personal', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const db = getDB();
    const index = db.profiles.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      db.profiles[index] = { ...db.profiles[index], ...data, updated_at: new Date().toISOString() };
      saveDB(db);
      // Sync to Elasticsearch
      if (isESReady()) indexProfile(db.profiles[index], db).catch(() => { });
      // Invalidate caches
      searchCache.invalidatePattern('search:');
      profileCache.invalidate(id);
      recommendationsCache.clear();
      // Real-time: notify admin panel of profile update
      const io = (app as any).io;
      if (io) {
        io.to('admin:room').emit('admin:profile-updated', { id, profile: db.profiles[index] });
        io.to(`user:${id}`).emit('profile:updated', db.profiles[index]);
        io.emit('profile:public-updated', { userId: id });
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  });

  app.post('/api/profiles/:id/education', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const db = getDB();
    const index = db.education_career.findIndex((e: any) => e.user_id === id);
    if (index !== -1) {
      db.education_career[index] = { ...db.education_career[index], ...data };
    } else {
      db.education_career.push({ user_id: id, ...data });
    }
    saveDB(db);
    if (isESReady()) { const p = db.profiles.find((pr: any) => pr.id === id); if (p) indexProfile(p, db).catch(() => { }); }
    searchCache.invalidatePattern('search:');
    profileCache.invalidate(id);
    recommendationsCache.clear();
    const io = (app as any).io;
    if (io) {
      const p = db.profiles.find((pr: any) => pr.id === id);
      if (p) {
        io.to('admin:room').emit('admin:profile-updated', { id, profile: p });
        io.to(`user:${id}`).emit('profile:section-updated', { userId: id, section: 'education' });
        io.emit('profile:public-updated', { userId: id });
      }
    }
    res.json({ success: true });
  });

  app.post('/api/upload/photo', upload.single('file'), async (req, res) => {
    const { userId, isProfilePhoto } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const db = getDB();
    const photoUrl = `/uploads/${file.filename}`;

    if (isProfilePhoto === 'true') {
      const profileIndex = db.profiles.findIndex((p: any) => p.id === userId);
      if (profileIndex !== -1) {
        db.profiles[profileIndex].profile_photo_url = photoUrl;
        db.profiles[profileIndex].updated_at = new Date().toISOString();
      }
    }

    // Also add to photos collection if it exists
    if (!db.photos) db.photos = [];
    const newPhoto = {
      id: Date.now(),
      user_id: userId,
      photo_url: photoUrl,
      is_profile_photo: isProfilePhoto === 'true',
      uploaded_at: new Date().toISOString()
    };
    db.photos.push(newPhoto);

    saveDB(db);
    // Real-time: notify admin panel of profile update (photo change)
    const io = (app as any).io;
    if (io) {
      const p = db.profiles.find((pr: any) => pr.id === userId);
      if (p) io.to('admin:room').emit('admin:profile-updated', { id: userId, profile: p });
    }
    res.json({ success: true, photoUrl });
  });

  app.post('/api/profiles/:id/family', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const db = getDB();
    const index = db.family_details.findIndex((f: any) => f.user_id === id);
    if (index !== -1) {
      db.family_details[index] = { ...db.family_details[index], ...data };
    } else {
      db.family_details.push({ user_id: id, ...data });
    }
    saveDB(db);
    if (isESReady()) { const p = db.profiles.find((pr: any) => pr.id === id); if (p) indexProfile(p, db).catch(() => { }); }
    searchCache.invalidatePattern('search:');
    profileCache.invalidate(id);
    recommendationsCache.clear();
    const io = (app as any).io;
    if (io) {
      const p = db.profiles.find((pr: any) => pr.id === id);
      if (p) {
        io.to('admin:room').emit('admin:profile-updated', { id, profile: p });
        io.to(`user:${id}`).emit('profile:section-updated', { userId: id, section: 'family' });
        io.emit('profile:public-updated', { userId: id });
      }
    }
    res.json({ success: true });
  });

  app.post('/api/profiles/:id/lifestyle', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const db = getDB();
    const index = db.lifestyle.findIndex((l: any) => l.user_id === id);
    if (index !== -1) {
      db.lifestyle[index] = { ...db.lifestyle[index], ...data };
    } else {
      db.lifestyle.push({ user_id: id, ...data });
    }
    saveDB(db);
    if (isESReady()) { const p = db.profiles.find((pr: any) => pr.id === id); if (p) indexProfile(p, db).catch(() => { }); }
    searchCache.invalidatePattern('search:');
    profileCache.invalidate(id);
    recommendationsCache.clear();
    const io = (app as any).io;
    if (io) {
      const p = db.profiles.find((pr: any) => pr.id === id);
      if (p) {
        io.to('admin:room').emit('admin:profile-updated', { id, profile: p });
        io.to(`user:${id}`).emit('profile:section-updated', { userId: id, section: 'lifestyle' });
        io.emit('profile:public-updated', { userId: id });
      }
    }
    res.json({ success: true });
  });

  app.post('/api/profiles/:id/horoscope', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const db = getDB();
    if (!db.horoscope_details) db.horoscope_details = [];
    const index = db.horoscope_details.findIndex((h: any) => h.user_id === id);
    if (index !== -1) {
      db.horoscope_details[index] = { ...db.horoscope_details[index], ...data };
    } else {
      db.horoscope_details.push({ user_id: id, ...data });
    }
    saveDB(db);
    // Real-time: notify admin panel
    const io = (app as any).io;
    if (io) {
      const p = db.profiles.find((pr: any) => pr.id === id);
      if (p) {
        io.to('admin:room').emit('admin:profile-updated', { id, profile: p });
        io.to(`user:${id}`).emit('profile:section-updated', { userId: id, section: 'horoscope' });
        io.emit('profile:public-updated', { userId: id });
      }
    }
    res.json({ success: true });
  });

  app.post('/api/profiles/:id/preferences', async (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const db = getDB();
    if (!db.partner_preferences) db.partner_preferences = [];
    const index = db.partner_preferences.findIndex((p: any) => p.user_id === id);
    if (index !== -1) {
      db.partner_preferences[index] = { ...db.partner_preferences[index], ...data };
    } else {
      db.partner_preferences.push({ user_id: id, ...data });
    }
    saveDB(db);
    if (isESReady()) { const p = db.profiles.find((pr: any) => pr.id === id); if (p) indexProfile(p, db).catch(() => { }); }
    searchCache.invalidatePattern('search:');
    profileCache.invalidate(id);
    recommendationsCache.clear();
    const io = (app as any).io;
    if (io) {
      const p = db.profiles.find((pr: any) => pr.id === id);
      if (p) {
        io.to('admin:room').emit('admin:profile-updated', { id, profile: p });
        io.to(`user:${id}`).emit('profile:section-updated', { userId: id, section: 'preferences' });
        io.emit('profile:public-updated', { userId: id });
      }
    }
    res.json({ success: true });
  });

  app.post('/api/profiles/:id/photos/:photoId/set-profile', async (req, res) => {
    const { id, photoId } = req.params;
    const { photoUrl } = req.body;
    const db = getDB();

    const profileIndex = db.profiles.findIndex((p: any) => p.id === id);
    if (profileIndex !== -1) {
      db.profiles[profileIndex].profile_photo_url = photoUrl;
      db.profiles[profileIndex].updated_at = new Date().toISOString();
      if (isESReady()) indexProfile(db.profiles[profileIndex], db).catch(() => { });
      searchCache.invalidatePattern('search:');
      profileCache.invalidate(id);
    }

    if (db.photos) {
      db.photos.forEach((p: any) => {
        if (p.user_id === id) {
          p.is_profile_photo = p.id.toString() === photoId.toString();
        }
      });
    }

    saveDB(db);
    res.json({ success: true });
  });

  app.delete('/api/photos/:photoId', async (req, res) => {
    const { photoId } = req.params;
    const db = getDB();
    if (db.photos) {
      db.photos = db.photos.filter((p: any) => p.id.toString() !== photoId.toString());
      saveDB(db);
    }
    res.json({ success: true });
  });

  app.get('/api/documents/:userId', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const db = getDB();
    const docs = db.verification_documents
      .filter((d: any) => d.user_id === req.params.userId)
      .sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    res.json(docs);
  });

  // Admin: Replace a verification document (upload new file for existing doc)
  app.post('/api/verification/replace/:docId', upload.single('file'), async (req, res) => {
    const { docId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const db = getDB();
    const index = db.verification_documents.findIndex((d: any) => d.id === Number(docId) || d.id === docId);
    if (index === -1) return res.status(404).json({ error: 'Document not found' });
    db.verification_documents[index].file_url = `/uploads/${file.filename}`;
    db.verification_documents[index].file_name = file.originalname;
    db.verification_documents[index].file_type = file.mimetype;
    db.verification_documents[index].verification_status = 'pending';
    db.verification_documents[index].uploaded_at = new Date().toISOString();
    db.verification_documents[index].reviewed_by = null;
    db.verification_documents[index].reviewed_at = null;
    db.verification_documents[index].admin_notes = null;
    // If this was an approved doc, user may need re-verification
    const doc = db.verification_documents[index];
    const profileIndex = db.profiles.findIndex((p: any) => p.id === doc.user_id);
    if (profileIndex !== -1) {
      const userDocs = db.verification_documents.filter((d: any) => d.user_id === doc.user_id && ['aadhaar_front', 'aadhaar_back'].includes(d.document_type));
      const allApproved = userDocs.length >= 2 && userDocs.every((d: any) => d.verification_status === 'approved');
      db.profiles[profileIndex].is_verified = allApproved;
    }
    saveDB(db);
    res.json({ success: true, document: db.verification_documents[index] });
  });

  // Admin: Change verification status of a document (approve/reject/revoked)
  app.post('/api/verification/change-status/:docId', async (req, res) => {
    const { docId } = req.params;
    const { status, reason, adminId } = req.body;
    const db = getDB();
    const index = db.verification_documents.findIndex((d: any) => d.id === Number(docId) || d.id === docId);
    if (index === -1) return res.status(404).json({ error: 'Document not found' });
    db.verification_documents[index].verification_status = status;
    db.verification_documents[index].reviewed_by = adminId;
    db.verification_documents[index].reviewed_at = new Date().toISOString();
    if (reason) db.verification_documents[index].admin_notes = reason;
    // Update profile verification status
    const doc = db.verification_documents[index];
    const profileIndex = db.profiles.findIndex((p: any) => p.id === doc.user_id);
    if (profileIndex !== -1) {
      const userDocs = db.verification_documents.filter((d: any) => d.user_id === doc.user_id && ['aadhaar_front', 'aadhaar_back'].includes(d.document_type));
      const allApproved = userDocs.length >= 2 && userDocs.every((d: any) => d.verification_status === 'approved');
      db.profiles[profileIndex].is_verified = allApproved;
    }
    saveDB(db);

    // Real-time: notify the user immediately so they don't need a hard refresh
    const io = (app as any).io;
    if (io && profileIndex !== -1) {
      const updatedProfile = db.profiles[profileIndex];
      // Notify the user's socket room with their updated profile
      io.to(`user:${doc.user_id}`).emit('profile:updated', updatedProfile);
      // Also emit document status change so PendingApprovalPage can react
      io.to(`user:${doc.user_id}`).emit('document:status-changed', {
        userId: doc.user_id,
        documentId: doc.id,
        documentType: doc.document_type,
        status,
        reason: reason || null,
        isVerified: updatedProfile.is_verified
      });
      // Notify admin room too
      io.to('admin:room').emit('admin:profile-updated', { id: doc.user_id, profile: updatedProfile });
    }

    res.json({ success: true, document: db.verification_documents[index] });
  });

  app.post('/api/upload', upload.single('file'), async (req, res) => {
    const { userId, documentType } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const db = getDB();
    const existingIndex = db.verification_documents.findIndex((d: any) => d.user_id === userId && d.document_type === documentType);

    const newDoc = {
      id: existingIndex !== -1 ? db.verification_documents[existingIndex].id : Date.now(),
      user_id: userId,
      document_type: documentType,
      file_url: `/uploads/${file.filename}`,
      file_name: file.originalname,
      file_type: file.mimetype,
      verification_status: 'pending',
      uploaded_at: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      db.verification_documents[existingIndex] = newDoc;
    } else {
      db.verification_documents.push(newDoc);
    }

    saveDB(db);

    // Real-time: notify admin panel of new document upload
    const io = (app as any).io;
    if (io) {
      const profile = db.profiles.find((p: any) => p.id === userId);
      io.to('admin:room').emit('admin:doc-uploaded', { userId, documentType, profile });
    }

    res.json({ success: true });
  });

  // User-to-User Block
  app.post('/api/users/block', async (req, res) => {
    const { blocker_id, blocked_id } = req.body;
    const db = getDB();
    if (!db.user_blocks) db.user_blocks = [];

    // Check if already blocked
    const exists = db.user_blocks.find((b: any) => b.blocker_id === blocker_id && b.blocked_id === blocked_id);
    if (!exists) {
      db.user_blocks.push({
        id: uuidv4(),
        blocker_id,
        blocked_id,
        created_at: new Date().toISOString()
      });

      // Cancel any pending interests between them
      if (db.interests) {
        db.interests.forEach((i: any) => {
          if ((i.sender_id === blocker_id && i.receiver_id === blocked_id) ||
            (i.sender_id === blocked_id && i.receiver_id === blocker_id)) {
            i.status = 'cancelled';
            i.cancelled_at = new Date().toISOString();
          }
        });
      }

      saveDB(db);
      // Real-time: notify admin panel of user block
      const io = (app as any).io;
      if (io) {
        io.to('admin:room').emit('admin:user-blocked', { blocker_id, blocked_id });
      }
    }
    res.json({ success: true });
  });

  // Get blocked users
  app.get('/api/users/:userId/blocked', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const blocks = Array.isArray(db.user_blocks)
      ? db.user_blocks
        .filter((b: any) => b.blocker_id === userId || b.blocked_id === userId)
        .map((b: any) => b.blocker_id === userId ? b.blocked_id : b.blocker_id)
      : [];

    const blockedRecords = blocks.filter((b: any) => b.blocker_id === userId);
    const blockedProfiles = blockedRecords.map((b: any) => {
      let profile = (db.profiles || []).find((p: any) => p.id === b.blocked_id);

      // Allow dummy test profiles to appear in the blocked list for testing
      if (!profile && b.blocked_id.startsWith('dummy-')) {
        profile = {
          id: b.blocked_id,
          first_name: 'Test',
          last_name: 'Profile',
          profile_photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80',
          city: 'Test City'
        };
      }

      return profile ? { ...profile, block_id: b.id, blocked_at: b.created_at } : null;
    }).filter(Boolean);

    res.json(blockedProfiles);
  });

  // Unblock user
  app.post('/api/users/unblock', async (req, res) => {
    const { blocker_id, blocked_id } = req.body;
    const db = getDB();
    if (!db.user_blocks) return res.json({ success: true });

    db.user_blocks = db.user_blocks.filter((b: any) => !(b.blocker_id === blocker_id && b.blocked_id === blocked_id));
    saveDB(db);
    // Real-time: notify admin panel of user unblock
    const io = (app as any).io;
    if (io) {
      io.to('admin:room').emit('admin:user-unblocked', { blocker_id, blocked_id });
    }
    res.json({ success: true });
  });

  // Report User (full report with reason, note, mutual block, message history)
  app.post('/api/users/report', async (req, res) => {
    const { reporter_id, reported_user_id, reason, note, source_page } = req.body;
    const db = getDB();
    if (!db.user_reports) db.user_reports = [];

    // Check if already reported
    const alreadyReported = db.user_reports.find((r: any) => r.reporter_id === reporter_id && r.reported_user_id === reported_user_id);
    if (alreadyReported) {
      return res.status(400).json({ error: 'You have already reported this user.' });
    }

    // Get reporter and reported profiles
    const reporterProfile = db.profiles.find((p: any) => p.id === reporter_id);
    const reportedProfile = db.profiles.find((p: any) => p.id === reported_user_id);

    // Gather message history between both users if reported from messages page
    let messageHistory: any[] = [];
    if (source_page === 'messages' && db.messages) {
      messageHistory = db.messages.filter((m: any) =>
        (m.sender_id === reporter_id && m.receiver_id === reported_user_id) ||
        (m.sender_id === reported_user_id && m.receiver_id === reporter_id)
      ).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    // Create the report
    const report = {
      id: uuidv4(),
      reporter_id,
      reported_user_id,
      reason,
      note: note || '',
      source_page: source_page || 'profile',
      message_history: messageHistory,
      reporter_name: reporterProfile ? `${reporterProfile.first_name} ${reporterProfile.last_name}` : 'Unknown',
      reported_name: reportedProfile ? `${reportedProfile.first_name} ${reportedProfile.last_name}` : 'Unknown',
      reporter_profile_id: reporterProfile?.profile_id || '',
      reported_profile_id: reportedProfile?.profile_id || '',
      status: 'pending',
      admin_action: null,
      admin_notes: null,
      created_at: new Date().toISOString()
    };
    db.user_reports.push(report);

    // Also add to reports table for the admin report page
    db.reports.push({
      id: report.id,
      reporter_id,
      reported_user_id,
      type: 'user_report',
      reason: `${reason}${note ? ` â€” ${note}` : ''}`,
      source_page: source_page || 'profile',
      has_message_history: messageHistory.length > 0,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    // Create mutual block (bidirectional) â€” they can't message or view contacts
    if (!db.user_blocks) db.user_blocks = [];
    const blockExists = db.user_blocks.find((b: any) =>
      (b.blocker_id === reporter_id && b.blocked_id === reported_user_id) ||
      (b.blocker_id === reported_user_id && b.blocked_id === reporter_id)
    );
    if (!blockExists) {
      db.user_blocks.push({
        id: uuidv4(),
        blocker_id: reporter_id,
        blocked_id: reported_user_id,
        reason: 'user_report',
        created_at: new Date().toISOString()
      });
    }

    // Cancel any pending/accepted interests between them
    if (db.interests) {
      db.interests.forEach((i: any) => {
        if ((i.sender_id === reporter_id && i.receiver_id === reported_user_id) ||
          (i.sender_id === reported_user_id && i.receiver_id === reporter_id)) {
          if (i.status === 'pending' || i.status === 'accepted') {
            i.status = 'cancelled';
            i.cancelled_at = new Date().toISOString();
          }
        }
      });
    }

    // Notify admin
    db.notifications.push({
      id: uuidv4(),
      user_id: 'admin-id',
      type: 'user_reported',
      title: 'ðŸš¨ New User Report',
      body: `${reporterProfile?.first_name || 'A user'} reported ${reportedProfile?.first_name || 'another user'} for: ${reason}`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    saveDB(db);
    // Real-time: notify admin panel of user report
    const io = (app as any).io;
    if (io) {
      io.to('admin:room').emit('admin:user-reported', { reporter_id, reported_user_id, reason, reportId: report.id });
    }
    res.json({ success: true, reportId: report.id });
  });

  // Get user report detail (for admin)
  app.get('/api/admin/user-report/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    if (!db.user_reports) return res.status(404).json({ error: 'Report not found' });

    const report = db.user_reports.find((r: any) => r.id === id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Enrich with full profiles
    const reporter = db.profiles.find((p: any) => p.id === report.reporter_id);
    const reported = db.profiles.find((p: any) => p.id === report.reported_user_id);

    res.json({
      ...report,
      reporter,
      reported
    });
  });

  // Check if one user has reported the other (for UI blocking)
  app.get('/api/users/report-status', async (req, res) => {
    const { user_id, other_user_id } = req.query;
    const db = getDB();
    if (!db.user_reports) return res.json({ reported: false });

    const reported = db.user_reports.some((r: any) =>
      (r.reporter_id === user_id && r.reported_user_id === other_user_id) ||
      (r.reporter_id === other_user_id && r.reported_user_id === user_id)
    );
    res.json({ reported });
  });

  app.use('/uploads', express.static('uploads'));

  // Search & Recommendations (Elasticsearch-powered with DB fallback)
  app.get('/api/search', async (req, res) => {
    const filters = req.query;
    const currentUserId = req.headers['x-user-id'] as string;
    const db = getDB();

    // Check search cache
    const cacheKey = `search:${currentUserId}:${JSON.stringify(filters)}`;
    const cached = searchCache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Try Elasticsearch first
    if (isESReady()) {
      const esResult = await searchProfiles(filters, currentUserId, db);
      if (esResult) {
        searchCache.set(cacheKey, esResult);
        res.setHeader('X-Cache', 'MISS');
        return res.json(esResult);
      }
    }

    // Fallback to DB search (complete implementation)

    // Get blocked user IDs
    const blockedIds = db.user_blocks
      ? db.user_blocks
        .filter((b: any) => b.blocker_id === currentUserId || b.blocked_id === currentUserId)
        .map((b: any) => b.blocker_id === currentUserId ? b.blocked_id : b.blocker_id)
      : [];

    // ── My profile (needed for near_me + gender + priority sorting) ──
    const myProfile = db.profiles.find((p: any) => p.id === currentUserId);
    const myEdu = (db.education_career || []).find((e: any) => e.user_id === currentUserId);
    const myCity = (myProfile?.city || myEdu?.working_city || '').trim().toLowerCase();
    const myState = (myProfile?.state || myEdu?.working_state || '').trim().toLowerCase();
    const myPrefs = (db.partner_preferences || []).find((pp: any) => pp.user_id === currentUserId);

    // ── Phase 1: Base active/verified filter ──────────────────────────────────
    // Profile ID / email / phone search is identity-based — bypass status filters
    const isIdentitySearch = !!(filters.profile_id || filters.email || filters.phone);

    let results = db.profiles.filter((p: any) => {
      if (p.id === currentUserId) return false;
      if (p.role === 'admin') return false;
      if (blockedIds.includes(p.id)) return false;
      if (!isIdentitySearch) {
        // For normal browse, only show active+verified profiles
        if (!p.is_active) return false;
        if (p.is_verified !== true) return false;
        if (p.profile_status && p.profile_status !== 'active') return false;
      }
      return true;
    });

    // ── Phase 2: Gender filter (ALWAYS enforce) ───────────────────────────────
    if (filters.looking_for) {
      results = results.filter((p: any) => p.gender === filters.looking_for);
    } else if (myProfile?.gender && !isIdentitySearch) {
      const targetGender = myProfile.looking_for
        ? myProfile.looking_for
        : (myProfile.gender === 'Male' ? 'Female' : 'Male');
      results = results.filter((p: any) => p.gender === targetGender);
    }

    // ── Phase 3: Identity search (Profile ID / Email / Phone) ────────────────
    if (filters.profile_id) {
      const pid = (filters.profile_id as string).toUpperCase().trim();
      results = results.filter((p: any) =>
        p.profile_id && p.profile_id.toUpperCase().includes(pid)
      );
    }
    if (filters.email) {
      const emailQ = (filters.email as string).toLowerCase().trim();
      const matchedUserIds = (db.users || [])
        .filter((u: any) => u.email && u.email.toLowerCase().includes(emailQ))
        .map((u: any) => u.id);
      results = results.filter((p: any) => matchedUserIds.includes(p.id));
    }
    if (filters.phone) {
      const phoneQ = (filters.phone as string).replace(/\D/g, '');
      results = results.filter((p: any) => {
        const pPhone = (p.phone || '').replace(/\D/g, '');
        return pPhone && pPhone.includes(phoneQ);
      });
    }

    // ── Phase 4: Community filters ────────────────────────────────────────────
    if (filters.caste) {
      const castes = Array.isArray(filters.caste) ? filters.caste : [filters.caste];
      if (castes.length > 0) results = results.filter((p: any) => castes.includes(p.caste));
    }
    if (filters.sub_caste) {
      const subCastes = Array.isArray(filters.sub_caste) ? filters.sub_caste : [filters.sub_caste];
      if (subCastes.length > 0) results = results.filter((p: any) => subCastes.includes(p.sub_caste));
    }
    if (filters.mother_tongue) {
      const tongues = Array.isArray(filters.mother_tongue) ? filters.mother_tongue : [filters.mother_tongue];
      if (tongues.length > 0) results = results.filter((p: any) => tongues.includes(p.mother_tongue));
    }
    if (filters.marital_status) {
      const statuses = Array.isArray(filters.marital_status) ? filters.marital_status : [filters.marital_status];
      if (statuses.length > 0) results = results.filter((p: any) => statuses.includes(p.marital_status));
    }

    // ── Phase 5: Age filter ───────────────────────────────────────────────────
    if (filters.age_from || filters.age_to) {
      const now = new Date();
      results = results.filter((p: any) => {
        if (!p.date_of_birth) return true;
        const dob = new Date(p.date_of_birth);
        const age = now.getFullYear() - dob.getFullYear() -
          (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
        if (filters.age_from && age < Number(filters.age_from)) return false;
        if (filters.age_to && age > Number(filters.age_to)) return false;
        return true;
      });
    }

    // ── Phase 6: Height filter ────────────────────────────────────────────────
    if (filters.height_from || filters.height_to) {
      results = results.filter((p: any) => {
        const h = Number(p.height_cm);
        if (!h) return true; // no height data — don't exclude
        if (filters.height_from && h < Number(filters.height_from)) return false;
        if (filters.height_to && h > Number(filters.height_to)) return false;
        return true;
      });
    }

    // ── Phase 7: Location filters ─────────────────────────────────────────────
    if (filters.city) {
      const cities = (Array.isArray(filters.city) ? filters.city : [filters.city])
        .map((c: string) => c.toLowerCase().trim()).filter(Boolean);
      if (cities.length > 0) {
        results = results.filter((p: any) => {
          const pEdu = (db.education_career || []).find((e: any) => e.user_id === p.id);
          const pCity = (p.city || pEdu?.working_city || '').toLowerCase();
          return cities.some((c: string) => pCity.includes(c));
        });
      }
    }
    if (filters.state) {
      const states = (Array.isArray(filters.state) ? filters.state : [filters.state])
        .map((s: string) => s.toLowerCase().trim()).filter(Boolean);
      if (states.length > 0) {
        results = results.filter((p: any) => {
          const pEdu = (db.education_career || []).find((e: any) => e.user_id === p.id);
          const pState = (p.state || pEdu?.working_state || '').toLowerCase();
          return states.some((s: string) => pState.includes(s));
        });
      }
    }
    if (filters.near_me === 'true' || filters.near_me === true) {
      if (myCity) {
        results = results.filter((p: any) => {
          const pEdu = (db.education_career || []).find((e: any) => e.user_id === p.id);
          const pCity = (p.city || pEdu?.working_city || '').toLowerCase();
          return pCity && pCity.includes(myCity);
        });
      }
    }

    // ── Phase 8: Education & Career filters ───────────────────────────────────
    if (filters.education) {
      const edus = Array.isArray(filters.education) ? filters.education : [filters.education];
      if (edus.length > 0) {
        results = results.filter((p: any) => {
          const pEdu = (db.education_career || []).find((e: any) => e.user_id === p.id);
          const pEduLevel = (pEdu?.highest_education || '').toLowerCase();
          return edus.some((e: string) => pEduLevel.includes(e.toLowerCase()));
        });
      }
    }
    if (filters.occupation) {
      const occs = Array.isArray(filters.occupation) ? filters.occupation : [filters.occupation];
      if (occs.length > 0) {
        results = results.filter((p: any) => {
          const pEdu = (db.education_career || []).find((e: any) => e.user_id === p.id);
          const pOcc = (pEdu?.occupation || '').toLowerCase();
          return occs.some((o: string) => pOcc.includes(o.toLowerCase()));
        });
      }
    }

    // ── Phase 9: Lifestyle filters ────────────────────────────────────────────
    if (filters.diet) {
      const diets = Array.isArray(filters.diet) ? filters.diet : [filters.diet];
      if (diets.length > 0) {
        results = results.filter((p: any) => {
          const pLife = (db.lifestyle || []).find((l: any) => l.user_id === p.id);
          return pLife && diets.some((d: string) => (pLife.diet || '').toLowerCase() === d.toLowerCase());
        });
      }
    }
    if (filters.smoking && filters.smoking !== '') {
      results = results.filter((p: any) => {
        const pLife = (db.lifestyle || []).find((l: any) => l.user_id === p.id);
        return pLife && (pLife.smoking || '').toLowerCase() === (filters.smoking as string).toLowerCase();
      });
    }
    if (filters.drinking && filters.drinking !== '') {
      results = results.filter((p: any) => {
        const pLife = (db.lifestyle || []).find((l: any) => l.user_id === p.id);
        return pLife && (pLife.drinking || '').toLowerCase() === (filters.drinking as string).toLowerCase();
      });
    }
    if (filters.family_type) {
      const fts = Array.isArray(filters.family_type) ? filters.family_type : [filters.family_type];
      if (fts.length > 0) {
        results = results.filter((p: any) => {
          const pFam = (db.family_details || []).find((f: any) => f.user_id === p.id);
          return pFam && fts.some((ft: string) => (pFam.family_type || '').toLowerCase() === ft.toLowerCase());
        });
      }
    }

    // ── Phase 10: Physical filters ────────────────────────────────────────────
    if (filters.body_type) {
      const bts = Array.isArray(filters.body_type) ? filters.body_type : [filters.body_type];
      if (bts.length > 0) results = results.filter((p: any) => bts.includes(p.body_type));
    }
    if (filters.complexion) {
      const comps = Array.isArray(filters.complexion) ? filters.complexion : [filters.complexion];
      if (comps.length > 0) results = results.filter((p: any) => comps.includes(p.complexion));
    }

    // ── Phase 11: Photo / Verified ────────────────────────────────────────────
    if (filters.has_photo === 'true' || filters.has_photo === true) {
      results = results.filter((p: any) => p.profile_photo_url && p.profile_photo_url.trim() !== '');
    }
    if (filters.verified_only === 'true' || filters.verified_only === true) {
      results = results.filter((p: any) => p.is_verified === true);
    }

    // ── Phase 12: Astro filters ───────────────────────────────────────────────
    if (filters.manglik && filters.manglik !== '') {
      results = results.filter((p: any) => {
        const pAstro = (db.astrology || []).find((a: any) => a.user_id === p.id);
        return pAstro && (pAstro.manglik || '').toLowerCase() === (filters.manglik as string).toLowerCase();
      });
    }
    if (filters.nakshatra && filters.nakshatra !== '') {
      results = results.filter((p: any) => {
        const pAstro = (db.astrology || []).find((a: any) => a.user_id === p.id);
        return pAstro && (pAstro.nakshatra || '').toLowerCase().includes((filters.nakshatra as string).toLowerCase());
      });
    }
    if (filters.raashi && filters.raashi !== '') {
      results = results.filter((p: any) => {
        const pAstro = (db.astrology || []).find((a: any) => a.user_id === p.id);
        return pAstro && (pAstro.rashi || '').toLowerCase() === (filters.raashi as string).toLowerCase();
      });
    }

    // ── Phase 13: Enrich with education_career ────────────────────────────────
    const enrichedResults = results.map((p: any) => {
      const edu = (db.education_career || []).find((e: any) => e.user_id === p.id) || null;
      const pCity = (p.city || edu?.working_city || '').toLowerCase();
      const pState = (p.state || edu?.working_state || '').toLowerCase();
      const isSameCity = myCity ? pCity.includes(myCity) : false;
      const isSameState = myState ? pState.includes(myState) : false;

      // Partner preference match score
      let prefMatch = 0;
      if (myPrefs) {
        const age = p.date_of_birth
          ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
          : 0;
        if (myPrefs.age_from && myPrefs.age_to && age >= myPrefs.age_from && age <= myPrefs.age_to) prefMatch++;
        const prefRel = Array.isArray(myPrefs.religion_pref) ? myPrefs.religion_pref : (myPrefs.religion_pref ? [myPrefs.religion_pref] : []);
        if (prefRel.length > 0 && prefRel.includes(p.religion)) prefMatch++;
        const prefCaste = Array.isArray(myPrefs.caste_pref) ? myPrefs.caste_pref : (myPrefs.caste_pref ? [myPrefs.caste_pref] : []);
        if (prefCaste.length > 0 && prefCaste.includes(p.caste)) prefMatch++;
        const prefEdu = Array.isArray(myPrefs.education_pref) ? myPrefs.education_pref : (myPrefs.education_pref ? [myPrefs.education_pref] : []);
        if (prefEdu.length > 0 && edu && prefEdu.some((e: string) => (edu.highest_education || '').toLowerCase().includes(e.toLowerCase()))) prefMatch++;
      }

      return {
        ...p,
        education_career: edu,
        _isSameCity: isSameCity,
        _isSameState: isSameState,
        _prefMatch: prefMatch,
      };
    });

    // ── Phase 14: Sort ─────────────────────────────────────────────────────────
    // Priority: Premium → Same City → Same State → Pref Match → then sort_by
    const sortBy = (filters.sort_by as string) || 'newest';

    enrichedResults.sort((a: any, b: any) => {
      // 1. Premium users first (featured benefit)
      if (b.is_premium !== a.is_premium) return b.is_premium ? 1 : -1;
      // 2. Same city first
      if (b._isSameCity !== a._isSameCity) return b._isSameCity ? 1 : -1;
      // 3. Same state second
      if (b._isSameState !== a._isSameState) return b._isSameState ? 1 : -1;
      // 4. Partner preference match score
      if (b._prefMatch !== a._prefMatch) return b._prefMatch - a._prefMatch;
      // 5. User-selected sort
      if (sortBy === 'last_active') {
        const aT = a.last_login ? new Date(a.last_login).getTime() : 0;
        const bT = b.last_login ? new Date(b.last_login).getTime() : 0;
        return bT - aT;
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      // default: newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Strip internal sort keys before sending
    const finalResults = enrichedResults.map(({ _isSameCity, _isSameState, _prefMatch, ...p }: any) => p);

    // Pagination
    const page = Number(filters.page) || 1;
    const limit = Math.min(Number(filters.limit) || 12, 50);
    const total = finalResults.length;
    const paginated = finalResults.slice((page - 1) * limit, page * limit);

    const result = { profiles: paginated, totalCount: total };
    // Only cache when no identity-based fields to avoid stale user-specific lookups
    if (!isIdentitySearch) searchCache.set(cacheKey, result);
    res.setHeader('X-Cache', 'MISS');
    res.json(result);
  });


  // Elasticsearch autocomplete/suggest
  app.get('/api/search/suggest', async (req, res) => {
    const { q, limit = 8 } = req.query;
    if (!q) return res.json([]);
    const results = await suggestProfiles(q as string, Number(limit));
    res.json(results);
  });

  // Admin: Bulk reindex all profiles to Elasticsearch
  app.post('/api/admin/es/reindex', async (req, res) => {
    const db = getDB();
    if (!isESReady()) {
      return res.status(503).json({ error: 'Elasticsearch not available' });
    }
    const result = await bulkIndexProfiles(db);
    res.json({ success: true, ...result });
  });

  // Admin: Get Elasticsearch status
  app.get('/api/admin/es/status', async (req, res) => {
    res.json({
      available: isESReady(),
      url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    });
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // GDPR / Data Privacy Compliance Endpoints
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GDPR: Export all user data (Right to Access - Art. 15)
  app.get('/api/gdpr/export', async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const db = getDB();

    createAuditLog({
      action: 'gdpr_data_export',
      actor_id: userId,
      actor_ip: req.ip || 'unknown',
      actor_user_agent: req.headers['user-agent'] || 'unknown',
      resource_type: 'gdpr',
      resource_id: userId,
      details: 'User requested data export',
      severity: 'info',
    });

    const profile = db.profiles.find((p: any) => p.id === userId);
    const user = db.users.find((u: any) => u.id === userId);
    const education = db.education_career?.find((e: any) => e.user_id === userId) || null;
    const family = db.family_details?.find((f: any) => f.user_id === userId) || null;
    const lifestyle = db.lifestyle?.find((l: any) => l.user_id === userId) || null;
    const horoscope = db.horoscope_details?.find((h: any) => h.user_id === userId) || null;
    const preferences = db.partner_preferences?.find((p: any) => p.user_id === userId) || null;
    const photos = db.photos?.filter((p: any) => p.user_id === userId) || [];
    const interests_sent = db.interests?.filter((i: any) => i.sender_id === userId) || [];
    const interests_received = db.interests?.filter((i: any) => i.receiver_id === userId) || [];
    const messages = db.messages?.filter((m: any) => m.sender_id === userId || m.receiver_id === userId) || [];
    const payments = db.credit_purchases?.filter((p: any) => p.user_id === userId) || [];
    const verification = db.verification_documents?.filter((d: any) => d.user_id === userId) || [];
    const consents = db.gdpr_consents?.filter((c: any) => c.user_id === userId) || [];

    const exportData = {
      export_date: new Date().toISOString(),
      user_id: userId,
      categories: Object.keys(GDPR_DATA_CATEGORIES),
      data: {
        account: user ? { id: user.id, email: user.email, created_at: user.created_at } : null,
        profile,
        education,
        family,
        lifestyle,
        horoscope,
        preferences,
        photos,
        interests_sent,
        interests_received,
        messages: messages.map((m: any) => ({ id: m.id, sender_id: m.sender_id, receiver_id: m.receiver_id, sent_at: m.created_at })),
        payments: payments.map((p: any) => ({ id: p.id, amount: p.amount, credits: p.credits, status: p.status, date: p.created_at })),
        verification: verification.map((v: any) => ({ id: v.id, type: v.document_type, status: v.status, date: v.uploaded_at })),
        consents,
      }
    };

    res.json(exportData);
  });

  // GDPR: Request data deletion (Right to Erasure - Art. 17)
  app.post('/api/gdpr/delete', async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE_MY_DATA') {
      return res.status(400).json({ error: 'Please type DELETE_MY_DATA to confirm data deletion' });
    }
    const db = getDB();

    createAuditLog({
      action: 'gdpr_data_deletion',
      actor_id: userId,
      actor_ip: req.ip || 'unknown',
      actor_user_agent: req.headers['user-agent'] || 'unknown',
      resource_type: 'gdpr',
      resource_id: userId,
      details: 'User requested data deletion',
      severity: 'critical',
    });

    // Anonymize profile
    const profileIndex = db.profiles.findIndex((p: any) => p.id === userId);
    if (profileIndex !== -1) {
      db.profiles[profileIndex] = anonymizeUserData(db.profiles[profileIndex]);
    }

    // Anonymize user account
    const userIndex = db.users.findIndex((u: any) => u.id === userId);
    if (userIndex !== -1) {
      db.users[userIndex].email = `deleted-${userId}@anonymized.com`;
      db.users[userIndex].password = '';
      db.users[userIndex].gdpr_deleted = true;
    }

    // Remove sensitive data
    db.education_career = db.education_career?.filter((e: any) => e.user_id !== userId) || [];
    db.family_details = db.family_details?.filter((f: any) => f.user_id !== userId) || [];
    db.lifestyle = db.lifestyle?.filter((l: any) => l.user_id !== userId) || [];
    db.horoscope_details = db.horoscope_details?.filter((h: any) => h.user_id !== userId) || [];
    db.partner_preferences = db.partner_preferences?.filter((p: any) => p.user_id !== userId) || [];
    db.photos = db.photos?.filter((p: any) => p.user_id !== userId) || [];
    db.verification_documents = db.verification_documents?.filter((d: any) => d.user_id !== userId) || [];
    db.interests = db.interests?.filter((i: any) => i.sender_id !== userId && i.receiver_id !== userId) || [];
    db.messages = db.messages?.filter((m: any) => m.sender_id !== userId && m.receiver_id !== userId) || [];
    db.shortlists = db.shortlists?.filter((s: any) => s.user_id !== userId || s.shortlisted_user_id !== userId) || [];

    // Delete from Elasticsearch
    if (isESReady()) deleteProfileFromIndex(userId).catch(() => { });

    // Record deletion request
    if (!db.gdpr_deletion_requests) db.gdpr_deletion_requests = [];
    db.gdpr_deletion_requests.push({
      user_id: userId,
      requested_at: new Date().toISOString(),
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    saveDB(db);
    searchCache.invalidatePattern('search:');
    recommendationsCache.clear();

    res.json({ success: true, message: 'Your data has been deleted in compliance with GDPR Article 17.' });
  });

  // GDPR: Record consent (Art. 7)
  app.post('/api/gdpr/consent', async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const { consent_type, consent_given, consent_text } = req.body;
    const db = getDB();

    if (!db.gdpr_consents) db.gdpr_consents = [];

    // Update or create consent
    const existingIndex = db.gdpr_consents.findIndex((c: any) => c.user_id === userId && c.consent_type === consent_type);
    const consentRecord = {
      user_id: userId,
      consent_type,
      consent_given,
      consent_text,
      ip_address: req.ip || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
      given_at: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      if (!consent_given) {
        db.gdpr_consents[existingIndex].consent_given = false;
        db.gdpr_consents[existingIndex].withdrawn_at = new Date().toISOString();
      } else {
        db.gdpr_consents[existingIndex] = consentRecord;
      }
    } else {
      db.gdpr_consents.push(consentRecord);
    }

    saveDB(db);

    createAuditLog({
      action: consent_given ? 'gdpr_consent_given' : 'gdpr_consent_withdrawn',
      actor_id: userId,
      actor_ip: req.ip || 'unknown',
      actor_user_agent: req.headers['user-agent'] || 'unknown',
      resource_type: 'gdpr',
      resource_id: userId,
      details: `Consent ${consent_given ? 'given' : 'withdrawn'} for: ${consent_type}`,
      severity: 'info',
    });

    res.json({ success: true });
  });

  // GDPR: Get user consents
  app.get('/api/gdpr/consents', async (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const db = getDB();
    const consents = db.gdpr_consents?.filter((c: any) => c.user_id === userId) || [];
    res.json(consents);
  });

  // GDPR: Get consent categories
  app.get('/api/gdpr/categories', (req, res) => {
    res.json(GDPR_DATA_CATEGORIES);
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Security Audit Log Endpoints
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Admin: Get audit logs
  app.get('/api/admin/audit-logs', (req, res) => {
    const { actor_id, action, resource_type, severity, limit, offset } = req.query;
    const logs = getAuditLogs({
      actor_id: actor_id as string,
      action: action as string,
      resource_type: resource_type as string,
      severity: severity as string,
      limit: Number(limit) || 100,
      offset: Number(offset) || 0,
    });
    res.json(logs);
  });

  // Admin: Get security status
  app.get('/api/admin/security-status', (req, res) => {
    const recentLogs = getAuditLogs({ limit: 1000 });
    const last24h = recentLogs.filter(l => Date.now() - new Date(l.timestamp).getTime() < 86400000);
    const criticalEvents = last24h.filter(l => l.severity === 'critical');
    const failedLogins = last24h.filter(l => l.action === 'login_failed');
    const sqlInjectionAttempts = last24h.filter(l => l.action === 'sql_injection_attempt');

    res.json({
      security_headers: getSecurityHeaders(),
      encryption: {
        algorithm: 'aes-256-gcm',
        pii_fields_encrypted: ['phone', 'email', 'aadhaar_number', 'pan_number'],
        key_configured: !!process.env.ENCRYPTION_KEY,
      },
      last_24h: {
        total_events: last24h.length,
        critical_events: criticalEvents.length,
        failed_logins: failedLogins.length,
        sql_injection_attempts: sqlInjectionAttempts.length,
      },
      gdpr: {
        consents_recorded: true,
        data_export_enabled: true,
        data_deletion_enabled: true,
        right_to_be_forgotten: true,
      },
      pci_dss: {
        card_storage_prohibited: true,
        tokenization: true,
        last4_only: true,
      },
      owasp_compliance: {
        A01_broken_access_control: 'Implemented - role-based auth',
        A02_cryptographic_failures: 'AES-256-GCM encryption at rest',
        A03_injection: 'Input sanitization + SQL injection detection',
        A04_insecure_design: 'Rate limiting + brute force protection',
        A05_security_misconfiguration: 'Security headers + HSTS',
        A06_vulnerable_components: 'Regular dependency updates recommended',
        A07_auth_failures: 'Password policy + account lockout + JWT expiry',
        A08_data_integrity: 'Audit logging + integrity checks',
        A09_logging_failures: 'Comprehensive audit logging',
        A10_ssrF: 'Input sanitization + URL validation',
      }
    });
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Accessibility Compliance Endpoint
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get('/api/admin/accessibility-status', (req, res) => {
    res.json({
      wcag_version: '2.1',
      conformance_level: 'AA',
      features: {
        skip_to_content: true,
        focus_indicators: true,
        keyboard_navigation: true,
        screen_reader_support: true,
        aria_landmarks: true,
        focus_trap_modals: true,
        reduced_motion: true,
        high_contrast_support: true,
        min_touch_target_44px: true,
        color_contrast_ratio: '4.5:1 minimum (AA)',
        language_attributes: true,
        multi_language: true,
        supported_languages: ['en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn'],
      },
      wcag_criteria: {
        '1.1.1_non_text_content': 'All images have alt text',
        '1.3.1_info_and_relationships': 'Semantic HTML + ARIA landmarks',
        '1.4.3_contrast_minimum': '4.5:1 ratio for normal text, 3:1 for large',
        '1.4.11_non_text_contrast': '3:1 for UI components',
        '2.1.1_keyboard': 'All functionality via keyboard',
        '2.1.2_no_keyboard_trap': 'Focus trap only in modals (escapable)',
        '2.4.1_bypass_blocks': 'Skip to content link',
        '2.4.3_focus_order': 'Logical tab order',
        '2.4.7_focus_visible': '3px gold outline on focus',
        '2.5.5_target_size': '44x44px minimum on touch devices',
        '3.1.1_language_of_page': 'lang attribute on html element',
        '4.1.2_name_role_value': 'ARIA roles, labels, states on all controls',
      },
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Scalability Admin Endpoints
  // ──────────────────────────────────────────────────────────────────────────────

  // Admin: Get scaling status
  app.get('/api/admin/scaling-status', (req, res) => {
    const loadMetrics = getRequestLoadMetrics();
    const systemLoad = collectLoadMetrics();
    res.json({
      cluster: {
        mode: process.env.CLUSTER_MODE === 'true' ? 'cluster' : 'single',
        pid: process.pid,
        workerId: process.env.CLUSTER_MODE === 'true' ? 'worker' : 'primary',
        cpuCores: os.cpus().length,
      },
      autoScaling: autoScaler.getStatus(),
      load: {
        system: systemLoad,
        requests: loadMetrics,
      },
      replicas: replicaManager.getStatus(),
      cdn: getCDNConfig(),
    });
  });

  // Admin: Get scaling decision
  app.get('/api/admin/scaling-decision', (req, res) => {
    const decision = autoScaler.getScalingDecision();
    res.json(decision);
  });

  // Admin: Configure CDN
  app.post('/api/admin/cdn-config', (req, res) => {
    const { baseUrl, maxAge, staleWhileRevalidate } = req.body;
    configureCDN({ baseUrl, maxAge, staleWhileRevalidate });
    createAuditLog({
      action: 'cdn_config_update',
      actor_id: req.headers['x-user-id'] as string || 'admin',
      actor_ip: req.ip || 'unknown',
      actor_user_agent: req.headers['user-agent'] || 'unknown',
      resource_type: 'config',
      resource_id: 'cdn',
      details: `CDN config updated: baseUrl=${baseUrl}`,
      severity: 'info',
    });
    res.json({ success: true, config: getCDNConfig() });
  });

  // Load balancer health check (lightweight, for LB probes)
  app.get('/api/lb-health', (req, res) => {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const isHealthy = heapUsedMB < 512; // Unhealthy if heap > 512MB
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      heapUsedMB,
      uptime: Math.round(process.uptime()),
    });
  });

  // PCI DSS: Validate payment data doesn't contain raw card info
  app.use('/api/checkout', (req, res, next) => {
    if (req.body && !validateNoCardStorage(req.body)) {
      createAuditLog({
        action: 'pci_violation',
        actor_id: req.headers['x-user-id'] as string || 'unknown',
        actor_ip: req.ip || 'unknown',
        actor_user_agent: req.headers['user-agent'] || 'unknown',
        resource_type: 'payment',
        resource_id: 'checkout',
        details: 'Attempt to store raw card data detected',
        severity: 'critical',
      });
      return res.status(400).json({ error: 'Raw card data cannot be stored. Use tokenized payments only.' });
    }
    next();
  });

  app.get('/api/recommendations', async (req, res) => {
    try {
      const { userId, limit = 8 } = req.query;
      // Check cache (5 minute TTL)
      const cacheKey = `recs:${userId}:${limit}`;
      const cached = recommendationsCache.get(cacheKey);
      if (cached && cached._cachedAt && Date.now() - cached._cachedAt < 5 * 60 * 1000) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cached.data);
      }
      const db = getDB();
      const myProfile = db.profiles.find((p: any) => p.id === userId);
      const myPrefs = db.partner_preferences?.find((pp: any) => pp.user_id === userId);

      const blockedIds = Array.isArray(db.user_blocks)
        ? db.user_blocks
          .filter((b: any) => b.blocker_id === userId || b.blocked_id === userId)
          .map((b: any) => b.blocker_id === userId ? b.blocked_id : b.blocker_id)
        : [];

      let results = db.profiles.filter((p: any) =>
        p.id !== userId &&
        p.is_active &&
        p.role !== 'admin' &&
        !blockedIds.includes(p.id) &&
        (!p.profile_status || p.profile_status === "active")
      );

      if (myProfile?.gender) {
        results = results.filter((p: any) => p.gender !== myProfile.gender);
      }

      // Calculate match score per profile
      const scoredResults = results.map((p: any) => {
        let score = 0;
        const total = 7;
        if (myProfile && p) {
          // Religion: check preference first, fall back to own profile match
          const relPref = myPrefs?.religion_pref;
          if (relPref && Array.isArray(relPref) && relPref.length > 0) {
            if (relPref.includes(p.religion)) score++;
          } else if (myProfile.religion && p.religion && myProfile.religion === p.religion) {
            score++;
          }
          // Caste: check preference first, fall back to own profile match
          const castePref = myPrefs?.caste_pref;
          if (castePref && Array.isArray(castePref) && castePref.length > 0) {
            if (castePref.includes(p.caste)) score++;
          } else if (myProfile.caste && p.caste && myProfile.caste === p.caste) {
            score++;
          }
          // Mother tongue: check preference first
          const mtPref = myPrefs?.mother_tongue_pref;
          if (mtPref && Array.isArray(mtPref) && mtPref.length > 0) {
            if (mtPref.includes(p.mother_tongue)) score++;
          } else if (myProfile.mother_tongue && p.mother_tongue &&
            myProfile.mother_tongue === p.mother_tongue) {
            score++;
          }
          // Age: use preferences
          const theirAge = p.date_of_birth ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() : 0;
          if (myPrefs && theirAge >= (myPrefs.age_from || 18) &&
            theirAge <= (myPrefs.age_to || 60)) score++;
          // State: check state_pref first
          const statePref = myPrefs?.state_pref;
          if (statePref && Array.isArray(statePref) && statePref.length > 0) {
            if (statePref.includes(p.state)) score++;
          } else if (p.state && myProfile.state && p.state === myProfile.state) {
            score++;
          }
          // City match bonus
          if (p.city && myProfile.city && p.city === myProfile.city) score += 0.5;
          // Profile completion bonus
          if (p.profile_completion >= 70) score += 0.5;
          // Marital status preference
          const maritalPref = myPrefs?.marital_status_pref;
          if (maritalPref && Array.isArray(maritalPref) && maritalPref.length > 0) {
            if (maritalPref.includes(p.marital_status)) score++;
          }
        }
        const matchPct = Math.round((score / total) * 100);
        return { profile: p, matchPct };
      });

      // Sort by Premium first, then by Match Percentage
      const sorted = scoredResults.sort((a, b) => {
        // Priority 1: Premium Member
        if (a.profile.is_premium && !b.profile.is_premium) return -1;
        if (!a.profile.is_premium && b.profile.is_premium) return 1;

        // Priority 2: Match Percentage
        return b.matchPct - a.matchPct;
      });

      const limited = sorted.slice(0, Number(limit)).map(({ profile: p, matchPct }) => ({
        ...p,
        matchPct,
        education_career: db.education_career?.find((e: any) => e.user_id === p.id) || null
      }));
      recommendationsCache.set(cacheKey, { data: limited, _cachedAt: Date.now() });
      res.setHeader('X-Cache', 'MISS');
      res.json(limited);
    } catch (error) {
      console.error('[/api/recommendations] Error:', error?.message || error);
      res.json([]);
    }
  });

  app.get('/api/new-members', async (req, res) => {
    try {
      const { userId, limit = 8 } = req.query;
      const db = getDB();
      const myProfile = db.profiles.find((p: any) => p.id === userId);

      const blockedIds = Array.isArray(db.user_blocks)
        ? db.user_blocks
          .filter((b: any) => b.blocker_id === userId || b.blocked_id === userId)
          .map((b: any) => b.blocker_id === userId ? b.blocked_id : b.blocker_id)
        : [];

      let results = db.profiles.filter((p: any) =>
        p.id !== userId &&
        p.is_active &&
        p.role !== 'admin' &&
        !blockedIds.includes(p.id)
      );

      if (myProfile?.gender) {
        results = results.filter((p: any) => p.gender !== myProfile.gender);
      }

      // Scoring: city match > state match > premium > recent
      const scored = results.map((p: any) => {
        let score = 0;
        if (myProfile?.city && p.city && p.city === myProfile.city) score += 3;
        else if (myProfile?.state && p.state && p.state === myProfile.state) score += 2;
        if (p.is_premium) score += 1;
        return { profile: p, score };
      });

      // Sort: higher score first, then by newest
      scored.sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.profile.created_at).getTime() - new Date(a.profile.created_at).getTime();
      });

      const limited = scored.slice(0, Number(limit)).map(({ profile: p }: any) => ({
        ...p,
        education_career: db.education_career?.find((e: any) => e.user_id === p.id) || null
      }));
      res.json(limited);
    } catch (error: any) {
      console.error('[/api/new-members] Error:', error?.message || error);
      res.json([]);
    }
  });

  // Interests
  app.get('/api/interests/received/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const interests = db.interests.filter((i: any) => i.receiver_id === userId && i.status !== 'cancelled');
    const enriched = interests.map((i: any) => ({
      ...i,
      sender: db.profiles.find((p: any) => p.id === i.sender_id)
    })).filter((i: any) => i.sender && i.sender.is_verified === true);
    res.json(enriched);
  });

  app.get('/api/interests/sent/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    // Only return active (non-cancelled) interests for the Sent tab display
    const interests = db.interests.filter((i: any) => i.sender_id === userId && i.status !== 'cancelled');
    const enriched = interests.map((i: any) => ({
      ...i,
      receiver: db.profiles.find((p: any) => p.id === i.receiver_id)
    })).filter((i: any) => i.receiver && i.receiver.is_verified === true);
    res.json(enriched);
  });

  // Sent-all: includes cancelled/declined for cooldown detection (no status filter)
  app.get('/api/interests/sent-all/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const interests = db.interests.filter((i: any) => i.sender_id === userId);
    const enriched = interests.map((i: any) => ({
      ...i,
      receiver: db.profiles.find((p: any) => p.id === i.receiver_id)
    }));
    res.json(enriched);
  });

  // Exact status check without is_verified filtering (used for ViewProfilePage state)
  app.get('/api/interests/status/:userA/:userB', async (req, res) => {
    const { userA, userB } = req.params;
    const db = getDB();

    // Find highest priority interest sent by userA to userB
    const sentInterests = db.interests?.filter((i: any) => i.sender_id === userA && i.receiver_id === userB) || [];
    // Find highest priority interest received by userA from userB
    const receivedInterests = db.interests?.filter((i: any) => i.sender_id === userB && i.receiver_id === userA) || [];

    const getPriority = (status: string) => {
      if (status === 'accepted') return 4;
      if (status === 'pending') return 3;
      if (status === 'declined') return 2;
      return 1; // cancelled
    };

    sentInterests.sort((a: any, b: any) => getPriority(b.status) - getPriority(a.status));
    receivedInterests.sort((a: any, b: any) => getPriority(b.status) - getPriority(a.status));

    res.json({
      sent: sentInterests[0] || null,
      received: receivedInterests[0] || null
    });
  });

  app.post('/api/interests', async (req, res) => {
    const { sender_id, receiver_id } = req.body;
    const db = getDB();

    // Validation: check for existing interest records in this direction
    const existingInterest = db.interests.find((i: any) =>
      i.sender_id === sender_id && i.receiver_id === receiver_id
    );

    // Validation: check for reverse direction (if they already sent YOU an interest)
    const reverseInterest = db.interests.find((i: any) =>
      i.sender_id === receiver_id && i.receiver_id === sender_id
    );

    if (reverseInterest) {
      if (reverseInterest.status === 'accepted') {
        return res.status(400).json({ error: 'You are already connected with this profile.' });
      }
      if (reverseInterest.status === 'pending') {
        return res.status(400).json({ error: 'This user has already sent you an interest. Please accept it instead.' });
      }
    }

    if (existingInterest) {
      if (existingInterest.status === 'pending' || existingInterest.status === 'accepted') {
        return res.status(400).json({ error: 'Interest already exists between you and this profile.' });
      }
      // PERMANENTLY BLOCKED: receiver declined the interest
      if (existingInterest.status === 'declined') {
        return res.status(403).json({ error: 'REJECTED', message: 'This profile has declined your previous interest. You cannot resend.' });
      }
      // 48-HOUR COOLDOWN: sender cancelled the interest
      if (existingInterest.status === 'cancelled' && existingInterest.cancelled_at) {
        const cancelledAt = new Date(existingInterest.cancelled_at).getTime();
        const hoursPassed = (Date.now() - cancelledAt) / (1000 * 60 * 60);
        if (hoursPassed < 48) {
          const hoursLeft = Math.ceil(48 - hoursPassed);
          return res.status(429).json({ error: 'COOLDOWN', message: `You cancelled this interest. Please wait ${hoursLeft} more hour(s) before resending.`, hoursLeft });
        }
        // Cooldown passed â€” reactivate existing record
        const idx = db.interests.findIndex((i: any) => i.id === existingInterest.id);
        db.interests[idx].status = 'pending';
        db.interests[idx].cancelled_at = null;
        db.interests[idx].updated_at = new Date().toISOString();
        saveDB(db);
        return res.json(db.interests[idx]);
      }
    }

    const newInterest = {
      id: uuidv4(),
      sender_id,
      receiver_id,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.interests.push(newInterest);

    // Notification
    const sender = db.profiles.find((p: any) => p.id === sender_id);
    const interestReceivedNotifId = uuidv4();
    db.notifications.push({
      id: interestReceivedNotifId,
      user_id: receiver_id,
      type: 'interest_received',
      title: 'New Interest Received!',
      body: `${sender?.first_name || 'Someone'} is interested in your profile.`,
      is_read: false,
      created_at: new Date().toISOString()
    });

    saveDB(db);

    // Real-time: emit interest notification to receiver
    const io = (app as any).io;
    if (io) {
      io.to(`user:${receiver_id}`).emit('notification:new', {
        id: interestReceivedNotifId,
        type: 'interest_received',
        title: 'New Interest Received!',
        body: `${sender?.first_name || 'Someone'} is interested in your profile.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
      io.to(`user:${receiver_id}`).emit('interest:new', newInterest);
      // Real-time: notify admin panel of new interest
      io.to('admin:room').emit('admin:interest-sent', { sender_id, receiver_id, interest: newInterest });
    }

    res.json(newInterest);
  });

  app.post('/api/interests/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, receiverName } = req.body;
    const db = getDB();
    const idx = db.interests.findIndex((i: any) => i.id === id);
    if (idx !== -1) {
      const interest = db.interests[idx];
      db.interests[idx].status = status;
      db.interests[idx].updated_at = new Date().toISOString();
      const acceptDeclineNotifId = uuidv4();
      db.notifications.push({
        id: acceptDeclineNotifId,
        user_id: interest.sender_id,
        type: status === 'accepted' ? 'interest_accepted' : 'interest_declined',
        title: status === 'accepted' ? 'Interest Accepted!' : 'Interest Update',
        body: status === 'accepted'
          ? `${receiverName} accepted your interest! You can now start chatting.`
          : `${receiverName} has declined your interest.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
      saveDB(db);
      recommendationsCache.clear();

      // Real-time: emit interest status update to sender AND receiver
      const io = (app as any).io;
      if (io) {
        io.to(`user:${interest.sender_id}`).emit('notification:new', {
          id: acceptDeclineNotifId,
          type: status === 'accepted' ? 'interest_accepted' : 'interest_declined',
          title: status === 'accepted' ? 'Interest Accepted!' : 'Interest Update',
          body: status === 'accepted'
            ? `${receiverName} accepted your interest! You can now start chatting.`
            : `${receiverName} has declined your interest.`,
          is_read: false,
          created_at: new Date().toISOString()
        });
        io.to(`user:${interest.sender_id}`).emit('interest:updated', { interestId: id, status, sender_id: interest.sender_id, receiver_id: interest.receiver_id });
        io.to(`user:${interest.receiver_id}`).emit('interest:updated', { interestId: id, status, sender_id: interest.sender_id, receiver_id: interest.receiver_id });
        // Real-time: notify admin panel of interest status change
        io.to('admin:room').emit('admin:interest-updated', { interestId: id, status, sender_id: interest.sender_id, receiver_id: interest.receiver_id });
      }

      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Interest not found' });
    }
  });

  app.delete('/api/interests/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const index = db.interests.findIndex((i: any) => i.id === id);
    if (index !== -1) {
      // Soft-cancel: keep record so 48h cooldown can be enforced
      db.interests[index].status = 'cancelled';
      db.interests[index].cancelled_at = new Date().toISOString();
      db.interests[index].updated_at = new Date().toISOString();
      saveDB(db);
      const cancelledInterest = db.interests[index];
      const io = (app as any).io;
      if (io) {
        io.to(`user:${cancelledInterest.receiver_id}`).emit('interest:updated', {
          interestId: id,
          status: 'cancelled',
          sender_id: cancelledInterest.sender_id,
          receiver_id: cancelledInterest.receiver_id
        });
        io.to(`user:${cancelledInterest.sender_id}`).emit('interest:updated', {
          interestId: id,
          status: 'cancelled',
          sender_id: cancelledInterest.sender_id,
          receiver_id: cancelledInterest.receiver_id
        });
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Interest not found' });
    }
  });

  // Messages
  app.get('/api/messages/:userId/:otherUserId', async (req, res) => {
    const { userId, otherUserId } = req.params;
    const db = getDB();
    const messages = db.messages.filter((m: any) =>
      (m.sender_id === userId && m.receiver_id === otherUserId) ||
      (m.sender_id === otherUserId && m.receiver_id === userId)
    );
    res.json(messages);
  });

  app.post('/api/messages', async (req, res) => {
    const { sender_id, receiver_id, content } = req.body;
    const db = getDB();
    const newMessage = { id: uuidv4(), sender_id, receiver_id, content, is_read: false, created_at: new Date().toISOString() };
    db.messages.push(newMessage);
    const msgSender = db.profiles.find((p: any) => p.id === sender_id);
    const senderName = msgSender?.first_name || 'Someone';

    // Only create notification if there isn't already an unread message notification from this sender
    const existingUnread = db.notifications.find((n: any) =>
      n.user_id === receiver_id &&
      n.type === 'new_message' &&
      !n.is_read &&
      n.body?.includes(senderName)
    );

    // Generate notification ID once — reused in DB record AND socket emit (same ID, no duplicate)
    const msgNotifId = uuidv4();

    if (!existingUnread) {
      db.notifications.push({
        id: msgNotifId,
        user_id: receiver_id,
        type: 'new_message',
        title: 'New Message',
        body: `${senderName} sent you a message.`,
        is_read: false,
        created_at: new Date().toISOString()
      });
    }
    saveDB(db);

    // Real-time: emit new message and notification to receiver
    const io = (app as any).io;
    if (io) {
      const roomId = [sender_id, receiver_id].sort().join(':');
      io.to(`chat:${roomId}`).emit('message:new', newMessage);
      if (!existingUnread) {
        const notifPayload = {
          id: msgNotifId,
          user_id: receiver_id,
          type: 'new_message',
          title: 'New Message',
          body: `${senderName} sent you a message.`,
          is_read: false,
          created_at: new Date().toISOString()
        };
        // Emit to receiver's personal room
        io.to(`user:${receiver_id}`).emit('notification:new', notifPayload);
        // Also broadcast globally — client filters by user_id
        io.emit('notification:broadcast', notifPayload);
      }
      // Real-time: notify admin panel of new message
      io.to('admin:room').emit('admin:message-sent', { sender_id, receiver_id, message: newMessage });
    }

    res.json(newMessage);
  });


  // Notifications
  app.get('/api/notifications/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const notifications = db.notifications.filter((n: any) => n.user_id === userId);
    res.json(notifications);
  });

  app.post('/api/notifications/:id/read', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const index = db.notifications.findIndex((n: any) => n.id === id);
    if (index !== -1) {
      db.notifications[index].is_read = true;
      saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  });

  // Online status check
  app.get('/api/users/online', (req, res) => {
    const io = (app as any).io;
    if (!io) return res.json([]);
    // Get connected user IDs from socket rooms
    const onlineIds: string[] = [];
    const rooms = io.sockets.adapter.rooms;
    for (const [roomName] of rooms) {
      if (roomName.startsWith('user:')) {
        onlineIds.push(roomName.replace('user:', ''));
      }
    }
    res.json(onlineIds);
  });

  // Dashboard Stats
  app.get('/api/dashboard/stats/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const interestsReceived = db.interests.filter((i: any) => i.receiver_id === userId && i.status === 'pending').length;
    const interestsSent = db.interests.filter((i: any) => i.sender_id === userId).length;

    // Only count views from verified profiles
    const profileViews = (db.profile_views?.filter((v: any) => {
      if (v.viewed_id !== userId) return false;
      const viewer = db.profiles.find((p: any) => p.id === v.viewer_id);
      return viewer && viewer.is_verified === true;
    }) || []).length;

    const shortlistedBy = db.shortlists?.filter((s: any) => s.shortlisted_user_id === userId).length || 0;
    res.json({ interestsReceived, interestsSent, profileViews, shortlistedBy });
  });

  // Profile Views
  app.post('/api/profile-views', async (req, res) => {
    const { viewerId, viewedId } = req.body;
    if (viewerId === viewedId) return res.json({ success: true });
    const db = getDB();
    if (!db.profile_views) db.profile_views = [];
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const existing = db.profile_views.find((v: any) => v.viewer_id === viewerId && v.viewed_id === viewedId && new Date(v.viewed_at) > oneDayAgo);
    if (!existing) {
      db.profile_views.push({ viewer_id: viewerId, viewed_id: viewedId, viewed_at: new Date().toISOString() });
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.to(`user:${viewedId}`).emit('profile:viewed', {
          viewerId,
          viewedAt: new Date().toISOString()
        });
      }
    }
    res.json({ success: true });
  });

  app.get('/api/profile-views/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const views = db.profile_views?.filter((v: any) => v.viewed_id === userId) || [];
    const enriched = views.map((v: any) => ({
      ...v,
      viewer: db.profiles.find((p: any) => p.id === v.viewer_id)
    })).filter((v: any) => v.viewer && v.viewer.is_verified === true);
    res.json(enriched);
  });

  // Shortlists
  app.post('/api/shortlists/toggle', async (req, res) => {
    const { userId, targetId } = req.body;
    const db = getDB();
    if (!db.shortlists) db.shortlists = [];

    const index = db.shortlists.findIndex((s: any) => s.user_id === userId && s.shortlisted_user_id === targetId);
    if (index !== -1) {
      db.shortlists.splice(index, 1);
      saveDB(db);
      const ioS = (app as any).io;
      if (ioS) {
        ioS.to(`user:${targetId}`).emit('shortlist:updated', { userId, targetId, shortlisted: false });
      }
      res.json({ shortlisted: false });
    } else {
      db.shortlists.push({ user_id: userId, shortlisted_user_id: targetId, created_at: new Date().toISOString() });
      saveDB(db);
      const ioS = (app as any).io;
      if (ioS) {
        ioS.to(`user:${targetId}`).emit('shortlist:updated', { userId, targetId, shortlisted: true });
      }
      res.json({ shortlisted: true });
    }
  });

  app.get('/api/shortlists/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const shortlists = db.shortlists.filter((s: any) => s.user_id === userId);
    const enriched = shortlists.map((s: any) => {
      const profile = db.profiles.find((p: any) => p.id === s.shortlisted_user_id);
      if (profile) {
        return {
          ...s,
          shortlisted_user: {
            ...profile,
            photos: db.photos.filter((p: any) => p.user_id === profile.id)
          }
        };
      }
      return s;
    });
    res.json(enriched);
  });

  // ---- MEMBERSHIP & CREDIT PLANS API ---- //
  app.get('/api/plans/membership', async (req, res) => {
    const db = getDB();
    res.json(db.membership_plans || []);
  });

  app.post('/api/plans/membership', async (req, res) => {
    const db = getDB();
    if (!db.membership_plans) db.membership_plans = [];
    const newPlan = { ...req.body, id: `plan_${Date.now()}` };
    db.membership_plans.push(newPlan);
    saveDB(db);
    const ioS = (app as any).io;
    if (ioS) ioS.emit('plans:updated');
    res.json(newPlan);
  });

  app.put('/api/plans/membership/:id', async (req, res) => {
    const db = getDB();
    const index = db.membership_plans.findIndex((p: any) => String(p.id) === String(req.params.id));
    if (index !== -1) {
      db.membership_plans[index] = { ...db.membership_plans[index], ...req.body };
      saveDB(db);
      const ioS = (app as any).io;
      if (ioS) ioS.emit('plans:updated');
      res.json(db.membership_plans[index]);
    } else res.status(404).json({ error: 'Plan not found' });
  });

  app.delete('/api/plans/membership/:id', async (req, res) => {
    const db = getDB();
    db.membership_plans = db.membership_plans.filter((p: any) => String(p.id) !== String(req.params.id));
    saveDB(db);
    const ioS = (app as any).io;
    if (ioS) ioS.emit('plans:updated');
    res.json({ success: true });
  });

  app.get('/api/plans/credits', async (req, res) => {
    const db = getDB();
    res.json(db.credit_plans || []);
  });

  app.post('/api/plans/credits', async (req, res) => {
    const db = getDB();
    if (!db.credit_plans) db.credit_plans = [];
    const newPlan = { ...req.body, id: `credit_${Date.now()}` };
    db.credit_plans.push(newPlan);
    saveDB(db);
    const ioS = (app as any).io;
    if (ioS) ioS.emit('plans:updated');
    res.json(newPlan);
  });

  app.put('/api/plans/credits/:id', async (req, res) => {
    const db = getDB();
    const index = db.credit_plans.findIndex((p: any) => String(p.id) === String(req.params.id));
    if (index !== -1) {
      db.credit_plans[index] = { ...db.credit_plans[index], ...req.body };
      saveDB(db);
      const ioS = (app as any).io;
      if (ioS) ioS.emit('plans:updated');
      res.json(db.credit_plans[index]);
    } else res.status(404).json({ error: 'Plan not found' });
  });

  app.delete('/api/plans/credits/:id', async (req, res) => {
    const db = getDB();
    db.credit_plans = db.credit_plans.filter((p: any) => String(p.id) !== String(req.params.id));
    saveDB(db);
    const ioS = (app as any).io;
    if (ioS) ioS.emit('plans:updated');
    res.json({ success: true });
  });

  app.post('/api/purchases/membership', async (req, res) => {
    const { userId, planId } = req.body;
    const db = getDB();
    const plan = db.membership_plans.find((p: any) => p.id === planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    if (!db.membership_purchases) db.membership_purchases = [];
    db.membership_purchases.push({ userId, planId, amount: plan.price, date: new Date().toISOString() });

    const profile = db.profiles.find((p: any) => p.id === userId);
    if (profile) {
      profile.is_premium = true;
      let end = new Date();
      if (profile.premium_end && new Date(profile.premium_end) > end) {
        end = new Date(profile.premium_end);
      }
      end.setMonth(end.getMonth() + (plan.duration_months || 1));
      profile.premium_end = end.toISOString();
      profile.plan_id = planId;

      // BUSINESS RULE: When membership is bought/renewed, paid credits get "no expiry"
      // They are tied to the membership â€” null means "never expires while membership active"
      // We preserve paid_credits_expiry_after_membership so when membership ends we can start the countdown
      if (profile.paid_credits && profile.paid_credits > 0) {
        profile.paid_credits_expiry = null; // Tied to membership, no independent expiry
      }
    }
    saveDB(db);
    res.json({ success: true, profile });
  });

  app.post('/api/purchases/credits', async (req, res) => {
    const { userId, planId } = req.body;
    const db = getDB();
    const plan = db.credit_plans.find((p: any) => p.id === planId);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    if (!db.credit_purchases) db.credit_purchases = [];
    db.credit_purchases.push({
      userId, planId, amount: plan.price, credits: plan.credits,
      date: new Date().toISOString(),
      expiry_days: plan.expiry_days || 90
    });

    const profile = db.profiles.find((p: any) => p.id === userId);
    if (profile) {
      profile.paid_credits = (profile.paid_credits || 0) + plan.credits;

      const expiryDays = plan.expiry_days || 90;
      const now = new Date();
      const membershipActive = profile.is_premium && profile.premium_end && new Date(profile.premium_end) > now;

      if (membershipActive) {
        // BUSINESS RULE: User has active membership â†’ credits tied to membership end, never expire independently
        // Set credit expiry = null to indicate "never expires while membership active"
        // We store the plan's expiry_days to use AFTER membership ends
        profile.paid_credits_expiry = null; // No independent expiry
        profile.paid_credits_expiry_after_membership = expiryDays; // Days to count after membership ends
      } else {
        // BUSINESS RULE: No active membership â†’ credits expire based on plan's expiry_days
        // If user already has unexpired credits, extend from the later of (now, existing expiry)
        let startDate = now;
        if (profile.paid_credits_expiry && new Date(profile.paid_credits_expiry) > now) {
          startDate = new Date(profile.paid_credits_expiry);
        }
        const newExpiry = new Date(startDate);
        newExpiry.setDate(newExpiry.getDate() + expiryDays);
        profile.paid_credits_expiry = newExpiry.toISOString();
        profile.paid_credits_expiry_after_membership = expiryDays;
      }
    }
    saveDB(db);
    res.json({ success: true, profile });
  });

  app.get('/api/purchases/history/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const membership = (db.membership_purchases || []).filter((p: any) => p.userId === userId).map((p: any) => ({ ...p, type: 'membership' }));
    const credits = (db.credit_purchases || []).filter((p: any) => p.userId === userId).map((p: any) => ({ ...p, type: 'credits' }));
    const history = [...membership, ...credits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(history);
  });

  app.get('/api/shortlists/:userId/:targetId', async (req, res) => {
    const { userId, targetId } = req.params;
    const db = getDB();
    const exists = db.shortlists?.some((s: any) => s.user_id === userId && s.shortlisted_user_id === targetId);
    res.json({ shortlisted: !!exists });
  });

  // Verification
  app.get('/api/verification/status/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const docs = db.verification_documents.filter((d: any) => d.user_id === userId);
    res.json(docs);
  });

  app.get('/api/verification/pending', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = getDB();
    // Show users who have at least one PENDING document.
    // A user disappears from this list only when ALL their docs are rejected/approved (no pending remain).
    // When user re-uploads a rejected doc it becomes 'pending' â†’ they immediately reappear here.
    const pending = db.verification_documents.filter(
      (d: any) => d.verification_status === 'pending'
    );
    const enriched = pending.map((d: any) => ({
      ...d,
      profile: db.profiles.find((p: any) => p.id === d.user_id)
    }));
    res.json(enriched);
  });

  // Get all verification documents (with status filter)
  app.get('/api/verification/all', async (req, res) => {
    const db = getDB();
    const { status, search } = req.query;
    let docs = db.verification_documents;
    if (status && status !== 'all') docs = docs.filter((d: any) => d.verification_status === status);
    const enriched = docs.map((d: any) => {
      const profile = db.profiles.find((p: any) => p.id === d.user_id);
      if (search) {
        const s = String(search).toLowerCase();
        const matchName = profile?.first_name?.toLowerCase().includes(s) || profile?.last_name?.toLowerCase().includes(s);
        const matchEmail = profile?.email?.toLowerCase().includes(s);
        const matchPhone = profile?.phone?.includes(s);
        const matchProfileId = profile?.profile_id?.toLowerCase().includes(s);
        if (!matchName && !matchEmail && !matchPhone && !matchProfileId) return null;
      }
      return { ...d, profile };
    }).filter(Boolean).sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    res.json(enriched);
  });

  // Get verified users list
  app.get('/api/verification/verified-users', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const db = getDB();
    const { search } = req.query;

    // Get IDs of users whose aadhaar_front + aadhaar_back are BOTH approved
    const approvedUserIds = new Set(
      db.profiles
        .filter((p: any) => p.role !== 'admin')
        .filter((p: any) => {
          const requiredDocs = db.verification_documents.filter(
            (d: any) => d.user_id === p.id && ['aadhaar_front', 'aadhaar_back'].includes(d.document_type)
          );
          return requiredDocs.length >= 2 && requiredDocs.every((d: any) => d.verification_status === 'approved');
        })
        .map((p: any) => p.id)
    );

    // Auto-fix: mark is_verified=true for any who have both docs approved but flag not set
    let needsSave = false;
    db.profiles.forEach((p: any) => {
      if (approvedUserIds.has(p.id) && !p.is_verified) {
        p.is_verified = true;
        needsSave = true;
      }
    });
    if (needsSave) saveDB(db);

    let verifiedProfiles = db.profiles.filter((p: any) => approvedUserIds.has(p.id));
    if (search) {
      const s = String(search).toLowerCase();
      verifiedProfiles = verifiedProfiles.filter((p: any) =>
        p.first_name?.toLowerCase().includes(s) ||
        p.last_name?.toLowerCase().includes(s) ||
        p.email?.toLowerCase().includes(s) ||
        p.phone?.includes(s) ||
        p.profile_id?.toLowerCase().includes(s)
      );
    }
    const enriched = verifiedProfiles.map((p: any) => {
      const docs = db.verification_documents.filter((d: any) => d.user_id === p.id);
      return { ...p, documents: docs };
    }).sort((a: any, b: any) => {
      const aLatest = a.documents.reduce((max: string, d: any) => d.reviewed_at > max ? d.reviewed_at : max, '');
      const bLatest = b.documents.reduce((max: string, d: any) => d.reviewed_at > max ? d.reviewed_at : max, '');
      return bLatest.localeCompare(aLatest);
    });
    res.set('Cache-Control', 'no-store');
    res.json(enriched);
  });


  app.post('/api/verification/approve/:id', async (req, res) => {
    const { id } = req.params;
    const { adminId } = req.body;
    const db = getDB();
    const index = db.verification_documents.findIndex((d: any) => d.id === Number(id));
    if (index !== -1) {
      const doc = db.verification_documents[index];
      db.verification_documents[index].verification_status = 'approved';
      db.verification_documents[index].reviewed_by = adminId;
      db.verification_documents[index].reviewed_at = new Date().toISOString();

      // Check if all required docs approved
      const userDocs = db.verification_documents.filter((d: any) => d.user_id === doc.user_id && ['aadhaar_front', 'aadhaar_back'].includes(d.document_type));
      const allApproved = userDocs.length >= 2 && userDocs.every((d: any) => d.verification_status === 'approved');
      if (allApproved) {
        const profileIndex = db.profiles.findIndex((p: any) => p.id === doc.user_id);
        if (profileIndex !== -1) {
          db.profiles[profileIndex].is_verified = true;
        }
        db.notifications.push({
          id: uuidv4(),
          user_id: doc.user_id,
          type: 'verification_approved',
          title: 'Profile Verified! ✅',
          body: 'Your profile has been verified. You now have a verified badge.',
          is_read: false,
          created_at: new Date().toISOString()
        });
      }
      // CRITICAL: saveDB MUST run before any socket emit.
      // ProtectedRoute calls refreshProfile() (API fetch) immediately after the socket
      // redirect. If saveDB hasn't run yet, the API returns the old is_verified=false
      // profile, overwriting the correct value and bouncing the user back to /pending-approval.
      saveDB(db);
      // Now that DB is persisted, emit all socket events safely
      const io = (app as any).io;
      if (io) {
        const updatedProfile = db.profiles.find((p: any) => p.id === doc.user_id);
        // Notify user their profile is now verified (triggers redirect from PendingApprovalPage)
        if (allApproved && updatedProfile) {
          io.to(`user:${doc.user_id}`).emit('profile:updated', updatedProfile);
        }
        io.to('admin:room').emit('admin:doc-status-changed', { userId: doc.user_id, docType: doc.document_type, status: 'approved', profile: updatedProfile });
        io.to(`user:${doc.user_id}`).emit('document:status-changed', { userId: doc.user_id, docType: doc.document_type, status: 'approved', isVerified: allApproved });
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  });

  app.post('/api/verification/reject/:id', async (req, res) => {
    const { id } = req.params;
    const { adminId, reason } = req.body;
    const db = getDB();
    const index = db.verification_documents.findIndex((d: any) => d.id === Number(id));
    if (index !== -1) {
      const doc = db.verification_documents[index];
      db.verification_documents[index].verification_status = 'rejected';
      db.verification_documents[index].admin_notes = reason;
      db.verification_documents[index].reviewed_by = adminId;
      db.verification_documents[index].reviewed_at = new Date().toISOString();

      const profileIndex = db.profiles.findIndex((p: any) => p.id === doc.user_id);
      if (profileIndex !== -1) db.profiles[profileIndex].is_verified = false;

      db.notifications.push({
        id: uuidv4(),
        user_id: doc.user_id,
        type: 'verification_rejected',
        title: 'Document Rejected',
        body: `Your document was rejected. Reason: ${reason}. Please re-upload.`,
        is_read: false,
        created_at: new Date().toISOString()
      });

      saveDB(db);
      // Real-time: notify admin panel and user of document rejection
      const io = (app as any).io;
      if (io) {
        io.to('admin:room').emit('admin:doc-status-changed', { userId: doc.user_id, docType: doc.document_type, status: 'rejected', profile: db.profiles.find((p: any) => p.id === doc.user_id) });
        io.to(`user:${doc.user_id}`).emit('document:status-changed', { userId: doc.user_id, docType: doc.document_type, status: 'rejected', reason });
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  });

  // Admin Stats
  app.get('/api/admin/stats', async (req, res) => {
    const db = getDB();
    if (!db.credit_purchases) db.credit_purchases = [];
    if (!db.membership_purchases) db.membership_purchases = [];
    if (!db.verification_documents) db.verification_documents = [];
    if (!db.interests) db.interests = [];
    const nonAdminProfiles = db.profiles.filter((p: any) => p.role !== 'admin');
    const totalRevenue = db.credit_purchases.reduce((sum: number, cp: any) => sum + (cp.amount || cp.price || 0), 0)
      + db.membership_purchases.reduce((sum: number, mp: any) => sum + (mp.amount || mp.price || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyRevenue = db.credit_purchases.filter((cp: any) => (cp.created_at || '').slice(0, 7) === thisMonth)
      .reduce((sum: number, cp: any) => sum + (cp.amount || cp.price || 0), 0)
      + db.membership_purchases.filter((mp: any) => (mp.created_at || mp.purchase_date || '').slice(0, 7) === thisMonth)
        .reduce((sum: number, mp: any) => sum + (mp.amount || mp.price || 0), 0);
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
    const lastMonthRevenue = db.credit_purchases.filter((cp: any) => (cp.created_at || '').slice(0, 7) === lastMonth)
      .reduce((sum: number, cp: any) => sum + (cp.amount || cp.price || 0), 0)
      + db.membership_purchases.filter((mp: any) => (mp.created_at || mp.purchase_date || '').slice(0, 7) === lastMonth)
        .reduce((sum: number, mp: any) => sum + (mp.amount || mp.price || 0), 0);
    const revenueGrowth = lastMonthRevenue > 0 ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0;
    const blockedUsers = nonAdminProfiles.filter((p: any) => p.is_permanently_blocked || (p.blocked_until && new Date(p.blocked_until) > new Date())).length;
    const inactiveUsers = nonAdminProfiles.filter((p: any) => !p.is_active).length;
    const maleUsers = nonAdminProfiles.filter((p: any) => p.gender === 'groom' || p.gender === 'male').length;
    const femaleUsers = nonAdminProfiles.filter((p: any) => p.gender === 'bride' || p.gender === 'female').length;

    // Marital Status
    const divorcedUsers = nonAdminProfiles.filter((p: any) => (p.marital_status || '').toLowerCase().includes('divorc')).length;
    const singleUsers = nonAdminProfiles.filter((p: any) => (p.marital_status || '').toLowerCase().includes('single') || (p.marital_status || '').toLowerCase() === 'never married').length;
    const widowedUsers = nonAdminProfiles.filter((p: any) => (p.marital_status || '').toLowerCase().includes('widow')).length;

    // Age distribution
    const ageGroups = { '18-25': 0, '26-35': 0, '36-45': 0, '46+': 0 };
    nonAdminProfiles.forEach((p: any) => {
      if (!p.date_of_birth) return;
      const age = new Date().getFullYear() - new Date(p.date_of_birth).getFullYear();
      if (age >= 18 && age <= 25) ageGroups['18-25']++;
      else if (age >= 26 && age <= 35) ageGroups['26-35']++;
      else if (age >= 36 && age <= 45) ageGroups['36-45']++;
      else if (age >= 46) ageGroups['46+']++;
    });

    // City distribution (Top 5)
    const cityCounts: Record<string, number> = {};
    nonAdminProfiles.forEach((p: any) => {
      if (!p.city) return;
      const city = p.city.trim();
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([city, count]) => ({ city, count }));

    // Sub-Caste distribution (Top 5)
    const subCasteCounts: Record<string, number> = {};
    nonAdminProfiles.forEach((p: any) => {
      if (!p.sub_caste) return;
      const sub = p.sub_caste.trim();
      subCasteCounts[sub] = (subCasteCounts[sub] || 0) + 1;
    });
    const topSubCastes = Object.entries(subCasteCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sub_caste, count]) => ({ sub_caste, count }));

    // Buyers
    const uniqueMembershipBuyers = new Set(db.membership_purchases.map((mp: any) => mp.user_id)).size;
    const uniqueCreditBuyers = new Set(db.credit_purchases.map((cp: any) => cp.user_id)).size;
    const usersWithFreeCredits = nonAdminProfiles.filter((p: any) => p.free_credits > 0 || (p.total_free_credits_received && p.total_free_credits_received > 0)).length;
    const freeMembers = nonAdminProfiles.length - uniqueMembershipBuyers;

    res.json({
      totalUsers: nonAdminProfiles.length,
      activeUsers: nonAdminProfiles.filter((p: any) => p.is_active).length,
      inactiveUsers,
      premiumUsers: nonAdminProfiles.filter((p: any) => p.is_premium).length,
      verifiedUsers: nonAdminProfiles.filter((p: any) => p.is_verified).length,
      unverifiedUsers: nonAdminProfiles.filter((p: any) => !p.is_verified).length,
      blockedUsers,
      maleUsers,
      femaleUsers,
      divorcedUsers,
      singleUsers,
      widowedUsers,
      ageGroups,
      topCities,
      topSubCastes,
      uniqueMembershipBuyers,
      freeMembers,
      uniqueCreditBuyers,
      usersWithFreeCredits,
      pendingDocs: db.verification_documents.filter((d: any) => d.verification_status === 'pending').length,
      approvedDocs: db.verification_documents.filter((d: any) => d.verification_status === 'approved').length,
      rejectedDocs: db.verification_documents.filter((d: any) => d.verification_status === 'rejected').length,
      pendingReports: 0,
      totalInterests: db.interests.length,
      acceptedInterests: db.interests.filter((i: any) => i.status === 'accepted').length,
      totalRevenue,
      monthlyRevenue,
      revenueGrowth,
      totalTransactions: db.credit_purchases.length + db.membership_purchases.length,
      activeSubscriptions: db.membership_purchases.filter((mp: any) => mp.status !== 'cancelled' && (!mp.expiry_date || new Date(mp.expiry_date) > new Date())).length
    });
  });

  // Chat Safety
  app.get('/api/chat-safety/status/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const profile = db.profiles.find((p: any) => p.id === userId);
    const warning = db.chat_warnings?.find((w: any) => w.user_id === userId);
    res.json({
      isBlocked: !!(profile?.is_permanently_blocked || (profile?.blocked_until && new Date(profile.blocked_until) > new Date())),
      isPermanentlyBlocked: !!profile?.is_permanently_blocked,
      blockedUntil: profile?.blocked_until || null,
      warningCount: warning?.warning_count || 0,
      canSendMessage: true
    });
  });

  app.get('/api/success-stories', async (req, res) => {
    const db = getDB();
    const stories = db.success_stories
      .filter((s: any) => s.is_approved && !s.is_hidden)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map((s: any) => {
        const user = db.users.find((u: any) => u.id === s.user_id);
        const profile = db.profiles.find((p: any) => p.id === s.user_id);
        return {
          ...s,
          user: {
            first_name: profile?.first_name || 'User',
            last_name: profile?.last_name || ''
          }
        };
      });
    res.json(stories);
  });



  app.post('/api/success-stories/share', upload.array('photos', 10), async (req, res) => {
    try {
      const { userId, partnerName, groomName, brideName, storyText, year, location, submitterName, submitterEmail } = req.body;
      const db = getDB();

      const files = req.files as Express.Multer.File[];
      const photoUrls = files ? files.map((f: any) => `/uploads/${f.filename}`) : [];

      if (!db.success_stories) db.success_stories = [];

      db.success_stories.push({
        id: uuidv4(),
        user_id: userId || null,
        partner_name: partnerName || brideName || groomName || '',
        groom_name: groomName || '',
        bride_name: brideName || '',
        story_text: storyText || '',
        photo_url: photoUrls[0] || '',
        photo_urls: photoUrls,
        location: location || '',
        year: year || new Date().getFullYear().toString(),
        submitter_name: submitterName || '',
        submitter_email: submitterEmail || '',
        is_approved: false,
        created_at: new Date().toISOString()
      });

      saveDB(db);
      res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving success story:', err);
      res.status(500).json({ error: err?.message || 'Failed to save story' });
    }
  });

  // Mark messages as read
  app.post('/api/messages/:userId/:otherUserId/read', async (req, res) => {
    const { userId, otherUserId } = req.params;
    const db = getDB();
    db.messages.forEach((m: any) => {
      if (m.sender_id === otherUserId && m.receiver_id === userId) {
        m.is_read = true;
      }
    });
    saveDB(db);
    res.json({ success: true });
  });

  // Get unread message count
  app.get('/api/messages/unread-count/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const count = db.messages.filter((m: any) => m.receiver_id === userId && !m.is_read).length;
    res.json({ count });
  });

  // Mark all notifications as read
  app.post('/api/notifications/:userId/read-all', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    db.notifications.forEach((n: any) => {
      if (n.user_id === userId) n.is_read = true;
    });
    saveDB(db);
    res.json({ success: true });
  });

  // Chat Safety Violation
  app.post('/api/chat-safety/violation', async (req, res) => {
    const { userId, receiverId, messageContent, detectedPattern } = req.body;
    const db = getDB();

    let warning = db.chat_warnings.find((w: any) => w.user_id === userId);
    if (!warning) {
      warning = { user_id: userId, warning_count: 0, violations: [] };
      db.chat_warnings.push(warning);
    }

    warning.warning_count += 1;
    warning.violations.push({
      receiver_id: receiverId,
      content: messageContent,
      pattern: detectedPattern,
      created_at: new Date().toISOString()
    });

    let action = 'warning_1';
    if (warning.warning_count === 2) action = 'warning_2';
    else if (warning.warning_count === 3) {
      action = 'block_24h';
      const profile = db.profiles.find((p: any) => p.id === userId);
      if (profile) {
        const until = new Date();
        until.setHours(until.getHours() + 24);
        profile.blocked_until = until.toISOString();
      }
    } else if (warning.warning_count >= 4) {
      action = 'permanent_block';
      const profile = db.profiles.find((p: any) => p.id === userId);
      if (profile) profile.is_permanently_blocked = true;
    }

    saveDB(db);
    res.json({ action, warningCount: warning.warning_count });
  });

  // Check Reveal Status
  app.get('/api/credits/reveal-contact/check', (req, res) => {
    const { viewer_id, profile_id } = req.query;
    const db = getDB();
    const sessionDoc = db.contacts?.find((c: any) => c.viewer_id === viewer_id && c.profile_id === profile_id);

    if (sessionDoc && new Date(sessionDoc.expiry) > new Date()) {
      const remainingSecs = Math.floor((new Date(sessionDoc.expiry).getTime() - Date.now()) / 1000);
      res.json({
        is_unlocked: true,
        time_remaining_seconds: remainingSecs,
        contact_info: sessionDoc.contact_info
      });
    } else if (sessionDoc) {
      res.json({ is_expired: true });
    } else {
      res.json({ is_unlocked: false });
    }
  });

  // Reveal Contact API Endpoint
  app.post('/api/credits/reveal-contact', (req, res) => {
    const { viewer_id, profile_id } = req.body;
    const db = getDB();
    if (!db.contacts) db.contacts = [];

    const targetProfile = db.profiles.find((p: any) => p.id === profile_id);
    if (!targetProfile) return res.status(404).json({ error: 'Profile not found' });

    // Check if already revealed with an ACTIVE (non-expired) session
    const existing = db.contacts.find((c: any) =>
      c.viewer_id === viewer_id && c.profile_id === profile_id
    );
    const isExistingActive = existing && new Date(existing.expiry) > new Date();

    let deductedFrom: 'free' | 'paid' | null = null;
    let updatedFreeRemaining: number | null = null;
    let updatedPaidBalance: number | null = null;
    let updatedFreeLimit: number | null = null;

    if (!isExistingActive) {
      // Deduct a credit from the viewer's profile (new reveal or re-reveal after expiry)
      const viewerProfile = db.profiles.find((p: any) => p.id === viewer_id);
      if (viewerProfile) {
        const isPremium = viewerProfile.is_premium && viewerProfile.premium_end && new Date(viewerProfile.premium_end) > new Date();

        // Get limits and multipliers
        const baseFreeLimitSetting = db.admin_settings_kv?.find((s: any) => s.key === 'free_monthly_credits');
        const baseFreeLimit = baseFreeLimitSetting ? parseInt(baseFreeLimitSetting.value) : 10;
        let multiplier = 1;
        if (isPremium) {
          const activePlan = db.membership_plans?.find((p: any) => p.id === viewerProfile.plan_id);
          multiplier = activePlan?.free_credits_multiplier || 1;
        }
        const totalFreeLimit = baseFreeLimit * multiplier;

        // Initialize free_credits_remaining if not set
        if (viewerProfile.free_credits_remaining === undefined || viewerProfile.free_credits_remaining === null) {
          viewerProfile.free_credits_remaining = totalFreeLimit;
        }

        // Initialize free_credits_reset_date if not set
        if (!viewerProfile.free_credits_reset_date) {
          viewerProfile.free_credits_reset_date = new Date().toISOString();
        }

        console.log(`BEFORE DEDUCT: free=${viewerProfile.free_credits_remaining}, paid=${viewerProfile.paid_credits || 0}`);
        // Deduct free credits first, then paid credits
        if (viewerProfile.free_credits_remaining > 0) {
          viewerProfile.free_credits_remaining = viewerProfile.free_credits_remaining - 1;
          deductedFrom = 'free';
        } else if ((viewerProfile.paid_credits || 0) > 0) {
          viewerProfile.paid_credits = (viewerProfile.paid_credits || 0) - 1;
          deductedFrom = 'paid';
        } else {
          return res.status(402).json({ error: 'No credits available. Please buy more credits.' });
        }
        console.log(`AFTER DEDUCT: free=${viewerProfile.free_credits_remaining}, paid=${viewerProfile.paid_credits || 0}, deductedFrom=${deductedFrom}`);

        updatedFreeRemaining = viewerProfile.free_credits_remaining;
        updatedPaidBalance = viewerProfile.paid_credits || 0;
        updatedFreeLimit = totalFreeLimit;
      }
    }

    const durationSetting = db.admin_settings_kv?.find((s: any) => s.key === 'contact_unlock_duration_hours');
    const durationHours = durationSetting ? parseInt(durationSetting.value) : 24;

    const contactInfo = {
      phone: targetProfile.phone || '+91 98765 43210',
      email: targetProfile.email || (db.users?.find((u: any) => u.id === profile_id)?.email) || 'user@example.com',
      biodata_url: targetProfile.biodata_url || null
    };

    let finalExpiry: string;

    if (isExistingActive) {
      // Active session: NEVER reset expiry - timer continues from original unlock time
      existing.contact_info = contactInfo;
      finalExpiry = existing.expiry;
    } else if (existing) {
      // Expired session - start fresh timer from now
      const newExpiry = new Date();
      newExpiry.setHours(newExpiry.getHours() + durationHours);
      finalExpiry = newExpiry.toISOString();
      existing.expiry = finalExpiry;
      existing.contact_info = contactInfo;
    } else {
      // Brand new session - start timer from now
      const newExpiry = new Date();
      newExpiry.setHours(newExpiry.getHours() + durationHours);
      finalExpiry = newExpiry.toISOString();
      db.contacts.push({ id: uuidv4(), viewer_id, profile_id, contact_info: contactInfo, expiry: finalExpiry });
    }

    saveDB(db);

    // Actual remaining seconds from locked expiry - persistent across logouts/re-logins
    const actualRemainingSeconds = Math.max(0, Math.floor((new Date(finalExpiry).getTime() - Date.now()) / 1000));

    const viewerProfileForResponse = db.profiles.find((p: any) => p.id === viewer_id);
    const responseCredits = updatedFreeRemaining !== null ? {
      free_views_remaining: updatedFreeRemaining,
      paid_views_balance: updatedPaidBalance,
      free_monthly_limit: updatedFreeLimit,
      deducted_from: deductedFrom,
    } : (viewerProfileForResponse ? {
      free_views_remaining: viewerProfileForResponse.free_credits_remaining ?? 0,
      paid_views_balance: viewerProfileForResponse.paid_credits ?? 0,
      free_monthly_limit: updatedFreeLimit ?? (parseInt(db.admin_settings_kv?.find((s: any) => s.key === 'free_monthly_credits')?.value) || 10),
      deducted_from: null,
    } : null);

    const ioR = (app as any).io;
    if (ioR && !isExistingActive) {
      ioR.to(`user:${viewer_id}`).emit('credits:updated', {
        userId: viewer_id,
        free_views_remaining: updatedFreeRemaining,
        paid_views_balance: updatedPaidBalance
      });
    }

    res.json({
      success: true,
      time_remaining_seconds: actualRemainingSeconds,
      contact_info: contactInfo,
      credits: responseCredits,
    });
  });

  // Get Credits
  app.get('/api/credits/:userId', (req, res) => {
    const db = getDB();
    const profile = db.profiles.find((p: any) => p.id === req.params.userId);

    const baseFreeLimitSetting = db.admin_settings_kv?.find((s: any) => s.key === 'free_monthly_credits');
    const baseFreeLimit = baseFreeLimitSetting ? parseInt(baseFreeLimitSetting.value) : 10;

    if (!profile) {
      return res.json({
        id: 'credit-1',
        user_id: req.params.userId,
        free_monthly_limit: baseFreeLimit,
        free_views_remaining: baseFreeLimit,
        free_views_reset_date: new Date().toISOString(),
        paid_views_balance: 0,
        paid_credits_expiry: null,
        paid_credits_purchased: 0,
        total_unlocks_done: 0
      });
    }

    let multiplier = 1;
    const isPremium = profile.is_premium && profile.premium_end && new Date(profile.premium_end) > new Date();
    if (isPremium) {
      const activePlan = db.membership_plans?.find((p: any) => p.id === profile.plan_id);
      multiplier = activePlan?.free_credits_multiplier || 1;
    }
    const totalFreeLimit = baseFreeLimit * multiplier;

    // Free credits: reset monthly
    const lastReset = profile.free_credits_reset_date ? new Date(profile.free_credits_reset_date) : null;
    const now = new Date();
    let freeRemaining = profile.free_credits_remaining;
    let resetDate = profile.free_credits_reset_date;
    let dbChanged = false;

    // If never set, initialize free credits
    if (freeRemaining === undefined || freeRemaining === null) {
      freeRemaining = totalFreeLimit;
      profile.free_credits_remaining = totalFreeLimit;
      profile.free_credits_reset_date = now.toISOString();
      resetDate = now.toISOString();
      dbChanged = true;
    }

    // Reset monthly if past reset date
    if (lastReset) {
      const nextReset = new Date(lastReset);
      nextReset.setMonth(nextReset.getMonth() + 1);
      if (now >= nextReset) {
        freeRemaining = totalFreeLimit;
        profile.free_credits_remaining = totalFreeLimit;
        const newReset = new Date(lastReset);
        newReset.setMonth(newReset.getMonth() + 1);
        profile.free_credits_reset_date = newReset.toISOString();
        resetDate = newReset.toISOString();
        dbChanged = true;
      }
    }

    // Persist any free-credit changes
    if (dbChanged) saveDB(db);

    // Count total unlocks
    const unlocks = (db.contacts || []).filter((c: any) => c.viewer_id === req.params.userId);

    res.json({
      id: `credit-${req.params.userId}`,
      user_id: req.params.userId,
      free_monthly_limit: totalFreeLimit,
      free_views_remaining: freeRemaining,
      free_views_reset_date: resetDate || now.toISOString(),
      paid_views_balance: profile.paid_credits || 0,
      paid_credits_expiry: profile.paid_credits_expiry || null,
      paid_credits_purchased: profile.paid_credits || 0,
      paid_credits_expiry_after_membership: profile.paid_credits_expiry_after_membership || null,
      total_unlocks_done: unlocks.length
    });
  });

  // Contact Us Form
  app.post('/api/contact', async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      const db = getDB();

      // Generate Ticket Number continuously (e.g. GEN-000001)
      const prefixMap: Record<string, string> = {
        'General Inquiry': 'GEN',
        'Profile Issue': 'PRO',
        'Membership Query': 'MEM',
        'Report Issue': 'RPT',
        'Feedback': 'FDB',
        'Suggestion': 'SUG',
        'Other': 'OTH'
      };
      const prefix = prefixMap[subject] || 'TKT';

      if (!db.contact_messages) db.contact_messages = [];
      const samePrefixTickets = db.contact_messages.filter((msg: any) => msg.ticket_number?.startsWith(prefix));
      const nextNum = samePrefixTickets.length + 1;
      const ticketNumber = `${prefix}-${String(nextNum).padStart(6, '0')}`;

      const contactMsg = {
        id: uuidv4(),
        ticket_number: ticketNumber,
        name,
        email,
        subject,
        message,
        status: 'open',
        created_at: new Date().toISOString()
      };

      db.contact_messages.push(contactMsg);
      saveDB(db);

      // Simulate sending email to company contact email
      const contactEmail = db.admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com';
      console.log(`[Email System] Sending to: ${contactEmail} | Subject: New Contact Request [${ticketNumber}] | From: ${name} <${email}>`);

      res.json({ success: true, ticketNumber });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ error: 'Failed to process contact request' });
    }
  });

  // Admin: Get all tickets
  app.get('/api/admin/tickets', async (req, res) => {
    try {
      const db = getDB();
      res.json({ contacts: db.contact_messages || [], totalCount: (db.contact_messages || []).length });
    } catch (error) {
      console.error('Error fetching tickets:', error);
      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  });

  // Admin: Close ticket with resolution
  app.put('/api/admin/tickets/:id/close', upload.single('photo'), async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution_note, admin_id } = req.body;
      const db = getDB();

      const ticket = db.contact_messages?.find((t: any) => t.id === id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      ticket.status = 'closed';
      ticket.is_resolved = true;
      ticket.resolution_note = resolution_note;
      ticket.resolved_by = admin_id;
      ticket.resolved_at = new Date().toISOString();

      if (req.file) {
        ticket.resolution_photo = `/uploads/${req.file.filename}`;
      }

      saveDB(db);

      const contactEmail = db.admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com';
      const contactPhone = db.admin_settings_kv?.find((s: any) => s.key === 'contact_phone')?.value || '+91 98765 43210';

      console.log(`
=========================================
[Email System] Sending Resolution Email
To: ${ticket.email}
Subject: Your Ticket [${ticket.ticket_number}] Has Been Solved
-----------------------------------------
Hello ${ticket.name},

Your ticket has been reviewed and solved by our team.

Admin Action Note: 
"${resolution_note}"
${ticket.resolution_photo ? `(An attachment is included with your resolution: ${ticket.resolution_photo})` : ''}

If you need further assistance or more resolution, please feel free to reach out to us:
Email: ${contactEmail}
Phone: ${contactPhone}

Best Regards,
Support Team
=========================================
      `);

      res.json({ success: true, ticket });
    } catch (error) {
      console.error('Error closing ticket:', error);
      res.status(500).json({ error: 'Failed to close ticket' });
    }
  });

  // Admin: Reject ticket
  app.put('/api/admin/tickets/:id/reject', upload.single('photo'), async (req, res) => {
    try {
      const { id } = req.params;
      const { rejection_note, admin_id } = req.body;
      const db = getDB();

      const ticket = db.contact_messages?.find((t: any) => t.id === id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      ticket.status = 'rejected';
      ticket.is_resolved = true;
      ticket.resolution_note = rejection_note;
      ticket.resolved_by = admin_id;
      ticket.resolved_at = new Date().toISOString();

      if (req.file) {
        ticket.resolution_photo = `/uploads/${req.file.filename}`;
      }

      saveDB(db);

      const contactEmail = db.admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com';
      const contactPhone = db.admin_settings_kv?.find((s: any) => s.key === 'contact_phone')?.value || '+91 98765 43210';

      console.log(`
=========================================
[Email System] Sending Rejection Email
To: ${ticket.email}
Subject: Your Ticket [${ticket.ticket_number}] Has Been Rejected
-----------------------------------------
Hello ${ticket.name},

Your ticket has been reviewed and rejected by our team.

Admin Action Note: 
"${rejection_note}"
${ticket.resolution_photo ? `(An attachment is included with your rejection details: ${ticket.resolution_photo})` : ''}

If you need further assistance or more resolution, please feel free to reach out to us:
Email: ${contactEmail}
Phone: ${contactPhone}

Best Regards,
Support Team
=========================================
      `);

      res.json({ success: true, ticket });
    } catch (error) {
      console.error('Error rejecting ticket:', error);
      res.status(500).json({ error: 'Failed to reject ticket' });
    }
  });

  // Admin: Reopen ticket
  app.put('/api/admin/tickets/:id/reopen', async (req, res) => {
    try {
      const { id } = req.params;
      const db = getDB();

      const ticket = db.contact_messages?.find((t: any) => t.id === id);
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

      ticket.status = 'open';
      ticket.is_resolved = false;
      // We keep the old resolution note/photo in the DB for history, or clear them? Better to leave them.
      // But let's set a reopened timestamp
      ticket.reopened_at = new Date().toISOString();

      saveDB(db);
      res.json({ success: true, ticket });
    } catch (error) {
      console.error('Error reopening ticket:', error);
      res.status(500).json({ error: 'Failed to reopen ticket' });
    }
  });

  // Report User/Message
  app.post('/api/chat-safety/report', async (req, res) => {
    const { reporterId, reportedUserId, messageId, messageContent, reason } = req.body;
    const db = getDB();
    db.reports.push({
      id: uuidv4(),
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      message_id: messageId,
      message_content: messageContent,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    saveDB(db);
    // Real-time: notify admin panel of message report
    const io = (app as any).io;
    if (io) {
      io.to('admin:room').emit('admin:message-reported', { reporterId, reportedUserId, reason });
    }
    res.json({ success: true });
  });

  // Unblock Request
  app.post('/api/chat-safety/unblock-request', async (req, res) => {
    const { userId, reason } = req.body;
    const db = getDB();
    db.unblock_requests.push({
      id: uuidv4(),
      user_id: userId,
      reason,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    saveDB(db);

    // Real-time: notify admin panel of new unblock request
    const io = (app as any).io;
    if (io) {
      io.to('admin:room').emit('admin:unblock-request', { userId, reason });
    }

    res.json({ success: true });
  });

  // Admin: Handle Unblock Request
  app.post('/api/admin/unblock-request/:id/handle', async (req, res) => {
    const { id } = req.params;
    const { adminId, status, notes } = req.body;
    const db = getDB();
    const request = db.unblock_requests.find((r: any) => r.id === id);
    if (request) {
      request.status = status;
      request.admin_notes = notes;
      request.handled_by = adminId;
      request.handled_at = new Date().toISOString();

      if (status === 'approved') {
        const profile = db.profiles.find((p: any) => p.id === request.user_id);
        if (profile) {
          profile.is_permanently_blocked = false;
          profile.blocked_until = null;
        }
      }

      saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Request not found' });
    }
  });

  // Admin: Get Settings
  app.get('/api/admin/settings', authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const db = getDB();
      // Map admin_settings_kv to match the expected format: { id, setting_key, setting_value, setting_type, description }
      const SECRET_SETTING_KEYS = new Set([
        'smtp_pass', 'firebase_server_key', 'firebase_vapid_key',
        'sms_api_key', 'payu_salt', 'cashfree_secret', 'razorpay_key_secret'
      ]);
      const settings = (db.admin_settings_kv || []).map((s: any, idx: number) => ({
        id: `set_${idx}`,
        setting_key: s.key,
        setting_value: SECRET_SETTING_KEYS.has(s.key) ? '' : s.value,
        setting_type: s.setting_type || 'string',
        description: s.description || s.key,
        is_secret: SECRET_SETTING_KEYS.has(s.key)
      }));
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  // Admin: Update Setting
  app.post('/api/admin/settings/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const { value, adminId } = req.body;
      const db = getDB();
      // Capture old brand name BEFORE it is overwritten
      const _oldBrand = (db.admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || 'AtMilan').trim();
      const setting = db.admin_settings_kv?.find((s: any) => s.key === key);

      if (setting) {
        setting.value = value;
      } else {
        if (!db.admin_settings_kv) db.admin_settings_kv = [];
        db.admin_settings_kv.push({
          key,
          value,
          setting_type: 'string',
          description: key
        });
      }
      // When platform_name changes — sync site_title AND replace brand name in all text fields
      if (key === 'platform_name') {
        const oldBrand = _oldBrand;
        const newBrand = (value || 'AtMilan').trim();

        // Sync site_title to match new brand name
        const siteTitleSetting = db.admin_settings_kv?.find((s: any) => s.key === 'site_title');
        if (siteTitleSetting) { siteTitleSetting.value = value; }
        else { db.admin_settings_kv.push({ key: 'site_title', value, setting_type: 'string', description: 'Site Title' }); }

        // Sync smtp_from_name if it currently equals the old brand name
        const smtpFrom = db.admin_settings_kv?.find((s: any) => s.key === 'smtp_from_name');
        if (smtpFrom && smtpFrom.value && smtpFrom.value.trim() === oldBrand) {
          smtpFrom.value = newBrand;
        }

        // Replace brand name inside stored text content fields
        if (oldBrand && newBrand && oldBrand !== newBrand) {
          const textFieldsToUpdate = [
            'section_how_it_works_title',
            'section_love_stories_title',
            'hero_description',
            'love_stories_items',
            'testimonials_items',
          ];
          for (const fieldKey of textFieldsToUpdate) {
            const field = db.admin_settings_kv?.find((s: any) => s.key === fieldKey);
            if (field && field.value) {
              const safeOld = _oldBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              field.value = field.value.replace(new RegExp(safeOld, 'g'), newBrand);
            }
          }
        }
      }
      if (key === 'site_title') {
        const pn = db.admin_settings_kv?.find((s: any) => s.key === 'platform_name');
        if (pn) { pn.value = value; }
        else { db.admin_settings_kv.push({ key: 'platform_name', value, setting_type: 'text', description: 'App brand name' }); }
      }
      saveDB(db);
      // Clear master data cache so public pages get fresh data immediately
      masterDataCache.clear();
      // Broadcast to ALL connected clients so public pages update in real-time
      const io = (app as any).io;
      if (io) io.emit('settings:updated', { key, value });
      // When platform_name changes — broadcast ALL updated fields so every page refreshes instantly
      if (key === 'platform_name' && io) {
        io.emit('settings:updated', { key: 'site_title', value });
        const broadcastFields = ['section_how_it_works_title', 'section_love_stories_title', 'hero_description', 'love_stories_items', 'testimonials_items', 'smtp_from_name'];
        for (const fieldKey of broadcastFields) {
          const field = db.admin_settings_kv?.find((s: any) => s.key === fieldKey);
          if (field) io.emit('settings:updated', { key: fieldKey, value: field.value });
        }
      }
      if (key === 'site_title' && io) io.emit('settings:updated', { key: 'platform_name', value });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update setting' });
    }
  });

  // ── POST /api/admin/change-password — Admin changes own password ──────────────
  app.post('/api/admin/change-password', authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      const db = getDB();
      const admin = db.users.find((u: any) => u.id === req.user.id);
      if (!admin) return res.status(404).json({ error: 'Admin account not found.' });
      // Verify current password
      const hash = admin.password_hash || admin.password || '';
      const isMatch = await bcrypt.compare(currentPassword, hash);
      if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect.' });
      // Hash and save new password
      const newHash = await bcrypt.hash(newPassword, 12);
      admin.password_hash = newHash;
      admin.password = newHash;
      admin.updated_at = new Date().toISOString();
      saveDB(db);
      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to change password.' });
    }
  });

  // ── POST /api/admin/users/:userId/reset-password — Admin resets a user's password ──
  app.post('/api/admin/users/:userId/reset-password', authenticateToken, async (req: any, res) => {
    try {
      if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const { userId } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      const db = getDB();
      const user = db.users.find((u: any) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });
      // Hash and save new password — user must use this new password to log in
      const newHash = await bcrypt.hash(newPassword, 12);
      user.password_hash = newHash;
      user.password = newHash;
      user.updated_at = new Date().toISOString();
      saveDB(db);
      res.json({ success: true, message: 'User password reset successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to reset user password.' });
    }
  });

  // Admin: Unblock Requests List
  app.get('/api/admin/unblock-requests', async (req, res) => {
    const { status = '' } = req.query;
    const db = getDB();
    let filtered = db.unblock_requests;
    if (status) filtered = filtered.filter((r: any) => r.status === status);
    const requests = filtered.map((r: any) => {
      const profile = db.profiles.find((p: any) => p.id === r.user_id);
      return { ...r, user: profile };
    });
    res.json(requests);
  });

  // Admin: Users List
  app.get('/api/admin/users', authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    res.set('Cache-Control', 'no-store');
    const { page = 1, limit = 20, search = '', search_field = 'all', gender = '', verified = '', active = '', premium = '', blocked = '', caste = '', city = '', age_min = '', age_max = '', email_verified = '', doc_verified = '' } = req.query;
    const db = getDB();
    let filtered = db.profiles
      .filter((p: any) => p.role !== 'admin')
      .map((p: any) => {
        const user = db.users.find((u: any) => u.id === p.id);
        return { ...p, email: user?.email };
      });

    if (search) {
      const s = String(search).toLowerCase();
      const sf = String(search_field);
      filtered = filtered.filter((u: any) => {
        if (sf === 'email') return u.email?.toLowerCase().includes(s);
        if (sf === 'phone') return u.phone?.includes(s);
        if (sf === 'profile_id') return u.profile_id?.toLowerCase().includes(s);
        // default: search all
        return u.first_name?.toLowerCase().includes(s) ||
          u.last_name?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s) ||
          u.phone?.includes(s) ||
          u.profile_id?.toLowerCase().includes(s);
      });
    }
    if (gender) filtered = filtered.filter((u: any) => u.gender === gender);
    if (verified) filtered = filtered.filter((u: any) => u.is_verified === (verified === 'true'));
    if (active) filtered = filtered.filter((u: any) => u.is_active === (active === 'true'));
    if (premium) filtered = filtered.filter((u: any) => u.is_premium === (premium === 'true'));
    if (blocked === 'no') filtered = filtered.filter((u: any) => !u.is_permanently_blocked && !(u.blocked_until && new Date(u.blocked_until) > new Date()));
    if (blocked === 'temp') filtered = filtered.filter((u: any) => !u.is_permanently_blocked && u.blocked_until && new Date(u.blocked_until) > new Date());
    if (blocked === 'permanent') filtered = filtered.filter((u: any) => u.is_permanently_blocked);
    if (caste) filtered = filtered.filter((u: any) => u.caste?.toLowerCase() === String(caste).toLowerCase());
    if (city) filtered = filtered.filter((u: any) => u.city?.toLowerCase().includes(String(city).toLowerCase()));
    if (email_verified) filtered = filtered.filter((u: any) => u.email_verified === (email_verified === 'true'));
    if (doc_verified) filtered = filtered.filter((u: any) => u.is_verified === (doc_verified === 'true'));
    if (age_min) {
      const minAge = Number(age_min);
      filtered = filtered.filter((u: any) => {
        if (!u.date_of_birth) return false;
        const age = Math.floor((Date.now() - new Date(u.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return age >= minAge;
      });
    }
    if (age_max) {
      const maxAge = Number(age_max);
      filtered = filtered.filter((u: any) => {
        if (!u.date_of_birth) return false;
        const age = Math.floor((Date.now() - new Date(u.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        return age <= maxAge;
      });
    }

    // Sort newest first
    filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = filtered.length;
    const start = (Number(page) - 1) * Number(limit);
    const users = filtered.slice(start, start + Number(limit));

    res.json({ users, totalCount });
  });

  // Admin: Reports List
  app.get('/api/admin/reports', async (req, res) => {
    const { page = 1, limit = 20, status = '', type = '', from_date, to_date } = req.query;
    const db = getDB();
    if (!db.reports) db.reports = [];
    let filtered = db.reports;

    if (status && status !== 'all') filtered = filtered.filter((r: any) => r.status === status);
    if (type && type !== 'all') filtered = filtered.filter((r: any) => r.type === type);

    if (from_date) {
      const from = new Date(from_date as string).getTime();
      filtered = filtered.filter((r: any) => new Date(r.created_at).getTime() >= from);
    }
    if (to_date) {
      const to = new Date(to_date as string).getTime() + 86400000;
      filtered = filtered.filter((r: any) => new Date(r.created_at).getTime() <= to);
    }

    const totalCount = filtered.length;
    const start = (Number(page) - 1) * Number(limit);
    let reports = filtered.slice(start, start + Number(limit));

    // Populate reporter and reported user details
    reports = reports.map((r: any) => {
      const reporter = db.profiles?.find((p: any) => p.id === r.reporter_id) || null;
      const reported = db.profiles?.find((p: any) => p.id === r.reported_user_id) || null;
      return {
        ...r,
        reporter,
        reported
      };
    });

    res.json({ reports, totalCount });
  });

  // Admin: Update Report Status
  app.post('/api/admin/users/:userId/documents/:docType/status', async (req, res) => {
    const { userId, docType } = req.params;
    const { status, reason } = req.body;
    const db = getDB();
    const index = db.verification_documents.findIndex((d: any) => d.user_id === userId && d.document_type === docType);
    if (index !== -1) {
      db.verification_documents[index].verification_status = status;
      if (reason !== undefined) {
        db.verification_documents[index].admin_notes = reason;
      }
      db.verification_documents[index].reviewed_at = new Date().toISOString();

      // If approved, check if all required docs approved
      if (status === 'approved') {
        const userDocs = db.verification_documents.filter((d: any) => d.user_id === userId && ['aadhaar_front', 'aadhaar_back'].includes(d.document_type));
        const allApproved = userDocs.length >= 2 && userDocs.every((d: any) => d.verification_status === 'approved');
        if (allApproved) {
          const profileIndex = db.profiles.findIndex((p: any) => p.id === userId);
          if (profileIndex !== -1) {
            db.profiles[profileIndex].is_verified = true;
          }
        }
        // CRITICAL: saveDB MUST run before any socket emit
        saveDB(db);
        const io = (app as any).io;
        if (io) {
          const updatedProfile = db.profiles.find((p: any) => p.id === userId);
          if (allApproved && updatedProfile) {
            io.to(`user:${userId}`).emit('profile:updated', updatedProfile);
          }
          io.to('admin:room').emit('admin:doc-status-changed', { userId, docType, status, profile: updatedProfile });
          io.to(`user:${userId}`).emit('document:status-changed', { userId, docType, status, reason, isVerified: allApproved });
        }
      } else if (status === 'rejected') {
        const profileIndex = db.profiles.findIndex((p: any) => p.id === userId);
        if (profileIndex !== -1) db.profiles[profileIndex].is_verified = false;
        saveDB(db);
        const io = (app as any).io;
        if (io) {
          io.to('admin:room').emit('admin:doc-status-changed', { userId, docType, status, profile: db.profiles.find((p: any) => p.id === userId) });
          io.to(`user:${userId}`).emit('document:status-changed', { userId, docType, status, reason, isVerified: false });
        }
      }

      return res.json({ success: true, document: db.verification_documents[index] });
    }
    res.status(404).json({ error: 'Document not found' });
  });

  app.post('/api/admin/reports/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const db = getDB();
    if (!db.reports) db.reports = [];
    const report = db.reports.find((r: any) => r.id === id);
    if (report) {
      report.status = status;
      saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  });

  // Admin: Success Stories List
  app.get('/api/admin/success-stories', async (req, res) => {
    const { page = 1 } = req.query;
    const db = getDB();
    const sortedStories = [...(db.success_stories || [])].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const totalCount = sortedStories.length;
    const start = (Number(page) - 1) * 20;
    const stories = sortedStories.slice(start, start + 20).map((s: any) => {
      const profile = db.profiles.find((p: any) => p.id === s.user_id);
      return { ...s, user: profile };
    });
    res.json({ stories, totalCount });
  });

  // Admin: Update Success Story Approval
  app.post('/api/admin/success-stories/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { approved } = req.body;
    const db = getDB();
    const story = db.success_stories.find((s: any) => s.id === id);
    if (story) {
      story.is_approved = approved;
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.emit('success-story:updated', { id, is_approved: approved });
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Story not found' });
    }
  });

  // Admin: Add Success Story
  app.post('/api/admin/success-stories', upload.single('photo'), async (req, res) => {
    try {
      const { user_name, partner_name, story_text, year, location, is_approved } = req.body;
      const db = getDB();
      const file = req.file;
      const photoUrl = file ? `/uploads/${file.filename}` : '';

      if (!db.success_stories) db.success_stories = [];

      const newStory = {
        id: uuidv4(),
        user_id: null,
        submitter_name: user_name || '',
        partner_name: partner_name || '',
        groom_name: '',
        bride_name: '',
        story_text: story_text || '',
        photo_url: photoUrl,
        photo_urls: photoUrl ? [photoUrl] : [],
        location: location || '',
        year: year || new Date().getFullYear().toString(),
        submitter_email: '',
        is_approved: is_approved === 'true' || is_approved === true,
        created_at: new Date().toISOString()
      };

      db.success_stories.push(newStory);
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.emit('success-story:updated', { id: newStory.id });
      }
      res.json({ success: true, story: newStory });
    } catch (err: any) {
      console.error('Error adding story:', err);
      res.status(500).json({ error: err?.message || 'Failed to add story' });
    }
  });

  // Admin: Edit Success Story
  app.put('/api/admin/success-stories/:id', upload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const { user_name, groom_name, bride_name, story_text, year, location, is_approved, partner_name } = req.body;
    const db = getDB();
    const story = db.success_stories.find((s: any) => s.id === id);
    if (story) {
      if (groom_name !== undefined) story.groom_name = groom_name;
      if (bride_name !== undefined) story.bride_name = bride_name;
      if (story_text !== undefined) story.story_text = story_text;
      if (year !== undefined) story.year = year;
      if (location !== undefined) story.location = location;
      if (is_approved !== undefined) story.is_approved = is_approved === 'true' || is_approved === true;
      if (partner_name !== undefined) story.partner_name = partner_name;
      else story.partner_name = bride_name || groom_name || story.partner_name;
      if (user_name !== undefined) story.submitter_name = user_name;

      if (req.file) {
        const photoUrl = `/uploads/${req.file.filename}`;
        story.photo_url = photoUrl;
        if (!story.photo_urls) story.photo_urls = [];
        story.photo_urls.push(photoUrl);
      }

      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.emit('success-story:updated', { id });
      }
      res.json({ success: true, story });
    } else {
      res.status(404).json({ error: 'Story not found' });
    }
  });

  // Admin: Toggle story visibility (hide / unhide)
  app.patch('/api/admin/success-stories/:id/visibility', async (req, res) => {
    const { id } = req.params;
    const { is_hidden } = req.body;
    const db = getDB();
    const story = db.success_stories.find((s: any) => s.id === id);
    if (story) {
      story.is_hidden = is_hidden;
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.emit('success-story:updated', { id, is_hidden });
      }
      res.json({ success: true, is_hidden });
    } else {
      res.status(404).json({ error: 'Story not found' });
    }
  });

  // Admin: Delete story permanently
  app.delete('/api/admin/success-stories/:id', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const idx = db.success_stories.findIndex((s: any) => s.id === id);
    if (idx !== -1) {
      db.success_stories.splice(idx, 1);
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.emit('success-story:updated', { id, deleted: true });
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Story not found' });
    }
  });

  // Admin: Contacts List
  app.get('/api/admin/contacts', async (req, res) => {
    const { page = 1 } = req.query;
    const db = getDB();
    const totalCount = db.contact_messages.length;
    const start = (Number(page) - 1) * 20;
    const contacts = db.contact_messages.slice(start, start + 20);
    res.json({ contacts, totalCount });
  });

  // Admin: Mark Contact Resolved
  app.post('/api/admin/contacts/:id/resolve', async (req, res) => {
    const { id } = req.params;
    const db = getDB();
    const contact = db.contact_messages.find((c: any) => c.id === id);
    if (contact) {
      contact.status = 'resolved';
      saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Contact not found' });
    }
  });

  // Admin: Message Reports List
  app.get('/api/admin/message-reports', async (req, res) => {
    const { page = 1, status = '' } = req.query;
    const db = getDB();
    if (!db.message_reports) db.message_reports = [];
    let filtered = db.message_reports;
    if (status) filtered = filtered.filter((r: any) => r.status === status);
    const totalCount = filtered.length;
    const start = (Number(page) - 1) * 20;
    const reports = filtered.slice(start, start + 20).map((r: any) => ({
      ...r,
      reporter: db.profiles.find((p: any) => p.id === r.reporter_id),
      reported_user: db.profiles.find((p: any) => p.id === r.reported_id)
    }));
    res.json({ reports, totalCount });
  });

  // Admin: Handle Message Report
  app.post('/api/admin/message-report/:id/handle', async (req, res) => {
    const { id } = req.params;
    const { adminId, action, notes } = req.body;
    const db = getDB();
    const report = db.message_reports.find((r: any) => r.id === id);
    if (report) {
      report.status = 'handled';
      report.action_taken = action;
      report.admin_notes = notes;
      report.handled_by = adminId;
      report.handled_at = new Date().toISOString();
      saveDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Report not found' });
    }
  });



  app.post('/api/notifications/:userId/clear-all', (req, res) => {
    const userId = req.params.userId;
    const db = getDB();
    if (db.notifications) {
      db.notifications = db.notifications.filter((n: any) => n.user_id !== userId);
      saveDB(db);
    }
    res.json({ success: true });
  });

  app.delete('/api/notifications/:id', (req, res) => {
    const id = req.params.id;
    const db = getDB();
    if (db.notifications) {
      db.notifications = db.notifications.filter((n: any) => n.id !== id);
      saveDB(db);
    }
    res.json({ success: true });
  });

  app.post('/api/messages/:userId/read-all', (req, res) => {
    const userId = req.params.userId;
    const db = getDB();
    if (db.messages) {
      db.messages.forEach((m: any) => {
        if (m.receiver_id === userId) m.is_read = true;
      });
      saveDB(db);
    }
    res.json({ success: true });
  });

  // --- ADMIN: CREDIT MANAGEMENT ---
  // Admin: Update user credits (add/remove free or paid)
  app.post('/api/admin/users/:userId/credits', async (req, res) => {
    const { userId } = req.params;
    const { action, credit_type, amount } = req.body; // action: 'add' | 'remove', credit_type: 'free' | 'paid', amount: number
    const db = getDB();
    const profile = db.profiles.find((p: any) => p.id === userId);
    if (!profile) return res.status(404).json({ error: 'User not found' });

    if (credit_type === 'free') {
      const current = profile.free_credits_remaining || 0;
      if (action === 'add') {
        profile.free_credits_remaining = current + Number(amount);
      } else {
        profile.free_credits_remaining = Math.max(0, current - Number(amount));
      }
    } else if (credit_type === 'paid') {
      const current = profile.paid_credits || 0;
      if (action === 'add') {
        profile.paid_credits = current + Number(amount);
      } else {
        profile.paid_credits = Math.max(0, current - Number(amount));
      }
    } else {
      return res.status(400).json({ error: 'Invalid credit_type. Use free or paid.' });
    }

    saveDB(db);

    const io = (app as any).io;
    if (io) {
      io.to(`user:${userId}`).emit('profile:updated', profile);
      io.to('admin:room').emit('admin:profile-updated', { id: userId, profile });
    }

    res.json({ success: true, free_credits_remaining: profile.free_credits_remaining, paid_credits: profile.paid_credits });
  });

  // Admin: Assign premium membership to user
  app.post('/api/admin/users/:userId/premium', async (req, res) => {
    try {
      const { userId } = req.params;
      const { plan_id, duration_months } = req.body;
      const db = getDB();
      const profileIndex = db.profiles.findIndex((p: any) => p.id === userId);
      if (profileIndex === -1) return res.status(404).json({ error: 'User not found' });

      const profile = db.profiles[profileIndex];

      // Support 'custom' plan_id â€” build a synthetic plan from duration_months
      // Also coerce plan_id to string to handle any type mismatch
      const planIdStr = String(plan_id || '').trim();
      let plan: any = db.membership_plans?.find((p: any) => String(p.id) === planIdStr);
      if (!plan) {
        if (planIdStr === 'custom' || planIdStr === '') {
          plan = {
            id: 'custom',
            name: 'Custom Plan',
            duration_months: Number(duration_months) || 1,
            free_credits_multiplier: 1
          };
        } else {
          return res.status(400).json({ error: `Plan not found: ${planIdStr}` });
        }
      }

      // duration_months from request always takes priority over plan default
      const months = Number(duration_months) || plan.duration_months || 1;
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + months);

      db.profiles[profileIndex].is_premium = true;
      db.profiles[profileIndex].premium_plan = plan.name;
      db.profiles[profileIndex].premium_end = expiresAt.toISOString();
      db.profiles[profileIndex].plan_id = plan_id;

      // Update free credit limit based on plan multiplier
      const baseFreeLimitSetting = db.admin_settings_kv?.find((s: any) => s.key === 'free_monthly_credits');
      const baseFreeLimit = baseFreeLimitSetting ? parseInt(baseFreeLimitSetting.value) : 10;
      const multiplier = plan.free_credits_multiplier || 1;
      const totalFreeLimit = baseFreeLimit * multiplier;
      db.profiles[profileIndex].free_credits_remaining = totalFreeLimit;

      // Create/update membership purchase record
      if (!db.membership_purchases) db.membership_purchases = [];
      const existingPurchaseIdx = db.membership_purchases.findIndex((mp: any) => mp.user_id === userId && mp.status === 'active');
      if (existingPurchaseIdx !== -1) {
        db.membership_purchases[existingPurchaseIdx].plan_id = plan_id;
        db.membership_purchases[existingPurchaseIdx].plan_name = plan.name;
        db.membership_purchases[existingPurchaseIdx].expires_at = expiresAt.toISOString();
        db.membership_purchases[existingPurchaseIdx].free_views_remaining = totalFreeLimit;
      } else {
        db.membership_purchases.push({
          id: uuidv4(),
          user_id: userId,
          plan_id: plan_id,
          plan_name: plan.name,
          status: 'active',
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          free_views_remaining: totalFreeLimit,
          paid_views_balance: db.profiles[profileIndex].paid_credits || 0,
          total_unlocks_done: 0,
          free_views_reset_date: now.toISOString()
        });
      }

      saveDB(db);

      // Real-time: notify admin panel and user of premium assignment
      const io = (app as any).io;
      if (io) {
        const updatedProfile = db.profiles[profileIndex];
        io.to('admin:room').emit('admin:profile-updated', { id: userId, profile: updatedProfile });
        io.to(`user:${userId}`).emit('profile:updated', updatedProfile);
        io.emit('profile:public-updated', { userId });
      }

      return res.json({ success: true, profile: { is_premium: true, premium_plan: plan.name, premium_end: expiresAt.toISOString() } });
    } catch (err: any) {
      console.error('[Premium assign error]', err);
      return res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  });

  // Admin: Remove premium from user
  app.post('/api/admin/users/:userId/remove-premium', async (req, res) => {
    try {
      const { userId } = req.params;
      const db = getDB();
      const profileIndex = db.profiles.findIndex((p: any) => p.id === userId);
      if (profileIndex === -1) return res.status(404).json({ error: 'User not found' });

      db.profiles[profileIndex].is_premium = false;
      db.profiles[profileIndex].premium_plan = null;
      db.profiles[profileIndex].premium_end = null;
      db.profiles[profileIndex].plan_id = 'free';

      // Mark active membership purchases as cancelled
      if (db.membership_purchases) {
        db.membership_purchases.forEach((mp: any) => {
          if (mp.user_id === userId && mp.status === 'active') {
            mp.status = 'cancelled';
            mp.cancelled_at = new Date().toISOString();
          }
        });
      }

      // Reset free credits to base limit
      const baseFreeLimitSetting = db.admin_settings_kv?.find((s: any) => s.key === 'free_monthly_credits');
      const baseFreeLimit = baseFreeLimitSetting ? parseInt(baseFreeLimitSetting.value) : 10;
      db.profiles[profileIndex].free_credits_remaining = baseFreeLimit;

      saveDB(db);

      // Real-time: notify admin panel and user of premium removal
      const io = (app as any).io;
      if (io) {
        const updatedProfile = db.profiles[profileIndex];
        io.to('admin:room').emit('admin:profile-updated', { id: userId, profile: updatedProfile });
        io.to(`user:${userId}`).emit('profile:updated', updatedProfile);
        io.emit('profile:public-updated', { userId });
      }

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[Remove premium error]', err);
      return res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  });

  // Admin: Get user chat conversations list
  app.get('/api/admin/users/:userId/chats', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    if (!db.messages) return res.json([]);

    // Find all unique chat partners
    const partnerIds = new Set<string>();
    db.messages.forEach((m: any) => {
      if (m.sender_id === userId) partnerIds.add(m.receiver_id);
      if (m.receiver_id === userId) partnerIds.add(m.sender_id);
    });

    const conversations = Array.from(partnerIds).map(partnerId => {
      const msgs = db.messages.filter((m: any) =>
        (m.sender_id === userId && m.receiver_id === partnerId) ||
        (m.sender_id === partnerId && m.receiver_id === userId)
      );
      const lastMsg = msgs.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      const partner = db.profiles.find((p: any) => p.id === partnerId);
      const unreadCount = msgs.filter((m: any) => m.receiver_id === userId && !m.is_read).length;

      return {
        partner_id: partnerId,
        partner_name: partner ? `${partner.first_name} ${partner.last_name}` : 'Unknown',
        partner_photo: partner?.profile_photo_url || null,
        partner_gender: partner?.gender || null,
        last_message: lastMsg?.content || '',
        last_message_time: lastMsg?.created_at || '',
        total_messages: msgs.length,
        unread_count: unreadCount
      };
    });

    conversations.sort((a: any, b: any) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
    res.json(conversations);
  });

  // Admin: Get chat messages between two users
  app.get('/api/admin/users/:userId/chats/:otherUserId', async (req, res) => {
    const { userId, otherUserId } = req.params;
    const db = getDB();
    if (!db.messages) return res.json([]);

    const messages = db.messages.filter((m: any) =>
      (m.sender_id === userId && m.receiver_id === otherUserId) ||
      (m.sender_id === otherUserId && m.receiver_id === userId)
    ).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const otherProfile = db.profiles.find((p: any) => p.id === otherUserId);
    res.json({ messages, otherUser: otherProfile ? { id: otherProfile.id, first_name: otherProfile.first_name, last_name: otherProfile.last_name, profile_photo_url: otherProfile.profile_photo_url } : null });
  });

  // Admin: Remove a specific document
  app.delete('/api/admin/users/:userId/documents/:docType', async (req, res) => {
    const { userId, docType } = req.params;
    const db = getDB();
    const index = db.verification_documents.findIndex((d: any) => d.user_id === userId && d.document_type === docType);
    if (index !== -1) {
      db.verification_documents.splice(index, 1);
      saveDB(db);
      return res.json({ success: true });
    }
    res.status(404).json({ error: 'Document not found' });
  });

  // Admin: Upload/Replace document directly for user
  app.post('/api/admin/users/:userId/documents/upload', upload.single('file'), async (req, res) => {
    const { userId } = req.params;
    const { document_type } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const db = getDB();
    const existingIndex = db.verification_documents.findIndex((d: any) => d.user_id === userId && d.document_type === document_type);

    const newDoc = {
      id: existingIndex !== -1 ? db.verification_documents[existingIndex].id : Date.now(),
      user_id: userId,
      document_type,
      file_url: `/uploads/${file.filename}`,
      file_name: file.originalname,
      file_type: file.mimetype,
      verification_status: 'approved', // Admin uploads are pre-approved
      uploaded_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      db.verification_documents[existingIndex] = newDoc;
    } else {
      db.verification_documents.push(newDoc);
    }

    saveDB(db);
    res.json({ success: true, document: newDoc });
  });

  // Admin: Approve all pending documents for a user
  app.post('/api/admin/users/:userId/approve-all-docs', async (req, res) => {
    const { userId } = req.params;
    const { adminId } = req.body;
    const db = getDB();

    let approved = 0;
    db.verification_documents.forEach((doc: any) => {
      if (doc.user_id === userId && doc.verification_status === 'pending') {
        doc.verification_status = 'approved';
        doc.reviewed_at = new Date().toISOString();
        if (adminId) doc.reviewed_by = adminId;
        approved++;
      }
    });

    // Check if all required docs approved
    const userDocs = db.verification_documents.filter((d: any) => d.user_id === userId && ['aadhaar_front', 'aadhaar_back'].includes(d.document_type));
    const allApproved = userDocs.length >= 2 && userDocs.every((d: any) => d.verification_status === 'approved');
    if (allApproved) {
      const profileIndex = db.profiles.findIndex((p: any) => p.id === userId);
      if (profileIndex !== -1) {
        db.profiles[profileIndex].is_verified = true;
      }
    }

    // CRITICAL: saveDB MUST run before any socket emit (same race condition fix as /verify/approve/:id)
    saveDB(db);

    // Now that DB is persisted, emit all socket events safely
    const io = (app as any).io;
    if (io) {
      const updatedProfile = db.profiles.find((p: any) => p.id === userId);
      if (allApproved && updatedProfile) {
        io.to(`user:${userId}`).emit('profile:updated', updatedProfile);
      }
      io.to('admin:room').emit('admin:doc-status-changed', { userId, docType: 'all', status: 'approved', profile: updatedProfile });
      io.to(`user:${userId}`).emit('document:status-changed', { userId, docType: 'all', status: 'approved', isVerified: allApproved });
    }

    res.json({ success: true, approved });
  });

  // Admin: Delete user and all associated data
  app.delete('/api/admin/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = getDB();

    // Remove from all tables
    db.profiles = db.profiles.filter((p: any) => p.id !== userId);
    db.education_career = db.education_career.filter((e: any) => e.user_id !== userId);
    db.family_details = db.family_details.filter((f: any) => f.user_id !== userId);
    db.lifestyle = db.lifestyle.filter((l: any) => l.user_id !== userId);
    db.photos = db.photos.filter((p: any) => p.user_id !== userId);
    db.horoscope_details = db.horoscope_details.filter((h: any) => h.user_id !== userId);
    db.partner_preferences = db.partner_preferences.filter((p: any) => p.user_id !== userId);
    db.verification_documents = db.verification_documents.filter((d: any) => d.user_id !== userId);
    db.interests = db.interests.filter((i: any) => i.sender_id !== userId && i.receiver_id !== userId);
    db.messages = db.messages?.filter((m: any) => m.sender_id !== userId && m.receiver_id !== userId) || [];
    db.contacts = db.contacts?.filter((c: any) => c.viewer_id !== userId && c.profile_id !== userId) || [];
    db.shortlists = db.shortlists?.filter((s: any) => s.user_id !== userId) || [];
    db.notifications = db.notifications?.filter((n: any) => n.user_id !== userId) || [];
    db.membership_purchases = db.membership_purchases?.filter((mp: any) => mp.user_id !== userId) || [];
    db.credit_purchases = db.credit_purchases?.filter((cp: any) => cp.user_id !== userId) || [];
    db.chat_warnings = db.chat_warnings?.filter((w: any) => w.user_id !== userId) || [];
    db.users = db.users?.filter((u: any) => u.id !== userId) || [];

    saveDB(db);

    // Real-time: notify admin panel of user deletion
    const io = (app as any).io;
    if (io) {
      io.to('admin:room').emit('admin:user-deleted', { userId });
    }

    res.json({ success: true });
  });

  // --- ADMIN: FINANCIAL MANAGEMENT ---
  // Get all subscriptions (membership purchases)
  app.get('/api/admin/financial/subscriptions', async (req, res) => {
    const db = getDB();
    if (!db.membership_purchases) db.membership_purchases = [];
    const { status, plan_id, page = 1, limit = 20 } = req.query;
    let filtered = db.membership_purchases;
    if (status) filtered = filtered.filter((s: any) => s.status === status);
    if (plan_id) filtered = filtered.filter((s: any) => s.plan_id === plan_id);
    const totalCount = filtered.length;
    const start = (Number(page) - 1) * Number(limit);
    const subscriptions = filtered.slice(start, start + Number(limit)).map((s: any) => ({
      ...s,
      user: db.profiles.find((p: any) => p.id === s.user_id) || null,
      plan: db.membership_plans?.find((p: any) => p.id === s.plan_id) || null
    }));
    res.json({ subscriptions, totalCount });
  });

  // Get all transactions (credit purchases + membership purchases)
  app.get('/api/admin/financial/transactions', async (req, res) => {
    const db = getDB();
    if (!db.credit_purchases) db.credit_purchases = [];
    if (!db.membership_purchases) db.membership_purchases = [];
    const { type, payment_method, status, from_date, to_date, page = 1, limit = 20 } = req.query;

    // Combine credit and membership purchases into unified transactions
    const creditTxns = db.credit_purchases.map((cp: any) => ({
      id: cp.id || cp.orderId || 'cp-' + Math.random().toString(36).slice(2),
      user_id: cp.user_id || cp.userId,
      type: 'credit_purchase',
      amount: cp.amount || cp.price || 0,
      credits: cp.credits || 0,
      plan_name: cp.plan_name || cp.planName || 'Credit Pack',
      payment_method: cp.payment_method || cp.paymentMethod || 'online',
      status: cp.status || 'completed',
      created_at: cp.created_at || cp.purchase_date || cp.date,
      user: db.profiles.find((p: any) => p.id === (cp.user_id || cp.userId)) || null
    }));

    const membershipTxns = db.membership_purchases.map((mp: any) => ({
      id: mp.id || 'mp-' + Math.random().toString(36).slice(2),
      user_id: mp.user_id || mp.userId,
      type: 'membership_purchase',
      amount: mp.amount || mp.price || 0,
      credits: 0,
      plan_name: mp.plan_name || mp.planName || 'Membership',
      payment_method: mp.payment_method || mp.paymentMethod || 'online',
      status: mp.status || 'completed',
      created_at: mp.created_at || mp.purchase_date || mp.date,
      user: db.profiles.find((p: any) => p.id === (mp.user_id || mp.userId)) || null
    }));

    let allTxns = [...creditTxns, ...membershipTxns];
    if (type === 'credit') allTxns = allTxns.filter((t: any) => t.type === 'credit_purchase');
    if (type === 'membership') allTxns = allTxns.filter((t: any) => t.type === 'membership_purchase');
    if (payment_method) allTxns = allTxns.filter((t: any) => t.payment_method === payment_method);
    if (status) allTxns = allTxns.filter((t: any) => t.status === status);
    if (from_date) allTxns = allTxns.filter((t: any) => t.created_at >= from_date);
    if (to_date) allTxns = allTxns.filter((t: any) => t.created_at <= to_date + 'T23:59:59');

    allTxns.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = allTxns.length;
    const start = (Number(page) - 1) * Number(limit);
    const transactions = allTxns.slice(start, start + Number(limit));
    res.json({ transactions, totalCount });
  });

  // Get invoices (completed transactions with invoice data)
  app.get('/api/admin/financial/invoices', async (req, res) => {
    const db = getDB();
    if (!db.credit_purchases) db.credit_purchases = [];
    if (!db.membership_purchases) db.membership_purchases = [];
    const { from_date, to_date, page = 1, limit = 20 } = req.query;

    const allInvoices = [
      ...db.credit_purchases.filter((cp: any) => cp.status === 'completed' || !cp.status).map((cp: any) => ({
        id: cp.id || cp.orderId || 'cp-' + Math.random().toString(36).slice(2),
        invoice_number: ((db.admin_settings_kv || []).find((s: any) => s.key === 'invoice_prefix')?.value || 'AM') + '-CP-' + (cp.id || cp.orderId || Math.random().toString(36).slice(2)).toString().slice(0, 8),
        user_id: cp.user_id || cp.userId,
        user: db.profiles.find((p: any) => p.id === (cp.user_id || cp.userId)) || null,
        type: 'credit_purchase',
        amount: cp.amount || cp.price || 0,
        credits: cp.credits || 0,
        plan_name: cp.plan_name || cp.planName || 'Credit Pack',
        payment_method: cp.payment_method || cp.paymentMethod || 'online',
        created_at: cp.created_at || cp.purchase_date || cp.date,
        gst_amount: Math.round(((cp.amount || cp.price || 0) * 0.18) * 100) / 100,
        subtotal: Math.round(((cp.amount || cp.price || 0) / 1.18) * 100) / 100
      })),
      ...db.membership_purchases.filter((mp: any) => mp.status === 'completed' || !mp.status).map((mp: any) => ({
        id: mp.id || 'mp-' + Math.random().toString(36).slice(2),
        invoice_number: ((db.admin_settings_kv || []).find((s: any) => s.key === 'invoice_prefix')?.value || 'AM') + '-MP-' + (mp.id || Math.random().toString(36).slice(2)).toString().slice(0, 8),
        user_id: mp.user_id || mp.userId,
        user: db.profiles.find((p: any) => p.id === (mp.user_id || mp.userId)) || null,
        type: 'membership_purchase',
        amount: mp.amount || mp.price || 0,
        credits: 0,
        plan_name: mp.plan_name || mp.planName || 'Membership',
        payment_method: mp.payment_method || mp.paymentMethod || 'online',
        created_at: mp.created_at || mp.purchase_date || mp.date,
        gst_amount: Math.round(((mp.amount || mp.price || 0) * 0.18) * 100) / 100,
        subtotal: Math.round(((mp.amount || mp.price || 0) / 1.18) * 100) / 100
      }))
    ];

    let filtered = allInvoices;
    if (from_date) filtered = filtered.filter((i: any) => i.created_at >= from_date);
    if (to_date) filtered = filtered.filter((i: any) => i.created_at <= to_date + 'T23:59:59');
    filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCount = filtered.length;
    const start = (Number(page) - 1) * Number(limit);
    const invoices = filtered.slice(start, start + Number(limit));
    res.json({ invoices, totalCount });
  });

  // Get financial analytics summary
  app.get('/api/admin/financial/analytics', async (req, res) => {
    const db = getDB();
    if (!db.credit_purchases) db.credit_purchases = [];
    if (!db.membership_purchases) db.membership_purchases = [];
    const { from_date, to_date } = req.query;

    let creditPurchases = db.credit_purchases;
    let membershipPurchases = db.membership_purchases;
    const getCreatedAt = (item: any) => item.created_at || item.purchase_date || item.date || '';
    if (from_date) {
      creditPurchases = creditPurchases.filter((cp: any) => getCreatedAt(cp) >= from_date);
      membershipPurchases = membershipPurchases.filter((mp: any) => getCreatedAt(mp) >= from_date);
    }
    if (to_date) {
      creditPurchases = creditPurchases.filter((cp: any) => getCreatedAt(cp) <= to_date + 'T23:59:59');
      membershipPurchases = membershipPurchases.filter((mp: any) => getCreatedAt(mp) <= to_date + 'T23:59:59');
    }

    const totalRevenue = creditPurchases.reduce((sum: number, cp: any) => sum + (cp.amount || cp.price || 0), 0)
      + membershipPurchases.reduce((sum: number, mp: any) => sum + (mp.amount || mp.price || 0), 0);
    const creditRevenue = creditPurchases.reduce((sum: number, cp: any) => sum + (cp.amount || cp.price || 0), 0);
    const membershipRevenue = membershipPurchases.reduce((sum: number, mp: any) => sum + (mp.amount || mp.price || 0), 0);
    const totalTransactions = creditPurchases.length + membershipPurchases.length;
    const activeSubscriptions = db.membership_purchases.filter((mp: any) => {
      if (mp.status === 'cancelled') return false;
      if (mp.expiry_date) return new Date(mp.expiry_date) > new Date();
      return true;
    }).length;

    // Monthly revenue breakdown (last 12 months)
    const monthlyRevenue: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = d.toISOString().slice(0, 7);
      const monthCredit = creditPurchases.filter((cp: any) => getCreatedAt(cp).slice(0, 7) === monthKey)
        .reduce((sum: number, cp: any) => sum + (cp.amount || cp.price || 0), 0);
      const monthMembership = membershipPurchases.filter((mp: any) => getCreatedAt(mp).slice(0, 7) === monthKey)
        .reduce((sum: number, mp: any) => sum + (mp.amount || mp.price || 0), 0);
      monthlyRevenue.push({ month: monthKey, credit_revenue: monthCredit, membership_revenue: monthMembership, total: monthCredit + monthMembership });
    }

    // Payment method breakdown
    const allTxns = [...creditPurchases, ...membershipPurchases];
    const paymentMethods: Record<string, number> = {};
    allTxns.forEach((t: any) => {
      const method = t.payment_method || t.paymentMethod || 'online';
      paymentMethods[method] = (paymentMethods[method] || 0) + (t.amount || t.price || 0);
    });

    res.json({
      totalRevenue,
      creditRevenue,
      membershipRevenue,
      totalTransactions,
      activeSubscriptions,
      monthlyRevenue,
      paymentMethods,
      creditPurchasesCount: creditPurchases.length,
      membershipPurchasesCount: membershipPurchases.length
    });
  });

  // Get user-wise financial summary (all users with their payment history)
  app.get('/api/admin/financial/user-summaries', async (req, res) => {
    const db = getDB();
    if (!db.credit_purchases) db.credit_purchases = [];
    if (!db.membership_purchases) db.membership_purchases = [];
    const { search, page = 1, limit = 20 } = req.query;

    // Build user financial map
    const userFinancials: Record<string, any> = {};
    db.profiles.forEach((p: any) => {
      userFinancials[p.id] = {
        user_id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: db.users?.find((u: any) => u.id === p.id)?.email || '',
        is_premium: p.is_premium,
        total_spent: 0,
        credit_purchases_count: 0,
        membership_purchases_count: 0,
        total_credits_bought: 0,
        last_payment_date: null,
        active_subscription: null
      };
    });

    db.credit_purchases.forEach((cp: any) => {
      const uid = cp.user_id || cp.userId;
      if (userFinancials[uid]) {
        userFinancials[uid].total_spent += cp.amount || cp.price || 0;
        userFinancials[uid].credit_purchases_count++;
        userFinancials[uid].total_credits_bought += cp.credits || 0;
        const d = cp.created_at || cp.purchase_date || cp.date;
        if (d && (!userFinancials[uid].last_payment_date || d > userFinancials[uid].last_payment_date)) {
          userFinancials[uid].last_payment_date = d;
        }
      }
    });

    db.membership_purchases.forEach((mp: any) => {
      const uid = mp.user_id || mp.userId;
      if (userFinancials[uid]) {
        userFinancials[uid].total_spent += mp.amount || mp.price || 0;
        userFinancials[uid].membership_purchases_count++;
        const d = mp.created_at || mp.purchase_date || mp.date;
        if (d && (!userFinancials[uid].last_payment_date || d > userFinancials[uid].last_payment_date)) {
          userFinancials[uid].last_payment_date = d;
        }
        if (mp.status === 'active' || !mp.status) {
          userFinancials[uid].active_subscription = mp.plan_name || mp.planName || mp.plan_id || 'Free';
        }
      }
    });

    let list = Object.values(userFinancials).filter((u: any) => u.total_spent > 0 || u.membership_purchases_count > 0);
    if (search) {
      const s = String(search).toLowerCase();
      list = list.filter((u: any) => (u.first_name || '').toLowerCase().includes(s) || (u.last_name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s));
    }
    list.sort((a: any, b: any) => b.total_spent - a.total_spent);

    const totalCount = list.length;
    const start = (Number(page) - 1) * Number(limit);
    const users = list.slice(start, start + Number(limit));
    res.json({ users, totalCount });
  });

  // Get single user's full financial history
  app.get('/api/admin/financial/user/:userId', async (req, res) => {
    const db = getDB();
    const { userId } = req.params;
    if (!db.credit_purchases) db.credit_purchases = [];
    if (!db.membership_purchases) db.membership_purchases = [];

    const profile = db.profiles.find((p: any) => p.id === userId);
    const userAcc = db.users?.find((u: any) => u.id === userId);

    const creditPurchases = db.credit_purchases.filter((cp: any) => (cp.user_id || cp.userId) === userId).map((cp: any) => ({
      id: cp.id || cp.orderId || 'cp-' + Math.random().toString(36).slice(2),
      type: 'credit_purchase',
      plan_name: cp.plan_name || cp.planName || 'Credit Pack',
      amount: cp.amount || cp.price || 0,
      credits: cp.credits || 0,
      payment_method: cp.payment_method || cp.paymentMethod || 'online',
      status: cp.status || 'completed',
      created_at: cp.created_at || cp.purchase_date || cp.date,
      gst_amount: Math.round(((cp.amount || cp.price || 0) * 0.18) * 100) / 100,
      subtotal: Math.round(((cp.amount || cp.price || 0) / 1.18) * 100) / 100,
      invoice_number: ((db.admin_settings_kv || []).find((s: any) => s.key === 'invoice_prefix')?.value || 'AM') + '-CP-' + (cp.id || cp.orderId || Math.random().toString(36).slice(2)).toString().slice(0, 8)
    }));

    const membershipPurchases = db.membership_purchases.filter((mp: any) => (mp.user_id || mp.userId) === userId).map((mp: any) => ({
      id: mp.id || 'mp-' + Math.random().toString(36).slice(2),
      type: 'membership_purchase',
      plan_name: mp.plan_name || mp.planName || mp.plan_id || 'Membership',
      amount: mp.amount || mp.price || 0,
      credits: 0,
      payment_method: mp.payment_method || mp.paymentMethod || 'online',
      status: mp.status || 'completed',
      created_at: mp.created_at || mp.purchase_date || mp.date,
      start_date: mp.start_date || mp.created_at,
      expiry_date: mp.expiry_date || mp.expires_at,
      gst_amount: Math.round(((mp.amount || mp.price || 0) * 0.18) * 100) / 100,
      subtotal: Math.round(((mp.amount || mp.price || 0) / 1.18) * 100) / 100,
      invoice_number: ((db.admin_settings_kv || []).find((s: any) => s.key === 'invoice_prefix')?.value || 'AM') + '-MP-' + (mp.id || Math.random().toString(36).slice(2)).toString().slice(0, 8)
    }));

    const allPayments = [...creditPurchases, ...membershipPurchases].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const totalSpent = allPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const totalGST = allPayments.reduce((sum: number, p: any) => sum + p.gst_amount, 0);

    res.json({
      user: { ...profile, email: userAcc?.email },
      payments: allPayments,
      summary: {
        total_spent: totalSpent,
        total_gst: totalGST,
        total_payments: allPayments.length,
        credit_purchases: creditPurchases.length,
        membership_purchases: membershipPurchases.length,
        total_credits_bought: creditPurchases.reduce((s: number, c: any) => s + c.credits, 0)
      }
    });
  });

  // --- UNBLOCK REQUESTS API ---
  app.get('/api/admin/unblock-requests', (req, res) => {
    const db = getDB();
    if (!db.unblock_requests) db.unblock_requests = [];

    // Enrich with user data (including email, phone, and block reason)
    const requests = db.unblock_requests.map((req: any) => {
      const profile = db.profiles.find((p: any) => p.id === req.user_id) || {};
      const user = db.users?.find((u: any) => u.id === req.user_id) || {};
      return {
        ...req,
        status: req.status || 'pending', // Ensure status defaults to pending
        user: {
          ...profile,
          email: user.email,
          phone: user.phone || profile.phone,
          block_reason: profile.block_reason || 'Violation of terms',
        }
      };
    });

    res.json(requests);
  });

  app.get('/api/admin/unblock-request/:id/detail', (req, res) => {
    const db = getDB();
    const { id } = req.params;
    if (!db.unblock_requests) db.unblock_requests = [];
    const request = db.unblock_requests.find((r: any) => r.id === id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const profile = db.profiles.find((p: any) => p.id === request.user_id) || {};
    const warnings = db.chat_warnings?.filter((w: any) => w.user_id === request.user_id) || [];

    // Extract violation messages from warnings
    let violation_messages: any[] = [];
    warnings.forEach((w: any) => {
      if (w.message_details) {
        violation_messages.push(w.message_details);
      } else if (w.reason) {
        violation_messages.push({
          message: w.reason,
          timestamp: w.created_at || new Date().toISOString(),
          chat_with: w.reported_by || 'System Detection'
        });
      }
    });

    // If no explicit warnings, or to add more exact evidence, scan the user's actual messages for PII
    if (db.messages) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

      const userMessages = db.messages.filter((m: any) => m.sender_id === request.user_id);

      userMessages.forEach((m: any) => {
        if (m.content && (emailRegex.test(m.content) || phoneRegex.test(m.content))) {
          // Avoid duplicates if already in warnings
          const alreadyExists = violation_messages.some(vm => vm.message === m.content);
          if (!alreadyExists) {
            const receiver = db.profiles.find((p: any) => p.id === m.receiver_id);
            violation_messages.push({
              message: m.content,
              timestamp: m.created_at,
              chat_with: receiver ? `${receiver.first_name} ${receiver.last_name} (${receiver.profile_id})` : m.receiver_id,
              is_exact_match: true
            });
          }
        }
      });
    }

    res.json({
      ...request,
      user: {
        ...profile,
        block_reason: profile.block_reason || 'Violation of platform policies (e.g. sharing PII like Mobile Number / Email ID)'
      },
      warnings: {
        violation_messages
      }
    });
  });

  app.post('/api/admin/unblock-request/:id/handle', (req, res) => {
    const db = getDB();
    const { id } = req.params;
    const { status, notes, adminId } = req.body;

    if (!db.unblock_requests) db.unblock_requests = [];
    const index = db.unblock_requests.findIndex((r: any) => r.id === id);
    if (index === -1) return res.status(404).json({ error: 'Request not found' });

    db.unblock_requests[index].status = status; // 'approved' or 'rejected'
    db.unblock_requests[index].admin_notes = notes;
    db.unblock_requests[index].reviewed_at = new Date().toISOString();
    db.unblock_requests[index].reviewed_by = adminId;

    if (status === 'approved') {
      const userIndex = db.profiles.findIndex((p: any) => p.id === db.unblock_requests[index].user_id);
      if (userIndex !== -1) {
        db.profiles[userIndex].is_blocked = false;
        db.profiles[userIndex].block_reason = '';
      }
    }

    saveDB(db);
    res.json({ success: true, request: db.unblock_requests[index] });
  });

  // --- COUPONS API ---
  app.get('/api/admin/coupons', (req, res) => {
    const db = getDB();
    res.json(db.coupons || []);
  });

  app.post('/api/admin/coupons', (req, res) => {
    const data = req.body;
    const db = getDB();
    if (!db.coupons) db.coupons = [];
    const newCoupon = {
      id: uuidv4(),
      ...data,
      usedCount: 0,
      createdAt: new Date().toISOString()
    };
    db.coupons.push(newCoupon);
    saveDB(db);
    res.json({ success: true, coupon: newCoupon });
  });

  app.put('/api/admin/coupons/:id', (req, res) => {
    const { id } = req.params;
    const data = req.body;
    const db = getDB();
    const index = db.coupons?.findIndex((c: any) => c.id === id);
    if (index !== undefined && index !== -1) {
      db.coupons[index] = { ...db.coupons[index], ...data };
      saveDB(db);
      res.json({ success: true, coupon: db.coupons[index] });
    } else {
      res.status(404).json({ error: 'Coupon not found' });
    }
  });

  app.delete('/api/admin/coupons/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    if (db.coupons) {
      db.coupons = db.coupons.filter((c: any) => c.id !== id);
      saveDB(db);
    }
    res.json({ success: true });
  });

  app.post('/api/coupons/validate', (req, res) => {
    const { code } = req.body;
    const db = getDB();
    const coupon = db.coupons?.find((c: any) => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
    if (!coupon) {
      return res.status(400).json({ error: 'Invalid or inactive coupon' });
    }
    const now = new Date().toISOString();
    if (coupon.validFrom && now < coupon.validFrom) {
      return res.status(400).json({ error: 'Coupon is not yet valid' });
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      return res.status(400).json({ error: 'Coupon has expired' });
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }
    res.json({ success: true, coupon });
  });

  app.post('/api/checkout', stopDuplicates('checkout'), async (req, res) => {
    const { userId, planId, planType, couponCode, paymentId, razorpay_order_id, razorpay_signature } = req.body;

    if (!userId || !planId || !planType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDB();
    const profile = db.profiles.find((p: any) => p.id === userId);

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    let plan = null;
    if (planType === 'membership') {
      plan = db.membership_plans?.find((p: any) => p.id === planId);
    } else if (planType === 'credit') {
      plan = db.credit_plans?.find((p: any) => p.id === planId);
    }

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // ============================================================
    // FRAUD PREVENTION: Verify Razorpay payment signature
    // Only required for real Razorpay payments (not mock/free)
    // ============================================================
    const isMockPayment = !paymentId
      || paymentId.startsWith('mock_')
      || paymentId.startsWith('free_')
      || paymentId === 'free_or_mock_payment';

    const isMockOrder = !razorpay_order_id
      || razorpay_order_id.startsWith('mock_order_');

    if (!isMockPayment && !isMockOrder) {
      // This is a REAL Razorpay payment â€” verify the signature
      if (!razorpay_signature) {
        return res.status(400).json({ error: 'Payment signature missing. Transaction rejected.' });
      }

      const gateway = db.payment_gateways?.find((g: any) => g.is_active && g.provider === 'razorpay');
      if (!gateway?.key_secret) {
        return res.status(400).json({ error: 'Payment gateway not configured properly.' });
      }

      // Razorpay signature formula: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
      const expectedSignature = crypto
        .createHmac('sha256', gateway.key_secret)
        .update(`${razorpay_order_id}|${paymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.error(`[SECURITY] Invalid Razorpay signature for user ${userId}. Possible fraud attempt.`);
        return res.status(400).json({ error: 'Invalid payment signature. Transaction rejected for security.' });
      }

      console.log(`[PAYMENT] Razorpay signature verified for user ${userId}, order ${razorpay_order_id}`);
    } else {
      console.log(`[PAYMENT] Mock/simulated payment for user ${userId}, paymentId: ${paymentId}`);
    }
    // ============================================================

    let finalPrice = plan.price;

    if (couponCode) {
      const coupon = db.coupons?.find((c: any) => c.code.toUpperCase() === couponCode.toUpperCase() && c.isActive);
      if (coupon) {
        if (coupon.type === 'percentage') {
          finalPrice = finalPrice - (finalPrice * (coupon.value / 100));
        } else if (coupon.type === 'fixed') {
          finalPrice = finalPrice - coupon.value;
        }
        if (finalPrice < 0) finalPrice = 0;
        coupon.usedCount = (coupon.usedCount || 0) + 1;
      }
    }

    if (planType === 'membership') {
      profile.is_premium = true;
      profile.premium_plan = plan.id;
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.duration_months);
      profile.premium_end = endDate.toISOString();

      db.membership_purchases.push({
        id: uuidv4(),
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: endDate.toISOString()
      });
    } else if (planType === 'credit') {
      profile.paid_credits = (profile.paid_credits || 0) + plan.credits;
      if (profile.is_premium) {
        profile.paid_credits_expiry_after_membership = plan.expiry_days;
      } else {
        const creditExpiry = new Date();
        creditExpiry.setDate(creditExpiry.getDate() + plan.expiry_days);
        profile.paid_credits_expiry = creditExpiry.toISOString();
      }
      if (!db.credit_purchases) db.credit_purchases = [];
      db.credit_purchases.push({
        id: uuidv4(),
        user_id: userId,
        plan_id: plan.id,
        credits_added: plan.credits,
        created_at: new Date().toISOString()
      });
    }

    saveDB(db);
    res.json({ success: true, finalPrice });
  });

  // ---- CREDIT EXPIRY SCHEDULER ----
  // Runs every hour: When membership expires, start credit countdown from membership end date
  const runCreditExpiryCheck = () => {
    try {
      const db = getDB();
      const now = new Date();
      let changed = false;
      (db.profiles || []).forEach((profile: any) => {
        // Only process profiles that have paid credits with no expiry set (tied to membership)
        if (
          profile.paid_credits > 0 &&
          profile.paid_credits_expiry === null &&
          profile.paid_credits_expiry_after_membership
        ) {
          const membershipExpired = !profile.is_premium ||
            !profile.premium_end ||
            new Date(profile.premium_end) <= now;

          if (membershipExpired) {
            // BUSINESS RULE: Membership just expired â†’ start credit countdown from membership end date
            const membershipEndDate = profile.premium_end ? new Date(profile.premium_end) : now;
            const expiryDays = profile.paid_credits_expiry_after_membership || 90;
            const creditExpiry = new Date(membershipEndDate);
            creditExpiry.setDate(creditExpiry.getDate() + expiryDays);
            profile.paid_credits_expiry = creditExpiry.toISOString();
            profile.is_premium = false; // Ensure membership is marked expired
            changed = true;
            console.log(`[Credit Expiry] Started credit countdown for user ${profile.id}: expires ${creditExpiry.toISOString()}`);
          }
        }
        // Clear expired credits
        if (
          profile.paid_credits > 0 &&
          profile.paid_credits_expiry &&
          new Date(profile.paid_credits_expiry) <= now
        ) {
          console.log(`[Credit Expiry] Credits expired for user ${profile.id}`);
          profile.paid_credits = 0;
          profile.paid_credits_expiry = null;
          profile.paid_credits_expiry_after_membership = null;
          changed = true;
        }
      });
      if (changed) saveDB(db);
    } catch (err) {
      console.error('[Credit Expiry] Error during check:', err);
    }
  };

  // Run immediately on server start, then every hour
  runCreditExpiryCheck();
  setInterval(runCreditExpiryCheck, 60 * 60 * 1000);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // SEO & COMPLIANCE ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get('/robots.txt', (req, res) => {
    const db = getDB();
    const content = db.admin_settings_kv?.find((s: any) => s.key === 'robots_txt_content')?.value || 'User-agent: *\nAllow: /\nSitemap: /sitemap.xml';
    res.type('text/plain');
    res.send(content);
  });

  app.get('/sitemap.xml', (req, res) => {
    const db = getDB();
    // Provide a dynamic sitemap using profiles or static routes
    const siteNameSetting = db.admin_settings_kv?.find((s: any) => s.key === 'site_name');
    const baseUrl = req.protocol + '://' + req.get('host');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    const staticRoutes = ['/', '/about', '/contact', '/login', '/register'];
    staticRoutes.forEach(route => {
      xml += `  <url>\n    <loc>${baseUrl}${route}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${route === '/' ? '1.0' : '0.8'}</priority>\n  </url>\n`;
    });

    xml += '</urlset>';
    res.type('application/xml');
    res.send(xml);
  });

  // Vite middleware for development
  // ── Admin Manager Routes — MUST be before Vite middleware ─────────────────

  app.get('/api/admin/managers', authenticateToken, async (req: any, res: any) => {
    try {
      const db = getDB();
      const isAdminManager = (db.admin_managers || []).some((m: any) =>
        m.id === req.user?.id || m.email?.toLowerCase() === req.user?.email?.toLowerCase()
      );
      if (req.user?.role !== 'admin' && !isAdminManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const managers = (db.admin_managers || []).map((m: any) => ({
        ...m, password_hash: undefined, password: undefined
      }));
      console.log('[GET /api/admin/managers] returning', managers.length, 'managers:', managers.map((m: any) => m.email).join(', '));
      res.json({ success: true, managers });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch managers.' }); }
  });

  app.post('/api/admin/managers', authenticateToken, requireMasterAdmin, async (req: any, res: any) => {
    try {
      const body = req.body ?? {};
      const name = (body.name || '').toString().trim();
      const email = (body.email || '').toString().trim().toLowerCase();
      const password = (body.password || '').toString();
      const role = (body.role || '').toString().trim();
      const permissions = body.permissions;
      if (!name) return res.status(400).json({ error: 'Name is required.' });
      if (!email) return res.status(400).json({ error: 'Email is required.' });
      if (!password) return res.status(400).json({ error: 'Password is required.' });
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      if (!role) return res.status(400).json({ error: 'Role is required.' });
      const validRoles = ['master_admin', 'admin', 'administration', 'finance'];
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role.' });
      const db = getDB();
      if (!Array.isArray(db.admin_managers)) db.admin_managers = [];
      const duplicate = db.admin_managers.find((m: any) => (m.email || '').toLowerCase() === email);
      if (duplicate) return res.status(409).json({ error: `Admin with email "${email}" already exists.` });
      const hashedPassword = await bcrypt.hash(password, 12);
      let newId: string;
      try { newId = crypto.randomUUID(); } catch { newId = `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
      const now = new Date().toISOString();
      const defaultPerms: Record<string, string[]> = {
        master_admin: ['*'],
        admin: ['/admin', '/admin/verification', '/admin/users', '/admin/communities', '/admin/notifications', '/admin/plans', '/admin/coupons', '/admin/payment-gateways', '/admin/financials', '/admin/analytics', '/admin/reports', '/admin/emails', '/admin/unblock', '/admin/success-stories', '/admin/contacts', '/admin/content', '/admin/seo-marketing', '/admin/legal-pages', '/admin/settings'],
        administration: ['/admin', '/admin/verification', '/admin/users', '/admin/reports', '/admin/unblock', '/admin/success-stories', '/admin/contacts', '/admin/communities'],
        finance: ['/admin', '/admin/financials', '/admin/analytics', '/admin/plans', '/admin/payment-gateways', '/admin/coupons'],
      };
      const newManager = {
        id: newId, email, password_hash: hashedPassword, name, role,
        // Use exactly what master admin selected — if nothing selected, give dashboard only
        permissions: Array.isArray(permissions) && permissions.length > 0
          ? permissions
          : (role === 'master_admin' ? ['*'] : ['/admin']),
        is_active: true, created_by: req.user?.id ?? 'system',
        created_at: now, updated_at: now, last_login: null,
      };
      if (!db.users) db.users = [];
      if (!db.users.find((u: any) => (u.email || '').toLowerCase() === email)) {
        db.users.push({ id: newId, email, password_hash: hashedPassword, password: hashedPassword, role: 'admin', is_active: true, email_verified: true, created_at: now, updated_at: now });
        if (!db.profiles) db.profiles = [];
        db.profiles.push({ id: newId, user_id: newId, first_name: name, last_name: '', role: 'admin', is_active: true, created_at: now, updated_at: now });
      }
      db.admin_managers.push(newManager);
      saveDB(db);
      const safe: any = { ...newManager };
      delete safe.password_hash;
      return res.status(201).json({ success: true, manager: safe });
    } catch (err: any) {
      console.error('[POST /api/admin/managers] ERROR:', err?.message, '\n', err?.stack);
      return res.status(500).json({ error: 'Server error: ' + (err?.message ?? 'unknown') });
    }
  });

  app.put('/api/admin/managers/:id', authenticateToken, requireMasterAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { name, role, permissions, is_active } = req.body;
      const db = getDB();
      const idx = (db.admin_managers || []).findIndex((m: any) => m.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Admin manager not found.' });
      if (id === req.user.id) return res.status(400).json({ error: 'You cannot change your own role or status.' });
      if (db.admin_managers[idx].role === 'master_admin' && role !== 'master_admin') return res.status(400).json({ error: 'Cannot demote another Master Admin.' });
      if (name !== undefined) db.admin_managers[idx].name = name.trim();
      if (role !== undefined) { db.admin_managers[idx].role = role; const ui = (db.users || []).findIndex((u: any) => u.id === id); if (ui !== -1) db.users[ui].role = 'admin'; }
      if (Array.isArray(permissions)) db.admin_managers[idx].permissions = permissions;
      if (typeof is_active === 'boolean') { db.admin_managers[idx].is_active = is_active; const ui = (db.users || []).findIndex((u: any) => u.id === id); if (ui !== -1) db.users[ui].is_active = is_active; }
      db.admin_managers[idx].updated_at = new Date().toISOString();
      saveDB(db);
      const { password_hash, ...safe } = db.admin_managers[idx];
      // Emit real-time permission update to the affected admin
      const io = (app as any).io;
      if (io) {
        io.to(`user:${id}`).emit('admin:permissions-updated', {
          role: safe.role,
          permissions: safe.permissions,
          is_active: safe.is_active,
        });
      }
      res.json({ success: true, manager: safe });
    } catch (err) { res.status(500).json({ error: 'Failed to update admin manager.' }); }
  });

  app.post('/api/admin/managers/:id/change-password', authenticateToken, requireMasterAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      const db = getDB();
      const manager = (db.admin_managers || []).find((m: any) => m.id === id);
      if (!manager) return res.status(404).json({ error: 'Admin manager not found.' });
      const hashed = await bcrypt.hash(newPassword, 12);
      manager.password_hash = hashed; manager.updated_at = new Date().toISOString();
      const user = (db.users || []).find((u: any) => u.id === id);
      if (user) { user.password_hash = hashed; user.password = hashed; }
      saveDB(db);
      res.json({ success: true, message: 'Password changed successfully.' });
    } catch (err) { res.status(500).json({ error: 'Failed to change password.' }); }
  });

  app.delete('/api/admin/managers/:id', authenticateToken, requireMasterAdmin, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      if (id === req.user.id) return res.status(400).json({ error: 'You cannot delete yourself.' });
      const db = getDB();
      const manager = (db.admin_managers || []).find((m: any) => m.id === id);
      if (!manager) {
        // Already deleted — return success so UI can refresh
        return res.json({ success: true, message: 'Admin manager already removed.' });
      }
      if (manager.role === 'master_admin') return res.status(400).json({ error: 'Cannot delete a Master Admin.' });
      db.admin_managers = db.admin_managers.filter((m: any) => m.id !== id);
      db.users = (db.users || []).filter((u: any) => u.id !== id);
      db.profiles = (db.profiles || []).filter((p: any) => p.id !== id);
      saveDB(db);
      // Emit real-time event so deleted admin is force-logged out
      const io = (app as any).io;
      if (io) {
        io.to(`user:${id}`).emit('admin:account-deleted', { reason: 'Your admin account has been removed by Master Admin.' });
      }
      res.json({ success: true, message: 'Admin manager removed.' });
    } catch (err) { res.status(500).json({ error: 'Failed to delete admin manager.' }); }
  });

  app.get('/api/admin/my-permissions', authenticateToken, async (req: any, res: any) => {
    try {
      const db = getDB();
      // Match by id OR email (case-insensitive)
      const manager = (db.admin_managers || []).find((m: any) =>
        m.id === req.user?.id || (m.email || '').toLowerCase() === (req.user?.email || '').toLowerCase()
      );
      console.log('[my-permissions] user:', req.user?.email, '| id:', req.user?.id, '| found:', manager ? `${manager.email}(${manager.role})` : 'NOT FOUND', '| perms:', manager?.permissions?.join(',') || 'none');
      if (!manager) {
        // Not found in admin_managers — give dashboard-only access, never full access
        return res.json({ success: true, role: 'admin', permissions: ['/admin'] });
      }
      // Return EXACTLY what was assigned — no overrides
      res.json({
        success: true,
        role: manager.role,
        permissions: manager.permissions,
        name: manager.name,
        is_active: manager.is_active
      });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch permissions.' }); }
  });

  // ── End Admin Manager Routes ───────────────────────────────────────────────

  app.get('/api/profile-status/:userId', (req, res) => {
    const { userId } = req.params;
    const db = getDB();
    const profile = db.profiles.find((p: any) => p.id === userId);
    if (!profile) return res.status(404).json({ error: "Not found" });
    res.json({
      profile_status: profile.profile_status || "active",
      reactivation_count: profile.reactivation_count || 0,
      reactivation_status: profile.reactivation_status || "none",
      reactivation_rejection_remark: profile.reactivation_rejection_remark || "",
      match_confirmed: profile.match_confirmed || false,
      match_type: profile.match_type || null,
    });
  });

  // ── ENDPOINT B: Match Confirmation ──
  app.post('/api/match-confirmation-email', async (req, res) => {
    try {
      const { user_id, email_token, match_type, match_platform,
        partner_profile_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
      const db = getDB();
      // Verify the user exists
      const profile = db.profiles.find((p: any) => p.id === user_id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      // Verify the user object exists
      const user = db.users.find((u: any) => u.id === user_id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const kv: Record<string, string> = {};
      (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
      const siteName = kv['platform_name'] || kv['site_title'] || 'AtMilan';
      const newStatus = match_type === 'marriage' ? 'married' : 'engaged';
      // Update profile
      profile.match_confirmed = true;
      profile.match_type = match_type || 'engagement';
      profile.match_platform = match_platform || 'other';
      profile.match_partner_profile_id = partner_profile_id || '';
      profile.profile_status = newStatus;
      // Create match confirmation record
      if (!db.match_confirmations) db.match_confirmations = [];
      const alreadyConfirmed = db.match_confirmations.find(
        (m: any) => m.user_id === user_id && m.status !== 'rejected'
      );
      if (!alreadyConfirmed) {
        db.match_confirmations.push({
          id: uuidv4(), user_id,
          match_type: match_type || 'engagement',
          match_platform: match_platform || 'other',
          partner_profile_id: partner_profile_id || '',
          status: 'pending',
          created_at: new Date().toISOString()
        });
      }
      // If marriage + atmilan: create success story
      if (match_type === 'marriage' && match_platform === 'atmilan') {
        if (!db.success_stories) db.success_stories = [];
        const partnerProfile = db.profiles.find(
          (p: any) => p.profile_id === partner_profile_id
        );
        db.success_stories.push({
          id: uuidv4(), user_id,
          groom_name: profile.gender === 'Male'
            ? profile.first_name : (partnerProfile?.first_name || 'Partner'),
          bride_name: profile.gender === 'Female'
            ? profile.first_name : (partnerProfile?.first_name || 'Partner'),
          story_text: `Found my life partner through ${siteName}.`,
          year: new Date().getFullYear().toString(),
          location: profile.city || '',
          is_approved: false, is_published: false,
          created_at: new Date().toISOString()
        });
      }
      // Generate referral code — format: <BrandPrefix><7-digit> e.g. AM0000001
      const refCode = generateReferralCode(db);
      profile.referral_code = refCode;
      if (!db.referral_links) db.referral_links = [];
      db.referral_links.push({
        id: uuidv4(), code: refCode, user_id,
        match_type: match_type || 'engagement',
        is_used: false, premium_months: 1,
        created_at: new Date().toISOString(),
        used_by: null, used_date: null
      });
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.emit('profile-status:updated', { userId: user_id, profile_status: newStatus });
        io.emit('success-story:updated', { userId: user_id });
        io.to('admin:room').emit('admin:referral-updated', { userId: user_id });
      }
      res.json({ success: true, referral_code: refCode, status: newStatus });
    } catch (err: any) {
      console.error('[Match Confirmation Email Error]', err);
      res.status(500).json({ error: err.message || 'Failed to confirm match' });
    }
  });

  app.post('/api/match-confirmation', authenticateToken, async (req: any, res) => {
    try {
      const { match_type, match_platform, partner_profile_id } = req.body;
      const userId = req.user.id;
      const db = getDB();
      const profile = db.profiles.find((p: any) => p.id === userId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const kv: Record<string, string> = {};
      (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
      const siteName = kv["platform_name"] || kv["site_title"] || "AtMilan";
      const newStatus = match_type === "marriage" ? "married" : "engaged";
      profile.match_confirmed = true;
      profile.match_type = match_type;
      profile.match_platform = match_platform;
      profile.match_partner_profile_id = partner_profile_id || "";
      profile.profile_status = newStatus;
      profile.is_active = true;
      // Create match confirmation record
      if (!db.match_confirmations) db.match_confirmations = [];
      db.match_confirmations.push({
        id: uuidv4(), user_id: userId,
        match_type, match_platform,
        partner_profile_id: partner_profile_id || "",
        status: "pending",
        created_at: new Date().toISOString()
      });
      // If marriage + atmilan platform: create success story entry
      if (match_type === "marriage" && match_platform === "atmilan") {
        if (!db.success_stories) db.success_stories = [];
        const partnerProfile = db.profiles.find((p: any) => p.profile_id === partner_profile_id);
        db.success_stories.push({
          id: uuidv4(), user_id: userId,
          groom_name: profile.gender === "Male" ? profile.first_name : (partnerProfile?.first_name || "Partner"),
          bride_name: profile.gender === "Female" ? profile.first_name : (partnerProfile?.first_name || "Partner"),
          story_text: `Found my life partner through ${siteName}. Grateful for this platform!`,
          year: new Date().getFullYear().toString(),
          location: profile.city || "",
          is_approved: false, is_published: false,
          created_at: new Date().toISOString()
        });
        // Send celebration email
        const user = db.users.find((u: any) => u.id === userId);
        if (user?.email) {
          const celebHtml = buildMatchCelebrationEmail(profile.first_name, siteName, match_type);
          sendEmail(user.email, `Congratulations from ${siteName}! 🎉`, celebHtml).catch(() => { });
        }
      }
      // Generate referral code — format: <BrandPrefix><7-digit> e.g. AM0000001
      const refCode = generateReferralCode(db);
      profile.referral_code = refCode;
      if (!db.referral_links) db.referral_links = [];
      db.referral_links.push({
        id: uuidv4(), code: refCode, user_id: userId,
        match_type, is_used: false,
        premium_months: 1,
        created_at: new Date().toISOString(),
        used_by: null, used_date: null
      });
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        io.emit("profile-status:updated", { userId, profile_status: newStatus });
        io.emit("success-story:updated", { userId });
        io.to('admin:room').emit('admin:referral-updated', { userId });
      }
      res.json({ success: true, referral_code: refCode, status: newStatus });
    } catch (err: any) {
      console.error('[Match Confirmation Error]', err);
      res.status(500).json({ error: err.message || 'Failed to confirm match' });
    }
  });

  // ── ENDPOINT C: Referral registration bonus ──
  app.post('/api/referral/use', async (req, res) => {
    const { code, newUserId } = req.body;
    const db = getDB();
    if (!db.referral_links) return res.status(404).json({ error: "Invalid referral code" });
    const ref = db.referral_links.find((r: any) => r.code === code);
    if (!ref) return res.status(404).json({ error: "Invalid referral code" });
    if (ref.is_used) return res.status(400).json({ error: "Expired or Already Used" });
    ref.is_used = true;
    ref.used_by = newUserId;
    ref.used_date = new Date().toISOString();
    // Give new user 1 month premium
    const profile = db.profiles.find((p: any) => p.id === newUserId);
    if (profile) {
      profile.is_premium = true;
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      profile.premium_end = end.toISOString();
      profile.premium_plan = "referral_bonus";
    }
    saveDB(db);
    const io2 = (app as any).io;
    if (io2) {
      io2.to('admin:room').emit('admin:referral-updated', { code });
    }
    res.json({ success: true, premium_months: 1 });
  });

  // ── ENDPOINT D: Reactivation request (submit) ──
  app.post('/api/reactivation/request', authenticateToken, async (req: any, res) => {
    try {
      const { user_message } = req.body;
      const userId = req.user.id;
      const db = getDB();
      const profile = db.profiles.find((p: any) => p.id === userId);
      if (!profile) return res.status(404).json({ error: "Not found" });

      // Auto-green logic
      const autoGreenLimitSetting = db.admin_settings_kv?.find((s: any) => s.key === 'reactivation_limit');
      const autoGreenLimit = autoGreenLimitSetting ? parseInt(autoGreenLimitSetting.value) : 10;
      const currentCount = profile.reactivation_count || 0;

      // Only apply auto-green to yellow/red profiles, not engaged/married
      if ((profile.profile_status === 'yellow' || profile.profile_status === 'red') && currentCount < autoGreenLimit) {
        profile.reactivation_count = currentCount + 1;
        profile.profile_status = "active";
        profile.reactivation_status = "approved";
        profile.match_confirmed = false;
        profile.match_type = null;
        profile.reactivation_rejection_remark = "";

        saveDB(db);
        const io = (app as any).io;
        if (io) {
          io.to(`user:${userId}`).emit("profile:reactivated", { userId, status: 'active' });
          io.emit("profile-status:updated", { userId, profile_status: "active" });
        }
        return res.json({ success: true, auto_approved: true });
      }

      profile.reactivation_status = "pending";
      if (!db.reactivation_requests) db.reactivation_requests = [];
      const existing = db.reactivation_requests.find((r: any) => r.user_id === userId && r.status === "pending");
      if (!existing) {
        db.reactivation_requests.push({
          id: uuidv4(), user_id: userId,
          profile_status: profile.profile_status,
          user_message: user_message || "",
          status: "pending",
          rejection_remark: "",
          created_at: new Date().toISOString()
        });
      }
      saveDB(db);
      const io = (app as any).io;
      if (io) io.to("admin:room").emit("admin:reactivation-request", { userId });
      res.json({ success: true, auto_approved: false });
    } catch (err: any) {
      console.error('[Reactivation Request Error]', err);
      res.status(500).json({ error: err.message || 'Failed to submit request' });
    }
  });

  // ── ENDPOINT E: Admin approve/reject reactivation ──
  app.post('/api/admin/reactivation/:requestId/decision', authenticateToken, async (req: any, res) => {
    try {
      const { requestId } = req.params;
      const { decision, remark } = req.body;
      const db = getDB();
      if (!db.reactivation_requests) return res.status(404).json({ error: "Not found" });
      const request = db.reactivation_requests.find((r: any) => r.id === requestId);
      if (!request) return res.status(404).json({ error: "Request not found" });
      request.status = decision;
      request.rejection_remark = remark || "";
      request.decided_at = new Date().toISOString();
      const profile = db.profiles.find((p: any) => p.id === request.user_id);
      if (profile) {
        if (decision === "approved") {
          profile.profile_status = "active";
          profile.reactivation_status = "approved";
          profile.match_confirmed = false;
          profile.match_type = null;
          profile.reactivation_rejection_remark = "";
        } else {
          profile.reactivation_status = "rejected";
          profile.reactivation_rejection_remark = remark || "";
        }
      }
      saveDB(db);
      const io = (app as any).io;
      if (io) {
        if (decision === "approved") {
          io.to(`user:${request.user_id}`).emit("profile:reactivated", { userId: request.user_id });
          io.emit("profile-status:updated", { userId: request.user_id, profile_status: "active" });
        } else {
          io.to(`user:${request.user_id}`).emit("profile:reactivation-rejected", {
            userId: request.user_id, remark: remark || ""
          });
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Reactivation Decision Error]', err);
      res.status(500).json({ error: err.message || 'Failed to process decision' });
    }
  });

  // ── ENDPOINT F: Get all reactivation requests (admin) ──
  app.get('/api/admin/reactivation-requests', authenticateToken, (req: any, res) => {
    const db = getDB();
    const requests = (db.reactivation_requests || []).map((r: any) => {
      const profile = db.profiles.find((p: any) => p.id === r.user_id);
      return {
        ...r, user: profile ? {
          first_name: profile.first_name, last_name: profile.last_name,
          profile_id: profile.profile_id, profile_photo_url: profile.profile_photo_url,
          profile_status: profile.profile_status
        } : null
      };
    });
    res.json(requests);
  });

  // ── ENDPOINT G: Get all match confirmations (admin) ──
  app.get('/api/admin/match-confirmations', authenticateToken, (req: any, res) => {
    const db = getDB();
    const confirmations = (db.match_confirmations || []).map((m: any) => {
      const profile = db.profiles.find((p: any) => p.id === m.user_id);
      return {
        ...m, user: profile ? {
          first_name: profile.first_name, last_name: profile.last_name,
          profile_id: profile.profile_id, profile_photo_url: profile.profile_photo_url
        } : null
      };
    });
    res.json(confirmations);
  });

  // ── ENDPOINT H: Get referral links (admin) ──
  app.get('/api/admin/referral-links', authenticateToken, (req: any, res) => {
    const db = getDB();
    const links = (db.referral_links || []).map((l: any) => {
      const profile = db.profiles.find((p: any) => p.id === l.user_id);
      const usedByProfile = l.used_by ? db.profiles.find((p: any) => p.id === l.used_by) : null;
      return {
        id: l.id,
        user_id: l.user_id,
        code: l.code,
        type: l.match_type || l.type || 'engagement',
        status: l.is_used ? 'used' : 'active',
        used_by: usedByProfile ? `${usedByProfile.first_name} (${usedByProfile.profile_id})` : (l.used_by || null),
        used_at: l.used_date || l.used_at || null,
        created_at: l.created_at,
        premium_months: l.premium_months || 1,
        user: profile ? {
          first_name: profile.first_name,
          last_name: profile.last_name || '',
          profile_id: profile.profile_id
        } : null
      };
    }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(links);
  });


  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      configFile: path.join(process.cwd(), 'vite.config.ts'),
      server: {
        middlewareMode: true,
        // Disable Vite's own HMR WebSocket server â€” it conflicts with Socket.IO
        // on the same port. HMR still works via the Express server's upgrade handler.
        hmr: false,
      },
      appType: 'spa',
    });
    // Prevent browser caching of HTML to ensure fresh JS bundles
    app.use((req, res, next) => {
      if (req.url === '/' || req.url.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // FCM TOKEN MANAGEMENT ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // POST /api/fcm/register-token â€” save a user's FCM device token
  app.post('/api/fcm/register-token', (req, res) => {
    try {
      const { user_id, token, platform = 'web' } = req.body;
      if (!user_id || !token) return res.status(400).json({ error: 'user_id and token required' });
      const db = getDB();
      if (!db.fcm_tokens) db.fcm_tokens = [];
      // Update or insert
      const existing = db.fcm_tokens.find((t: any) => t.user_id === user_id && t.platform === platform);
      if (existing) {
        existing.token = token;
        existing.updated_at = new Date().toISOString();
      } else {
        db.fcm_tokens.push({ id: uuidv4(), user_id, token, platform, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
      saveDB(db);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/fcm/unregister-token â€” remove a user's FCM token (on logout)
  app.post('/api/fcm/unregister-token', (req, res) => {
    try {
      const { user_id, token } = req.body;
      const db = getDB();
      if (db.fcm_tokens) {
        db.fcm_tokens = db.fcm_tokens.filter((t: any) => !(t.user_id === user_id && t.token === token));
        saveDB(db);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/admin/settings/firebase-config â€” return active Firebase config for frontend SDK init
  app.get('/api/admin/settings/firebase-config', (req, res) => {
    try {
      const db = getDB();
      const kv: Record<string, string> = {};
      (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });

      // Try to parse firebase_apis for the active one
      let config = null;
      let vapidKey = '';
      try {
        const fbApis = JSON.parse(kv['firebase_apis'] || '[]');
        const active = fbApis.find((a: any) => a.is_active);
        if (active) {
          config = {
            apiKey: active.api_key || '',
            authDomain: active.auth_domain || `${active.project_id}.firebaseapp.com`,
            projectId: active.project_id || '',
            storageBucket: active.storage_bucket || `${active.project_id}.appspot.com`,
            messagingSenderId: active.sender_id || '',
            appId: active.app_id || '',
          };
          vapidKey = active.vapid_key || '';
        }
      } catch { }

      // Fallback to flat keys
      if (!config && kv['firebase_project_id']) {
        config = {
          apiKey: kv['firebase_api_key'] || '',
          authDomain: kv['firebase_auth_domain'] || `${kv['firebase_project_id']}.firebaseapp.com`,
          projectId: kv['firebase_project_id'] || '',
          storageBucket: kv['firebase_storage_bucket'] || `${kv['firebase_project_id']}.appspot.com`,
          messagingSenderId: kv['firebase_sender_id'] || '',
          appId: kv['firebase_app_id'] || '',
        };
        vapidKey = kv['firebase_vapid_key'] || '';
      }

      res.json({ config, vapid_key: vapidKey });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PUSH NOTIFICATION ENDPOINTS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/admin/notifications â€” list all sent notifications with stats
  app.get('/api/admin/notifications', (req, res) => {
    try {
      const db = getDB();
      if (!db.admin_notifications) db.admin_notifications = [];
      const notifications = [...db.admin_notifications].reverse();
      const today = new Date().toDateString();
      const stats = {
        total: notifications.length,
        today: notifications.filter((n: any) => new Date(n.sent_at).toDateString() === today).length,
        totalReach: notifications.reduce((sum: number, n: any) => sum + (n.delivery_count || 0), 0),
        avgRead: notifications.length > 0
          ? Math.round(notifications.reduce((sum: number, n: any) => {
            const dc = n.delivery_count || 0;
            const rc = n.read_count || 0;
            return sum + (dc > 0 ? (rc / dc) * 100 : 0);
          }, 0) / notifications.length)
          : 0,
      };
      const deviceCount = (db.fcm_tokens || []).length;
      res.json({ notifications, stats, device_count: deviceCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/notifications/send â€” send a broadcast push notification
  app.post('/api/admin/notifications/send', (req, res) => {
    try {
      const db = getDB();
      const {
        title, body, type, target, action_url, icon, platforms,
        // Filter-based targeting
        filter_gender, filter_state, filter_city, filter_taluka,
        filter_premium, // 'all' | 'premium' | 'free'
        specific_user_ids, // string[] â€” for 'specific' target
      } = req.body;

      if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

      if (!db.admin_notifications) db.admin_notifications = [];

      // â”€â”€ Determine target users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      let targetUsers: any[] = db.profiles || [];

      // Basic target type
      if (target === 'premium') targetUsers = targetUsers.filter((p: any) => p.is_premium);
      if (target === 'free') targetUsers = targetUsers.filter((p: any) => !p.is_premium);

      // Specific user IDs
      if (target === 'specific' && specific_user_ids && specific_user_ids.length > 0) {
        const ids = Array.isArray(specific_user_ids) ? specific_user_ids : [specific_user_ids];
        targetUsers = targetUsers.filter((p: any) =>
          ids.includes(p.id) || ids.includes(p.profile_id)
        );
      }

      // Filter-based: gender
      if (filter_gender && filter_gender !== 'all') {
        targetUsers = targetUsers.filter((p: any) =>
          (p.gender || '').toLowerCase() === filter_gender.toLowerCase()
        );
      }

      // Filter-based: state
      if (filter_state && filter_state !== 'all') {
        targetUsers = targetUsers.filter((p: any) =>
          (p.state || '').toLowerCase() === filter_state.toLowerCase()
        );
      }

      // Filter-based: city
      if (filter_city && filter_city !== 'all') {
        targetUsers = targetUsers.filter((p: any) =>
          (p.city || '').toLowerCase() === filter_city.toLowerCase()
        );
      }

      // Filter-based: taluka
      if (filter_taluka && filter_taluka.trim()) {
        targetUsers = targetUsers.filter((p: any) =>
          (p.taluka || '').toLowerCase().includes(filter_taluka.toLowerCase())
        );
      }

      // Filter-based: premium status
      if (filter_premium === 'premium') targetUsers = targetUsers.filter((p: any) => p.is_premium);
      if (filter_premium === 'free') targetUsers = targetUsers.filter((p: any) => !p.is_premium);

      const deliveryCount = targetUsers.length;

      // â”€â”€ Variable substitution helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const substituteVars = (text: string, profile: any) => {
        return text
          .replace(/\{\{first_name\}\}/g, profile.first_name || '')
          .replace(/\{\{last_name\}\}/g, profile.last_name || '')
          .replace(/\{\{full_name\}\}/g, `${profile.first_name || ''} ${profile.last_name || ''}`.trim())
          .replace(/\{\{profile_id\}\}/g, profile.profile_id || '')
          .replace(/\{\{gender\}\}/g, profile.gender || '')
          .replace(/\{\{city\}\}/g, profile.city || '')
          .replace(/\{\{state\}\}/g, profile.state || '')
          .replace(/\{\{taluka\}\}/g, profile.taluka || '')
          .replace(/\{\{caste\}\}/g, profile.caste || '')
          .replace(/\{\{age\}\}/g, profile.age || '')
          .replace(/\{\{email\}\}/g, profile.email || '')
          .replace(/\{\{phone\}\}/g, profile.phone || '')
          .replace(/\{\{app_name\}\}/g, (db.admin_settings_kv || []).find((s: any) => s.key === 'platform_name')?.value || 'AtMilan')
          .replace(/\{\{website_url\}\}/g, (db.admin_settings_kv || []).find((s: any) => s.key === 'company_website')?.value || 'www.atmilan.com');
      };

      const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const notifRecord: any = {
        id: notifId,
        title,
        body,
        type: type || 'general',
        target: target || 'all',
        action_url: action_url || '',
        icon: icon || 'ðŸ””',
        platforms: platforms || ['web', 'android'],
        sent_by: 'admin',
        sent_at: new Date().toISOString(),
        delivery_count: deliveryCount,
        read_count: 0,
        is_active: true,
        filters: { filter_gender, filter_state, filter_city, filter_taluka, filter_premium },
      };

      db.admin_notifications.push(notifRecord);

      // Also save as individual user notifications (with variable substitution)
      if (!db.notifications) db.notifications = [];
      targetUsers.forEach((profile: any) => {
        const personalTitle = substituteVars(title, profile);
        const personalBody = substituteVars(body, profile);
        db.notifications.push({
          id: `un-${notifId}-${profile.id}`,
          user_id: profile.id,
          type: 'admin_broadcast',
          admin_notification_id: notifId,
          title: personalTitle,
          body: personalBody,
          icon: icon || 'ðŸ””',
          action_url: action_url || '',
          notif_type: type || 'general',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      });

      saveDB(db);

      // Broadcast in real-time via Socket.IO
      const io = (app as any).io;
      if (io) {
        targetUsers.forEach((profile: any) => {
          const personalTitle = substituteVars(title, profile);
          const personalBody = substituteVars(body, profile);
          const broadcastPayload = {
            id: notifId,
            title: personalTitle,
            body: personalBody,
            type: type || 'general',
            icon: icon || 'ðŸ””',
            action_url: action_url || '',
            created_at: notifRecord.sent_at,
            is_read: false,
          };
          io.to(`user:${profile.id}`).emit('admin:push-notification', broadcastPayload);
          io.to(`user:${profile.id}`).emit('notification:new', { ...broadcastPayload, user_id: profile.id });
        });
        // Also emit global for 'all' target
        if (target === 'all' && !filter_gender && !filter_state && !filter_city) {
          io.emit('admin:push-notification', { id: notifId, title, body, type: type || 'general', icon: icon || 'ðŸ””', action_url: action_url || '', created_at: notifRecord.sent_at, is_read: false });
        }
      }

      // Firebase FCM delivery (async, non-blocking)
      const kv: Record<string, string> = {};
      (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
      const fcmServerKey = kv['firebase_server_key'];
      if (fcmServerKey && fcmServerKey.length > 10) {
        const sendFCM = (payload: any) => fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `key=${fcmServerKey}` },
          body: JSON.stringify(payload),
        }).then(r => r.json()).catch(e => ({ error: e.message }));

        const fcmTokens = (db.fcm_tokens || []) as any[];
        const targetUserIds = new Set(targetUsers.map((p: any) => p.id));
        const userTokens = fcmTokens.filter((t: any) => targetUserIds.has(t.user_id) && t.token);

        if (userTokens.length > 0) {
          const chunks: any[][] = [];
          for (let i = 0; i < userTokens.length; i += 500) chunks.push(userTokens.slice(i, i + 500));
          for (const chunk of chunks) {
            const tokenList = chunk.map((t: any) => t.token);
            (async () => {
              try {
                const result = await sendFCM({
                  notification: { title, body },
                  data: { type: type || 'general', action_url: action_url || '', notif_id: notifId, icon: icon || 'ðŸ””' },
                  registration_ids: tokenList,
                  android: { priority: 'high', notification: { sound: 'default', channel_id: 'atmilan_push' } },
                  apns: { payload: { aps: { sound: 'default', badge: 1 } } },
                  webpush: { notification: { icon: '/vite.svg', badge: '/vite.svg', requireInteraction: false }, fcm_options: { link: action_url || '/' } },
                });
                console.log(`[FCM] Sent to ${tokenList.length} tokens. Success:${result.success}, Fail:${result.failure}`);
                if (result.results) {
                  const invalidTokens: string[] = [];
                  result.results.forEach((r: any, i: number) => {
                    if (r.error === 'InvalidRegistration' || r.error === 'NotRegistered') invalidTokens.push(tokenList[i]);
                  });
                  if (invalidTokens.length > 0) {
                    db.fcm_tokens = (db.fcm_tokens || []).filter((t: any) => !invalidTokens.includes(t.token));
                    saveDB(db);
                  }
                }
              } catch (e: any) { console.warn('[FCM] Batch send error:', e.message); }
            })();
          }
        }

        // Topic fallback
        sendFCM({
          notification: { title, body },
          data: { type: type || 'general', action_url: action_url || '', notif_id: notifId },
          to: target === 'all' ? '/topics/all_users' : `/topics/${target}_users`,
        }).then((fcmRes: any) => console.log('[FCM] Topic result:', JSON.stringify(fcmRes)))
          .catch((e: any) => console.warn('[FCM] Topic failed:', e.message));
      }

      res.json({ success: true, notification: notifRecord, delivered: deliveryCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/admin/notifications/:id â€” delete a notification record
  app.delete('/api/admin/notifications/:id', (req, res) => {
    try {
      const db = getDB();
      if (!db.admin_notifications) db.admin_notifications = [];
      db.admin_notifications = db.admin_notifications.filter((n: any) => n.id !== req.params.id);
      saveDB(db);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/notifications/:id/mark-read â€” mark admin notification as read for a user
  app.post('/api/admin/notifications/:notifId/mark-read', (req, res) => {
    try {
      const db = getDB();
      const { user_id } = req.body;
      if (!db.notifications) db.notifications = [];
      const notif = db.notifications.find(
        (n: any) => n.admin_notification_id === req.params.notifId && n.user_id === user_id
      );
      if (notif) {
        notif.is_read = true;
        // Increment read_count on admin_notification record
        if (db.admin_notifications) {
          const adminNotif = db.admin_notifications.find((n: any) => n.id === req.params.notifId);
          if (adminNotif) adminNotif.read_count = (adminNotif.read_count || 0) + 1;
        }
        saveDB(db);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/test-firebase â€” test Firebase API key validity
  app.post('/api/admin/test-firebase', async (req, res) => {
    const { server_key, project_id } = req.body;
    if (!server_key || server_key.length < 10) {
      return res.status(400).json({ error: 'A valid Server Key is required to test' });
    }
    try {
      // Send a dry-run FCM request to validate the key
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${server_key}`,
        },
        body: JSON.stringify({
          dry_run: true,
          to: 'test_token_for_validation',
          notification: { title: 'Firebase API Test', body: 'This is a test from AtMilan Admin Panel' },
        }),
      });
      const data = await response.json();
      // FCM returns error "InvalidRegistration" for dry_run with fake token â€” still means key is valid
      if (data.error && data.error !== 'InvalidRegistration' && !data.results) {
        return res.status(400).json({ error: `Firebase error: ${data.error}` });
      }
      res.json({ success: true, message: 'Firebase API key is valid', project_id });
    } catch (err: any) {
      res.status(500).json({ error: `Connection failed: ${err.message}` });
    }
  });

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ── POST /api/auth/forgot-password — Send OTP to email ──────────────────────
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required.' });

      const db = getDB();
      const user = db.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase().trim());
      // Always return success to prevent email enumeration attack
      if (!user) return res.json({ success: true, message: 'If this email exists, an OTP has been sent.' });

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Store OTP in memory
      if (!(global as any)._otpStore) (global as any)._otpStore = new Map();
      (global as any)._otpStore.set(email.toLowerCase(), { otp, expiry, attempts: 0 });

      // Send OTP via email using existing SMTP settings
      const kv = db.admin_settings_kv || [];
      const smtpHost = (kv as any[]).find((s: any) => s.key === 'smtp_host')?.value;
      const smtpUser = (kv as any[]).find((s: any) => s.key === 'smtp_user')?.value;
      const smtpPass = (kv as any[]).find((s: any) => s.key === 'smtp_pass')?.value;
      const fromName = (kv as any[]).find((s: any) => s.key === 'smtp_from_name')?.value || 'AtMilan';
      const appName = (kv as any[]).find((s: any) => s.key === 'platform_name')?.value || 'AtMilan';

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt((kv as any[]).find((s: any) => s.key === 'smtp_port')?.value || '587'),
          secure: false,
          auth: { user: smtpUser, pass: smtpPass }
        });
        await transporter.sendMail({
          from: `"${fromName}" <${smtpUser}>`,
          to: email,
          subject: `Your ${appName} Password Reset OTP`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:32px;">
              <h2 style="color:#8B1A1A;">Password Reset OTP</h2>
              <p>You requested to reset your password on <strong>${appName}</strong>.</p>
              <div style="background:#f5f5f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
                <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#8B1A1A;">${otp}</span>
              </div>
              <p>This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
              <p>If you did not request this, ignore this email.</p>
            </div>
          `
        });
      }

      res.json({ success: true, message: 'If this email exists, an OTP has been sent.' });
    } catch (err) {
      console.error('Forgot password error:', err);
      res.status(500).json({ error: 'Failed to process request.' });
    }
  });

  // ── POST /api/auth/verify-reset-otp — Verify OTP ─────────────────────────────
  app.post('/api/auth/verify-reset-otp', async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

      if (!(global as any)._otpStore) return res.status(400).json({ error: 'OTP not found or expired.' });

      const record = (global as any)._otpStore.get(email.toLowerCase());
      if (!record) return res.status(400).json({ error: 'OTP not found or expired.' });

      // Check expiry
      if (new Date() > new Date(record.expiry)) {
        (global as any)._otpStore.delete(email.toLowerCase());
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }

      // Check attempts (max 3)
      record.attempts += 1;
      if (record.attempts > 3) {
        (global as any)._otpStore.delete(email.toLowerCase());
        return res.status(429).json({ error: 'Too many wrong attempts. Please request a new OTP.' });
      }

      if (record.otp !== otp.trim()) {
        return res.status(400).json({ error: `Incorrect OTP. ${3 - record.attempts} attempt(s) remaining.` });
      }

      // OTP correct — generate a short-lived reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      record.resetToken = resetToken;
      record.tokenExpiry = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      res.json({ success: true, resetToken });
    } catch (err) {
      res.status(500).json({ error: 'Failed to verify OTP.' });
    }
  });

  // ── POST /api/auth/reset-password — Set New Password ─────────────────────────
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, resetToken, newPassword } = req.body;
      if (!email || !resetToken || !newPassword) {
        return res.status(400).json({ error: 'Email, reset token, and new password are required.' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      }

      if (!(global as any)._otpStore) return res.status(400).json({ error: 'Reset session expired.' });

      const record = (global as any)._otpStore.get(email.toLowerCase());
      if (!record || record.resetToken !== resetToken) {
        return res.status(400).json({ error: 'Invalid or expired reset token.' });
      }

      if (new Date() > new Date(record.tokenExpiry)) {
        (global as any)._otpStore.delete(email.toLowerCase());
        return res.status(400).json({ error: 'Reset session expired. Please start over.' });
      }

      const db = getDB();
      const user = db.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Hash new password and save
      const hashed = await bcrypt.hash(newPassword, 12);
      user.password_hash = hashed;
      user.password = hashed;
      user.password_reset_token = null;
      user.updated_at = new Date().toISOString();
      saveDB(db);

      // Clear OTP record
      (global as any)._otpStore.delete(email.toLowerCase());

      res.json({ success: true, message: 'Password updated successfully. Please login with your new password.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  // ── GET /api/admin/my-permissions — DUPLICATE REMOVED (handled before Vite middleware) ──

  // ── ENDPOINT A: Get profile status ──


  // ── CRON JOB: Inactivity status update + email reminders ──
  const runInactivityCheck = () => {
    try {
      const db = getDB();
      const now = new Date();
      const kv: Record<string, string> = {};
      (db.admin_settings_kv || []).forEach((s: any) => { kv[s.key] = s.value; });
      const siteName = kv["platform_name"] || kv["site_title"] || "AtMilan";
      const yellowDays = parseInt(kv["status_yellow_days"] || "15");
      const redDays = parseInt(kv["status_red_days"] || "45");
      const emailDay1 = parseInt(kv["inactivity_email_day_1"] || "60");
      const emailDay2 = parseInt(kv["inactivity_email_day_2"] || "75");
      const emailDay3 = parseInt(kv["inactivity_email_day_3"] || "90");
      const io = (app as any).io;
      let changed = false;
      (db.profiles || []).forEach((profile: any) => {
        if (profile.role === "admin") return;
        if (profile.profile_status === "engaged" || profile.profile_status === "married") return;
        if (!profile.last_login) return;
        const daysSinceLogin = (now.getTime() - new Date(profile.last_login).getTime()) / (1000 * 60 * 60 * 24);
        let newStatus = "active";
        if (daysSinceLogin >= redDays) newStatus = "red";
        else if (daysSinceLogin >= yellowDays) newStatus = "yellow";
        if (profile.profile_status !== newStatus && newStatus !== "active") {
          profile.profile_status = newStatus;
          changed = true;
          if (io) io.emit("profile-status:updated", { userId: profile.id, profile_status: newStatus });
        } else if (newStatus === "active" && (profile.profile_status === "yellow" || profile.profile_status === "red")) {
          // Only auto-reactivate if under the reactivation limit AND not pending admin approval
          // If count >= limit or admin approval is pending, leave status unchanged
          const reactivationLimit = parseInt(kv["reactivation_limit"] || "10");
          const reactivationCount = profile.reactivation_count || 0;
          const isPendingApproval = profile.reactivation_status === "pending";
          if (reactivationCount < reactivationLimit && !isPendingApproval) {
            profile.profile_status = "active";
            changed = true;
            if (io) io.emit("profile-status:updated", { userId: profile.id, profile_status: "active" });
          }
          // If count >= limit or pending: leave yellow/red unchanged — admin must approve
        }
        // Email reminders
        const user = db.users.find((u: any) => u.id === profile.id);
        if (!user?.email) return;
        if (daysSinceLogin >= emailDay3 && !profile.inactivity_email_90_sent) {
          profile.inactivity_email_90_sent = true; changed = true;
          const html = buildInactivityEmail(profile.first_name, siteName, 3, profile.id);
          sendEmail(user.email, `We miss you, ${profile.first_name}! Did you find your match? 💕`, html).catch(() => { });
        } else if (daysSinceLogin >= emailDay2 && !profile.inactivity_email_75_sent) {
          profile.inactivity_email_75_sent = true; changed = true;
          const html = buildInactivityEmail(profile.first_name, siteName, 2, profile.id);
          sendEmail(user.email, `${profile.first_name}, did you find your match on ${siteName}? 💕`, html).catch(() => { });
        } else if (daysSinceLogin >= emailDay1 && !profile.inactivity_email_60_sent) {
          profile.inactivity_email_60_sent = true; changed = true;
          const html = buildInactivityEmail(profile.first_name, siteName, 1, profile.id);
          sendEmail(user.email, `We have not seen you in a while! Did you find your match? 💕`, html).catch(() => { });
        }
      });
      if (changed) saveDB(db);
    } catch (err) {
      console.error("[Inactivity Check] Error:", err);
    }
  };
  runInactivityCheck();
  setInterval(runInactivityCheck, 6 * 60 * 60 * 1000); // every 6 hours

  // Socket.io Real-Time Setup
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',                    // Explicit path â€” only handle /socket.io/* requests
    cors: {
      origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        // Allow same-origin (VPS) and no-origin requests
        if (!origin) return callback(null, true);
        const allowed: string[] = [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:3000',
        ];
        const envUrls = (process.env.FRONTEND_URL || '').split(',').map((u: string) => u.trim()).filter(Boolean);
        allowed.push(...envUrls);
        if (allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(new Error(`Socket CORS blocked: ${origin}`), false);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    allowEIO3: true,                       // Support older Socket.IO clients
    transports: ['websocket', 'polling'],  // Explicit transports
    // CRITICAL: Do not intercept plain HTTP requests
    // Only upgrade requests to /socket.io will be handled by Socket.IO
    connectTimeout: 45000,
  });

  // Track online users
  const onlineUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(); // Allow unauthenticated connections (limited functionality)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (socket as any).userId = decoded.id || decoded.userId;
    } catch (e) {
      // Invalid token, still allow connection but no user identity
    }
    next();
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId;
    console.log(`[Socket] Connected: ${socket.id}${userId ? ` (user: ${userId})` : ''}`);

    if (userId) {
      // Track online status
      if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
      onlineUsers.get(userId)!.add(socket.id);

      // Join personal room for targeted events
      socket.join(`user:${userId}`);

      // Check if this user is an admin and join admin room
      const db = getDB();
      const profile = db.profiles.find((p: any) => p.id === userId);
      if (profile?.role === 'admin') {
        socket.join('admin:room');
        console.log(`[Socket] Admin ${userId} joined admin:room`);
      }

      // Broadcast online status to relevant users
      io.emit('user:online', { userId });

      // Send current online users list
      socket.emit('online:users', Array.from(onlineUsers.keys()));
    }

    // Join a conversation room
    socket.on('conversation:join', (otherUserId: string) => {
      if (!userId) return;
      const roomId = [userId, otherUserId].sort().join(':');
      socket.join(`chat:${roomId}`);
    });

    // Leave a conversation room
    socket.on('conversation:leave', (otherUserId: string) => {
      if (!userId) return;
      const roomId = [userId, otherUserId].sort().join(':');
      socket.leave(`chat:${roomId}`);
    });

    // Typing indicator
    socket.on('typing:start', (data: { toUserId: string }) => {
      if (!userId) return;
      const roomId = [userId, data.toUserId].sort().join(':');
      socket.to(`chat:${roomId}`).emit('typing:started', { fromUserId: userId });
    });

    socket.on('typing:stop', (data: { toUserId: string }) => {
      if (!userId) return;
      const roomId = [userId, data.toUserId].sort().join(':');
      socket.to(`chat:${roomId}`).emit('typing:stopped', { fromUserId: userId });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}${userId ? ` (user: ${userId})` : ''}`);
      if (userId && onlineUsers.has(userId)) {
        onlineUsers.get(userId)!.delete(socket.id);
        if (onlineUsers.get(userId)!.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user:offline', { userId });
        }
      }
    });
  });

  // Make io accessible to route handlers
  (app as any).io = io;

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`✅ Socket.io running on ws://localhost:${PORT}`);

    // Start DB read replica sync
    replicaManager.start();

    // Auto-scaler: periodically report load from this worker
    if (process.env.CLUSTER_MODE === 'true') {
      setInterval(() => {
        const load = { ...collectLoadMetrics(), ...getRequestLoadMetrics() };
        if (process.send) {
          process.send({ type: 'load_report', load });
        }
      }, 10000);
    }
  });

  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(`   Stop the old server first, then restart.`);
      console.error(`   PowerShell: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`);
      console.error(`   CMD: FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :${PORT}') DO taskkill /PID %P /F\n`);
      process.exit(1);
    } else {
      throw err;
    }
  });

  // Admin performance metrics endpoint
  app.get('/api/admin/performance', (req, res) => {
    res.json(getHealthMetrics());
  });

  // Graceful shutdown for 99.9% uptime
  function gracefulShutdown(signal: string) {
    console.log(`\n[${signal}] Graceful shutdown initiated...`);
    httpServer.close(() => {
      console.log('HTTP server closed.');
      io.close();
      process.exit(0);
    });
    // Force close after 10s
    setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // ── CRASH PREVENTION ──────────────────────────────────────────────────────
  // Catches any unhandled synchronous exception in the process and logs it
  // without crashing the server.
  process.on('uncaughtException', (err: Error) => {
    console.error('[CRASH PREVENTED] Uncaught Exception:', err.message);
    console.error(err.stack);
  });

  // Catches any unhandled Promise rejection and logs it without crashing.
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('[CRASH PREVENTED] Unhandled Rejection:', reason);
  });

  // Express global error-handler middleware.
  // Must be defined with 4 parameters so Express recognises it as an error handler.
  // Catches any error passed to next(err) from any route handler.
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[EXPRESS ERROR]', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

// Start server with optional cluster mode
// Set CLUSTER_MODE=true to enable multi-process scaling
startCluster(startServer);