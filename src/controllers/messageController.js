import prisma from '../config/database.js';

// Get messages for a session
export async function getMessages(req, res) {
  try {
    const { sessionId } = req.params;
    const { limit = 50, offset = 0, type } = req.query;

    const where = { sessionId };
    if (type) {
      where.messageType = type;
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.message.count({ where })
    ]);

    res.json({
      success: true,
      data: messages,
      meta: { total, limit, offset }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Send message
export async function sendMessage(req, res) {
  try {
    const { sessionId } = req.params;
    const { to, content, messageType = 'text' } = req.body;

    if (!to || !content) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        sessionId,
        messageId: `sent_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        from: 'system',
        to,
        content,
        messageType,
        timestamp: new Date(),
        status: 'pending',
        direction: 'outbound'
      }
    });

    res.status(202).json({
      success: true,
      data: { messageId: message.id, message: 'Message queued for sending' }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getMessageStats(req, res) {
  try {
    const { sessionId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount] = await Promise.all([
      prisma.message.count({ where: { sessionId } }),
      prisma.message.count({
        where: {
          sessionId,
          timestamp: { gte: today }
        }
      })
    ]);

    res.json({
      success: true,
      data: { total, today: todayCount }
    });
  } catch (error) {
    console.error('Error getting message stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
