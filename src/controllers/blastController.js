import prisma from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Create blast campaign
export async function createBlast(req, res) {
  try {
    const { sessionId, name, recipients, message, scheduledFor } = req.body;

    if (!sessionId || !recipients || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, recipients, message',
      });
    }

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients must be a non-empty array',
      });
    }

    // Create job for blast
    const job = await prisma.job.create({
      data: {
        jobId: uuidv4(),
        type: 'blast',
        status: scheduledFor ? 'scheduled' : 'waiting',
        data: {
          sessionId,
          name: name || `Blast ${new Date().toISOString()}`,
          recipients,
          message,
          scheduledFor,
          totalRecipients: recipients.length,
          sentCount: 0,
          failedCount: 0,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        jobId: job.jobId,
        message: `Blast campaign created with ${recipients.length} recipients`,
      },
    });
  } catch (error) {
    console.error('Error creating blast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get blast status
export async function getBlastStatus(req, res) {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { jobId },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Blast campaign not found',
      });
    }

    res.json({
      success: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        data: job.data,
        result: job.result,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching blast status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get all blast campaigns
export async function getBlasts(req, res) {
  try {
    const { sessionId, status } = req.query;

    const where = {
      type: 'blast',
      ...(sessionId && { data: { path: ['sessionId'], equals: sessionId } }),
      ...(status && { status }),
    };

    const blasts = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: { blasts },
    });
  } catch (error) {
    console.error('Error fetching blasts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Cancel blast
export async function cancelBlast(req, res) {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({
      where: { jobId },
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Blast campaign not found',
      });
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed or cancelled blast',
      });
    }

    await prisma.job.update({
      where: { jobId },
      data: { status: 'cancelled' },
    });

    res.json({
      success: true,
      message: 'Blast campaign cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling blast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Quick send to multiple numbers
export async function quickSend(req, res) {
  try {
    const { sessionId, recipients, message } = req.body;

    if (!sessionId || !recipients || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId, recipients, message',
      });
    }

    // Normalize recipients to array
    const numbersArray = Array.isArray(recipients) ? recipients : recipients.split(',').map(r => r.trim());

    if (numbersArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid recipients provided',
      });
    }

    // Create message records for each recipient
    const messages = await Promise.all(
      numbersArray.map((to) =>
        prisma.message.create({
          data: {
            sessionId,
            messageId: `blast_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            from: 'system',
            to: to.replace(/\D/g, ''), // Remove non-digits
            content: message,
            messageType: 'text',
            timestamp: new Date(),
            status: 'pending',
            direction: 'outbound',
          },
        })
      )
    );

    res.status(201).json({
      success: true,
      data: {
        queued: messages.length,
        messageIds: messages.map((m) => m.id),
      },
    });
  } catch (error) {
    console.error('Error in quick send:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
