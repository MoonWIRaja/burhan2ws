import express from 'express';
import authRoutes from './auth.js';
import sessionRoutes from './sessions.js';
import messageRoutes from './messages.js';
import fileRoutes from './files.js';
import uploadRoutes from './uploads.js';
import statsRoutes from './stats.js';
import blastRoutes from './blast.js';
import botRoutes from './bot.js';
import contactRoutes from './contacts.js';

const router = express.Router();

// Public routes (no authentication required)
router.use('/auth', authRoutes);

// Protected routes (authentication required)
router.use('/sessions', sessionRoutes);
router.use('/messages', messageRoutes);
router.use('/files', fileRoutes);
router.use('/uploads', uploadRoutes);
router.use('/stats', statsRoutes);
router.use('/blast', blastRoutes);
router.use('/bot', botRoutes);
router.use('/contacts', contactRoutes);

export default router;
