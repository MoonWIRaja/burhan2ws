import express from 'express';
import {
  getMessages,
  sendMessage,
  getMessageStats
} from '../controllers/messageController.js';

const router = express.Router();

// Get messages for a session
router.get('/:sessionId', getMessages);

// Send message
router.post('/:sessionId/send', sendMessage);

// Get message stats
router.get('/:sessionId/stats', getMessageStats);

export default router;
