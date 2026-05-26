import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { getDB, saveDB } from '../db/database';

// ─── Internal types ───────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
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
  // Personal
  religion?: string;
  caste?: string;
  sub_caste?: string;
  mother_tongue?: string;
  marital_status?: string;
  about_me?: string;
  height?: string;
  weight?: string;
  body_type?: string;
  complexion?: string;
  blood_group?: string;
  // Education
  education_level?: string;
  education_detail?: string;
  occupation?: string;
  occupation_detail?: string;
  annual_income?: string;
  // Family
  father_name?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_occupation?: string;
  siblings?: string;
  family_type?: string;
  family_status?: string;
  family_values?: string;
  // Lifestyle
  diet?: string;
  smoking?: string;
  drinking?: string;
  hobbies?: string[];
  languages?: string[];
  // Horoscope
  gotra?: string;
  nakshatra?: string;
  raashi?: string;
  manglik?: string;
  birth_time?: string;
  birth_place?: string;
  // Preferences
  pref_age_min?: number;
  pref_age_max?: number;
  pref_height_min?: string;
  pref_height_max?: string;
  pref_religion?: string;
  pref_caste?: string;
  pref_education?: string;
  pref_occupation?: string;
  pref_income?: string;
  pref_marital_status?: string;
  pref_diet?: string;
  pref_location?: string;
  pref_about?: string;
  // Location
  country?: string;
  state?: string;
  city?: string;
  // Meta
  profile_photo?: string | null;
  photos?: PhotoRow[];
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface PhotoRow {
  id: string;
  user_id: string;
  filename: string;
  url: string;
  is_profile_photo: boolean;
  created_at: string;
}

interface ProfileViewRow {
  id: string;
  viewer_id: string | null;
  viewed_id: string;
  viewed_at: string;
}

interface CreditRow {
  id: string;
  user_id: string;
  balance: number;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'
  );
}

/** Strip password and sensitive auth fields before returning user data */
function safeUser(user: UserRow) {
  const {
    password_hash,
    email_verify_token,
    password_reset_token,
    login_attempts,
    login_locked_until,
    ...safe
  } = user as UserRow & Record<string, unknown>;
  return safe;
}

/** Check if a user has an active premium/membership */
async function isPremiumUser(userId: string): Promise<boolean> {
  const db = await getDB();
  const purchases = db.purchases as Array<{
    user_id: string;
    type: string;
    status: string;
    expires_at: string;
  }>;
  return purchases.some(
    (p) =>
      p.user_id === userId &&
      p.status === 'active' &&
      p.type === 'membership' &&
      new Date(p.expires_at) > new Date()
  );
}

/** Hide contact details for non-premium / unauthenticated viewers */
function stripContactDetails(profile: ProfileRow): ProfileRow {
  const stripped = { ...profile };
  stripped.phone = null;
  return stripped;
}

// ─── Multer config for photo uploads ─────────────────────────────────────────

const PHOTOS_DIR = path.resolve(__dirname, '../../uploads/photos');
const DOCS_DIR   = path.resolve(__dirname, '../../uploads/documents');

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const photoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    cb(null, PHOTOS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: MAX_PHOTO_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp).'));
    }
  },
}).single('photo');

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
    cb(null, DOCS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const documentUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, images, and Word documents are allowed.'));
    }
  },
}).single('document');

// ─── getMyProfile ─────────────────────────────────────────────────────────────

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const db = await getDB();

    const user = (db.users as UserRow[]).find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    const profile = (db.profiles as ProfileRow[]).find((p) => p.user_id === userId);
    const credits = (db.credits as CreditRow[]).find((c) => c.user_id === userId);
    const photos  = (db.documents as PhotoRow[]).filter(
      (d) => (d as unknown as { user_id: string; type: string }).user_id === userId &&
             (d as unknown as { type: string }).type === 'photo'
    );

    res.status(200).json({
      success: true,
      user: safeUser(user),
      profile: profile ?? null,
      credits: credits ? { balance: credits.balance } : { balance: 0 },
      photos,
    });
  } catch (err) {
    console.error('[Profile] getMyProfile error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch profile.' });
  }
}

// ─── getProfileById ───────────────────────────────────────────────────────────

