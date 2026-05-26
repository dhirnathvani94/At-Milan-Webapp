import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimit';
import {
  uploadPhoto,
  uploadDocument,
  deletePhoto,
  getProfileViews,
  recordProfileView,
} from '../controllers/profile.controller';

const router = Router();

// ─── Photo upload ─────────────────────────────────────────────────────────────

// POST /api/upload/photo
router.post('/photo', authenticateToken, uploadLimiter, uploadPhoto);

// ─── Document upload ──────────────────────────────────────────────────────────

// POST /api/upload
router.post('/', authenticateToken, uploadLimiter, uploadDocument);

// ─── Delete photo ─────────────────────────────────────────────────────────────

// DELETE /api/photos/:photoId
// (mounted at /api/photos in server.ts)
export const photosRouter = Router();
photosRouter.delete('/:photoId', authenticateToken, deletePhoto);

// ─── Profile views ────────────────────────────────────────────────────────────

// (mounted at /api/profile-views in server.ts)
export const profileViewsRouter = Router();

// GET /api/profile-views?userId=xxx  OR  GET /api/profile-views/:userId
profileViewsRouter.get('/',         authenticateToken, getProfileViews);
profileViewsRouter.get('/:userId',  authenticateToken, getProfileViews);

// POST /api/profile-views
profileViewsRouter.post('/', optionalAuth, recordProfileView);

export default router;
