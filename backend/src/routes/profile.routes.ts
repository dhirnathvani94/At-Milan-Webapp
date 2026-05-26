import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import {
  getProfileById,
  getProfileSection,
  updateProfileSection,
  updateProfile,
  completeProfile,
  getProfilePhotos,
  uploadPhoto,
  uploadDocument,
  deletePhoto,
  setProfilePhoto,
  getProfileViews,
  recordProfileView,
  getMyProfile,
} from '../controllers/profile.controller';

const router = Router();

// ─── Own profile ──────────────────────────────────────────────────────────────

// GET /api/profiles/me
router.get('/me', authenticateToken, getMyProfile);

// ─── Public profile view ──────────────────────────────────────────────────────

// GET /api/profiles/:id
router.get('/:id', optionalAuth, getProfileById);

// ─── Profile sections — read ──────────────────────────────────────────────────

// GET /api/profiles/:id/personal
router.get('/:id/personal',     authenticateToken, getProfileSection('personal'));

// GET /api/profiles/:id/education
router.get('/:id/education',    authenticateToken, getProfileSection('education'));

// GET /api/profiles/:id/family
router.get('/:id/family',       authenticateToken, getProfileSection('family'));

// GET /api/profiles/:id/lifestyle
router.get('/:id/lifestyle',    authenticateToken, getProfileSection('lifestyle'));

// GET /api/profiles/:id/horoscope
router.get('/:id/horoscope',    authenticateToken, getProfileSection('horoscope'));

// GET /api/profiles/:id/preferences
router.get('/:id/preferences',  authenticateToken, getProfileSection('preferences'));

// ─── Profile sections — write ─────────────────────────────────────────────────

// POST /api/profiles/:id/personal
router.post('/:id/personal',    authenticateToken, updateProfileSection('personal'));

// POST /api/profiles/:id/education
router.post('/:id/education',   authenticateToken, updateProfileSection('education'));

// POST /api/profiles/:id/family
router.post('/:id/family',      authenticateToken, updateProfileSection('family'));

// POST /api/profiles/:id/lifestyle
router.post('/:id/lifestyle',   authenticateToken, updateProfileSection('lifestyle'));

// POST /api/profiles/:id/horoscope
router.post('/:id/horoscope',   authenticateToken, updateProfileSection('horoscope'));

// POST /api/profiles/:id/preferences
router.post('/:id/preferences', authenticateToken, updateProfileSection('preferences'));

// ─── Profile complete ─────────────────────────────────────────────────────────

// POST /api/profiles/:id/complete
router.post('/:id/complete', authenticateToken, completeProfile);

// ─── Full profile update ──────────────────────────────────────────────────────

// PATCH /api/profiles/:id
router.patch('/:id', authenticateToken, updateProfile);

// ─── Photos ───────────────────────────────────────────────────────────────────

// GET /api/profiles/:id/photos
router.get('/:id/photos', optionalAuth, getProfilePhotos);

// POST /api/profiles/:id/photos/:photoId/set-profile
router.post('/:id/photos/:photoId/set-profile', authenticateToken, setProfilePhoto);

export default router;
