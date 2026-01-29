import express from 'express';
import multer from 'multer';
import {
  getSessions,
  getSessionById,
  createNewSession,
  disconnectSessionById,
  getSessionStats
} from '../controllers/sessionController.js';

const router = express.Router();

// Get all sessions
router.get('/', getSessions);

// Get session statistics
router.get('/stats', getSessionStats);

// Create new session
router.post('/', createNewSession);

// Get single session
router.get('/:id', getSessionById);

// Disconnect session
router.delete('/:id', disconnectSessionById);

export default router;
