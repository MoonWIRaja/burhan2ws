import express from 'express';
import {
  getFiles,
  getFileById,
  deleteFileById
} from '../controllers/fileController.js';

const router = express.Router();

// Get files for a session
router.get('/:sessionId', getFiles);

// Get file by ID
router.get('/info/:id', getFileById);

// Delete file
router.delete('/:id', deleteFileById);

export default router;