export async function getProfileById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id ?? null;

    const db = await getDB();
    const user = (db.users as UserRow[]).find((u) => u.id === id);

    if (!user || !user.is_active) {
      res.status(404).json({ success: false, error: 'Profile not found.' });
      return;
    }

    let profile = (db.profiles as ProfileRow[]).find((p) => p.user_id === id);
    if (!profile) {
      res.status(404).json({ success: false, error: 'Profile not found.' });
      return;
    }

    // Record profile view (skip self-views)
    if (viewerId && viewerId !== id) {
      const view: ProfileViewRow = {
        id: uuidv4(),
        viewer_id: viewerId,
        viewed_id: id,
        viewed_at: new Date().toISOString(),
      };
      (db.profile_views as ProfileViewRow[]).push(view);
      saveDB(db);
    }

    // Hide contact details based on auth/premium status
    const isOwner   = viewerId === id;
    const isPremium = viewerId ? await isPremiumUser(viewerId) : false;
    const isAdmin   = req.user?.role === 'admin';

    if (!isOwner && !isPremium && !isAdmin) {
      profile = stripContactDetails(profile);
    }

    // Never return email/password from user row to other users
    const publicUser = isOwner || isAdmin
      ? safeUser(user)
      : { id: user.id, gender: user.role === 'admin' ? undefined : undefined };

    res.status(200).json({
      success: true,
      user: publicUser,
      profile,
    });
  } catch (err) {
    console.error('[Profile] getProfileById error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch profile.' });
  }
}

// ─── updateProfile ────────────────────────────────────────────────────────────

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Only owner or admin can update
    if (userId !== id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'You can only update your own profile.' });
      return;
    }

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    const idx = profiles.findIndex((p) => p.user_id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Profile not found.' });
      return;
    }

    // Whitelist of updatable fields — never allow id, user_id, is_verified, created_at
    const FORBIDDEN = new Set(['id', 'user_id', 'is_verified', 'created_at', 'profile_complete']);
    const updates: Partial<ProfileRow> = {};

    for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
      if (!FORBIDDEN.has(key)) {
        (updates as Record<string, unknown>)[key] = value;
      }
    }

    profiles[idx] = {
      ...profiles[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    saveDB(db);

    res.status(200).json({ success: true, profile: profiles[idx] });
  } catch (err) {
    console.error('[Profile] updateProfile error:', err);
    res.status(500).json({ success: false, error: 'Could not update profile.' });
  }
}

// ─── Section field maps ───────────────────────────────────────────────────────

type SectionName = 'personal' | 'education' | 'family' | 'lifestyle' | 'horoscope' | 'preferences';

const SECTION_FIELDS: Record<SectionName, string[]> = {
  personal: [
    'first_name', 'last_name', 'gender', 'date_of_birth', 'phone',
    'religion', 'caste', 'sub_caste', 'mother_tongue', 'marital_status',
    'about_me', 'height', 'weight', 'body_type', 'complexion', 'blood_group',
    'country', 'state', 'city',
  ],
  education: [
    'education_level', 'education_detail', 'occupation', 'occupation_detail', 'annual_income',
  ],
  family: [
    'father_name', 'father_occupation', 'mother_name', 'mother_occupation',
    'siblings', 'family_type', 'family_status', 'family_values',
  ],
  lifestyle: ['diet', 'smoking', 'drinking', 'hobbies', 'languages'],
  horoscope: ['gotra', 'nakshatra', 'raashi', 'manglik', 'birth_time', 'birth_place'],
  preferences: [
    'pref_age_min', 'pref_age_max', 'pref_height_min', 'pref_height_max',
    'pref_religion', 'pref_caste', 'pref_education', 'pref_occupation',
    'pref_income', 'pref_marital_status', 'pref_diet', 'pref_location', 'pref_about',
  ],
};

// ─── getProfileSection ────────────────────────────────────────────────────────

export function getProfileSection(section: SectionName) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      if (userId !== id && req.user!.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Access denied.' });
        return;
      }

      const db = await getDB();
      const profile = (db.profiles as ProfileRow[]).find((p) => p.user_id === id);

      if (!profile) {
        res.status(404).json({ success: false, error: 'Profile not found.' });
        return;
      }

      const fields = SECTION_FIELDS[section];
      const sectionData: Record<string, unknown> = {};
      for (const field of fields) {
        sectionData[field] = (profile as Record<string, unknown>)[field] ?? null;
      }

      res.status(200).json({ success: true, section, data: sectionData });
    } catch (err) {
      console.error(`[Profile] getProfileSection(${section}) error:`, err);
      res.status(500).json({ success: false, error: 'Could not fetch section.' });
    }
  };
}

// ─── updateProfileSection ─────────────────────────────────────────────────────

