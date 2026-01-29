import express from 'express';
import crypto from 'crypto';
import { MessageQueue } from '../workers/messageQueue.js';

const router = express.Router();

// Verify webhook signature
function verifyWebhook(req, res, next) {
  const signature = req.headers['x-webhook-signature'];
  const secret = process.env.WEBHOOK_SECRET || 'burhan2ws-webhook-secret';

  if (!signature) {
    return res.status(401).json({ success: false, error: 'Missing signature' });
  }

  const body = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  next();
}

// Send message via webhook
router.post('/send', verifyWebhook, async (req, res) => {
  try {
    const { sessionId, to, content, type = 'text' } = req.body;

    if (!sessionId || !to || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, to, content'
      });
    }

    const messageQueue = new MessageQueue();
    const job = await messageQueue.addSendMessageJob({
      sessionId,
      to,
      content,
      type
    });

    res.status(202).json({
      success: true,
      data: { jobId: job.id, message: 'Message queued' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send media via webhook
router.post('/send-media', verifyWebhook, async (req, res) => {
  try {
    const { sessionId, to, mediaUrl, caption, type = 'image' } = req.body;

    if (!sessionId || !to || !mediaUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, to, mediaUrl'
      });
    }

    const messageQueue = new MessageQueue();
    const job = await messageQueue.addSendMediaJob({
      sessionId,
      to,
      mediaUrl,
      caption,
      type
    });

    res.status(202).json({
      success: true,
      data: { jobId: job.id, message: 'Media queued' }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send broadcast message
router.post('/broadcast', verifyWebhook, async (req, res) => {
  try {
    const { sessionId, contacts, content, type = 'text' } = req.body;

    if (!sessionId || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, contacts (array)'
      });
    }

    const messageQueue = new MessageQueue();
    const jobs = [];

    for (const contact of contacts) {
      const job = await messageQueue.addSendMessageJob({
        sessionId,
        to: contact,
        content,
        type
      });
      jobs.push(job.id);
    }

    res.status(202).json({
      success: true,
      data: { jobIds: jobs, count: jobs.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Webhook health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'active',
    timestamp: new Date().toISOString()
  });
});

// Get webhook info
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      endpoints: {
        send: 'POST /api/webhook/send',
        sendMedia: 'POST /api/webhook/send-media',
        broadcast: 'POST /api/webhook/broadcast',
        health: 'GET /api/webhook/health'
      },
      headers: {
        'x-webhook-signature': 'HMAC-SHA256 of request body'
      }
    }
  });
});

export default router;
