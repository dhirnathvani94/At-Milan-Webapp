import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import {
  searchProfiles,
  searchSuggest,
  getRecommendations,
  getNewMembers,
} from '../controllers/search.controller';

// ─── /api/search ──────────────────────────────────────────────────────────────
export const searchRouter = Router();

// GET /api/search
searchRouter.get('/', optionalAuth, apiLimiter, searchProfiles);

// GET /api/search/suggest
searchRouter.get('/suggest', optionalAuth, searchSuggest);

// ─── /api/recommendations ─────────────────────────────────────────────────────
export const recommendationsRouter = Router();

// GET /api/recommendations
recommendationsRouter.get('/', authenticateToken, getRecommendations);

// ─── /api/new-members ─────────────────────────────────────────────────────────
export const newMembersRouter = Router();

// GET /api/new-members
newMembersRouter.get('/', optionalAuth, getNewMembers);
