import express from 'express';
import {
  createBlast,
  getBlastStatus,
  getBlasts,
  cancelBlast,
  quickSend,
} from '../controllers/blastController.js';

const router = express.Router();

// Create new blast campaign
router.post('/', createBlast);

// Get all blast campaigns
router.get('/', getBlasts);

// Get blast status
router.get('/status/:jobId', getBlastStatus);

// Cancel blast
router.delete('/:jobId', cancelBlast);

// Quick send to multiple numbers
router.post('/quick-send', quickSend);

export default router;
