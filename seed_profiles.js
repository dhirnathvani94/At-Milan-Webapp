import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const DB_FILE = './database.json';

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

const passwordHash = bcrypt.hashSync('Demo@1234', 10);

const profiles = [
  {
    id: uuidv4(),
    email: 'yellow@demo.com',
    password: passwordHash,
    first_name: 'Yellow',
    last_name: 'Demo',
    role: 'user',
    status: 'yellow',
    is_verified: true,
    email_verified: true,
    match_confirmed: false,
    profile_completion: 100,
    created_at: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString() // 16 days ago
  },
  {
    id: uuidv4(),
    email: 'red@demo.com',
    password: passwordHash,
    first_name: 'Red',
    last_name: 'Demo',
    role: 'user',
    status: 'red',
    is_verified: true,
    email_verified: true,
    match_confirmed: false,
    profile_completion: 100,
    created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString() // 31 days ago
  },
  {
    id: uuidv4(),
    email: 'engaged@demo.com',
    password: passwordHash,
    first_name: 'Engaged',
    last_name: 'Demo',
    role: 'user',
    status: 'engaged',
    is_verified: true,
    email_verified: true,
    match_confirmed: true,
    profile_completion: 100,
    created_at: new Date().toISOString()
  }
];

// Add to db
if (!db.users) db.users = [];

profiles.forEach(p => {
  // Only add if not already exists
  if (!db.users.find(u => u.email === p.email)) {
    db.users.push(p);
  }
});

// Also add default email template and settings if not present
if (!db.admin_settings_kv) db.admin_settings_kv = [];

const defaultSettings = [
  { key: 'yellow_status_days', value: '15' },
  { key: 'red_status_days', value: '30' },
  { key: 'match_mail_days_1', value: '60' },
  { key: 'match_mail_days_2', value: '75' },
  { key: 'match_mail_days_3', value: '90' },
  { 
    key: 'email_template_match_confirmation', 
    value: 'Hi {{name}},<br><br>You have been with us for a while. Have you found your match?<br><br>Please confirm by clicking here: <a href="{{link}}">Confirm Match</a><br><br>Thanks,<br>{{site_name}} Team'
  }
];

defaultSettings.forEach(setting => {
  if (!db.admin_settings_kv.find(s => s.key === setting.key)) {
    db.admin_settings_kv.push(setting);
  }
});

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

console.log('Dummy profiles and settings added successfully!');
console.log('Test Link: http://localhost:5173/match-confirmation');
