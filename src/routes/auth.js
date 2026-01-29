import express from 'express';
import {
  register,
  login,
  getProfile
} from '../controllers/authController.js';

const router = express.Router();

// Register new user
router.post('/register', register);

// Login
router.post('/login', login);

// Get current user profile (protected)
router.get('/profile', getProfile);

export default router;