export function updateProfileSection(section: SectionName) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      if (userId !== id && req.user!.role !== 'admin') {
        res.status(403).json({ success: false, error: 'You can only update your own profile.' });
        return;
      }

      const db = await getDB();
      const profiles = db.profiles as ProfileRow[];
      const idx = profiles.findIndex((p) => p.user_id === id);

      if (idx === -1) {
        res.status(404).json({ success: false, error: 'Profile not found.' });
        return;
      }

      const allowedFields = new Set(SECTION_FIELDS[section]);
      const updates: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(req.body as Record<string, unknown>)) {
        if (allowedFields.has(key)) {
          updates[key] = value;
        }
      }

      profiles[idx] = {
        ...profiles[idx],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      saveDB(db);

      res.status(200).json({ success: true, section, profile: profiles[idx] });
    } catch (err) {
      console.error(`[Profile] updateProfileSection(${section}) error:`, err);
      res.status(500).json({ success: false, error: 'Could not update section.' });
    }
  };
}

// ─── completeProfile ──────────────────────────────────────────────────────────

export async function completeProfile(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (userId !== id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db = await getDB();
    const profiles = db.profiles as ProfileRow[];
    const idx = profiles.findIndex((p) => p.user_id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Profile not found.' });
      return;
    }

    profiles[idx].profile_complete = true;
    profiles[idx].updated_at = new Date().toISOString();
    saveDB(db);

    res.status(200).json({ success: true, message: 'Profile marked as complete.', profile: profiles[idx] });
  } catch (err) {
    console.error('[Profile] completeProfile error:', err);
    res.status(500).json({ success: false, error: 'Could not complete profile.' });
  }
}

// ─── uploadPhoto ──────────────────────────────────────────────────────────────

export async function uploadPhoto(req: Request, res: Response): Promise<void> {
  photoUpload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ success: false, error: 'Photo must be under 5 MB.' });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: (err as Error).message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No photo file provided.' });
      return;
    }

    try {
      const userId = req.user!.id;
      const db = await getDB();

      const photo: PhotoRow = {
        id: uuidv4(),
        user_id: userId,
        filename: req.file.filename,
        url: `/uploads/photos/${req.file.filename}`,
        is_profile_photo: false,
        created_at: new Date().toISOString(),
      };

      // Store photos in documents table with type=photo
      (db.documents as unknown as Array<PhotoRow & { type: string }>).push({
        ...photo,
        type: 'photo',
      });
      saveDB(db);

      res.status(201).json({ success: true, photo });
    } catch (saveErr) {
      console.error('[Profile] uploadPhoto save error:', saveErr);
      res.status(500).json({ success: false, error: 'Could not save photo.' });
    }
  });
}

// ─── uploadDocument ───────────────────────────────────────────────────────────

export async function uploadDocument(req: Request, res: Response): Promise<void> {
  documentUpload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ success: false, error: 'Document must be under 10 MB.' });
        return;
      }
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, error: (err as Error).message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No document file provided.' });
      return;
    }

    try {
      const userId = req.user!.id;
      const docType = (req.body as { doc_type?: string }).doc_type ?? 'other';
      const db = await getDB();

      const doc = {
        id: uuidv4(),
        user_id: userId,
        type: docType,
        filename: req.file.filename,
        url: `/uploads/documents/${req.file.filename}`,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      (db.documents as unknown[]).push(doc);
      saveDB(db);

      res.status(201).json({ success: true, document: doc });
    } catch (saveErr) {
      console.error('[Profile] uploadDocument save error:', saveErr);
      res.status(500).json({ success: false, error: 'Could not save document.' });
    }
  });
}

// ─── deletePhoto ──────────────────────────────────────────────────────────────

export async function deletePhoto(req: Request, res: Response): Promise<void> {
  try {
    const { photoId } = req.params;
    const userId = req.user!.id;

    const db = await getDB();
    const docs = db.documents as unknown as Array<PhotoRow & { type: string; user_id: string }>;
    const idx = docs.findIndex((d) => d.id === photoId && d.type === 'photo');

    if (idx === -1) {
      res.status(404).json({ success: false, error: 'Photo not found.' });
      return;
    }

    const photo = docs[idx];

    // Only owner or admin can delete
    if (photo.user_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'You can only delete your own photos.' });
      return;
    }

    // Delete file from disk
    const filePath = path.join(PHOTOS_DIR, photo.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    docs.splice(idx, 1);
    saveDB(db);

    res.status(200).json({ success: true, message: 'Photo deleted.' });
  } catch (err) {
    console.error('[Profile] deletePhoto error:', err);
    res.status(500).json({ success: false, error: 'Could not delete photo.' });
  }
}

