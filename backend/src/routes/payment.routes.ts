import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { apiLimiter } from '../middleware/rateLimit';
import {
  getActiveGateway,
  createOrder,
  verifyPayment,
  checkout,
} from '../controllers/payment.controller';

const router = Router();

// GET  /api/payment-gateways/active  — public, no auth needed
// (mounted at /api/payment-gateways in server.ts)
export const gatewayRouter = Router();
gatewayRouter.get('/active', apiLimiter, getActiveGateway);

// POST /api/payment/create-order
router.post('/create-order', authenticateToken, apiLimiter, createOrder);

// POST /api/payment/verify
router.post('/verify', authenticateToken, apiLimiter, verifyPayment);

// POST /api/checkout
export const checkoutRouter = Router();
checkoutRouter.post('/', authenticateToken, apiLimiter, checkout);

export default router;
