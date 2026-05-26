import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const DB_FILE = './database.json';
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

const testEmail = 'girl@test.com';
if (!db.users.find((u: any) => u.email === testEmail)) {
  const id = 'test-girl-user';
  const hashedPassword = bcrypt.hashSync('123456', 10);
  
  db.users.push({ id, email: testEmail, password: hashedPassword, role: 'user', created_at: new Date().toISOString() });
  
  db.profiles.push({
    id,
    profile_for: 'Myself',
    first_name: 'Priya',
    last_name: 'Patel',
    gender: 'Female',
    date_of_birth: '1998-05-15',
    marital_status: 'never_married',
    religion: 'Hindu',
    caste: 'Lohana',
    mother_tongue: 'Gujarati',
    height_cm: 165,
    weight_kg: 55,
    body_type: 'slim',
    complexion: 'fair',
    physical_disability: false,
    about_me: 'I am a pre-verified test user (Female).',
    profile_photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=500&fit=crop',
    profile_completion: 100,
    is_verified: true,
    is_active: true,
    role: 'user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  console.log('Added Priya Patel (girl@test.com / 123456) to database.');
} else {
  console.log('Priya Patel already exists.');
}