// ─── setProfilePhoto ──────────────────────────────────────────────────────────

export async function setProfilePhoto(req: Request, res: Response): Promise<void> {
  try {
    const { id, photoId } = req.params;
    const userId = req.user!.id;

    if (userId !== id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const db = await getDB();
    const docs = db.documents as unknown as Array<PhotoRow & { type: string; user_id: string }>;

    // Unset all current profile photos for this user
    docs.forEach((d) => {
      if (d.user_id === id && d.type === 'photo') {
        d.is_profile_photo = false;
      }
    });

    // Set the selected photo
    const photo = docs.find((d) => d.id === photoId && d.user_id === id && d.type === 'photo');
    if (!photo) {
      res.status(404).json({ success: false, error: 'Photo not found.' });
      return;
    }

    photo.is_profile_photo = true;

    // Update profile_photo field on profile
    const profiles = db.profiles as ProfileRow[];
    const profile = profiles.find((p) => p.user_id === id);
    if (profile) {
      profile.profile_photo = photo.url;
      profile.updated_at = new Date().toISOString();
    }

    saveDB(db);

    res.status(200).json({ success: true, message: 'Profile photo updated.', photo });
  } catch (err) {
    console.error('[Profile] setProfilePhoto error:', err);
    res.status(500).json({ success: false, error: 'Could not set profile photo.' });
  }
}

// ─── getProfilePhotos ─────────────────────────────────────────────────────────

export async function getProfilePhotos(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const db = await getDB();

    const photos = (db.documents as unknown as Array<PhotoRow & { type: string; user_id: string }>)
      .filter((d) => d.user_id === id && d.type === 'photo')
      .map(({ id, filename, url, is_profile_photo, created_at }) => ({
        id, filename, url, is_profile_photo, created_at,
      }));

    res.status(200).json({ success: true, photos });
  } catch (err) {
    console.error('[Profile] getProfilePhotos error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch photos.' });
  }
}

// ─── getProfileViews ──────────────────────────────────────────────────────────

export async function getProfileViews(req: Request, res: Response): Promise<void> {
  try {
    const requestedUserId =
      (req.params['userId'] as string | undefined) ??
      (req.query['userId'] as string | undefined) ??
      req.user!.id;

    // Only owner or admin can see who viewed their profile
    if (requestedUserId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    const page  = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt((req.query['limit'] as string) ?? '20', 10)));

    const db = await getDB();
    const views = (db.profile_views as ProfileViewRow[])
      .filter((v) => v.viewed_id === requestedUserId)
      .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());

    const total      = views.length;
    const totalPages = Math.ceil(total / limit);
    const data       = views.slice((page - 1) * limit, page * limit);

    // Enrich with viewer profile info
    const profiles = db.profiles as ProfileRow[];
    const enriched = data.map((v) => {
      const viewerProfile = v.viewer_id
        ? profiles.find((p) => p.user_id === v.viewer_id)
        : null;
      return {
        ...v,
        viewer: viewerProfile
          ? {
              id: viewerProfile.user_id,
              first_name: viewerProfile.first_name,
              last_name: viewerProfile.last_name,
              profile_photo: viewerProfile.profile_photo ?? null,
            }
          : null,
      };
    });

    res.status(200).json({ success: true, data: enriched, total, page, limit, totalPages });
  } catch (err) {
    console.error('[Profile] getProfileViews error:', err);
    res.status(500).json({ success: false, error: 'Could not fetch profile views.' });
  }
}

// ─── recordProfileView ────────────────────────────────────────────────────────

export async function recordProfileView(req: Request, res: Response): Promise<void> {
  try {
    const { viewed_id } = req.body as { viewed_id?: string };
    const viewerId = req.user?.id ?? null;

    if (!viewed_id) {
      res.status(400).json({ success: false, error: 'viewed_id is required.' });
      return;
    }

    // Skip self-views
    if (viewerId && viewerId === viewed_id) {
      res.status(200).json({ success: true });
      return;
    }

    const db = await getDB();
    const view: ProfileViewRow = {
      id: uuidv4(),
      viewer_id: viewerId,
      viewed_id,
      viewed_at: new Date().toISOString(),
    };

    (db.profile_views as ProfileViewRow[]).push(view);
    saveDB(db);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[Profile] recordProfileView error:', err);
    res.status(500).json({ success: false, error: 'Could not record view.' });
  }
}
