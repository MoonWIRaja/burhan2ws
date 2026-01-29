// Simple stats API
import prisma from '../config/database.js';

export async function getOverview(req, res) {
  try {
    // Get all sessions data
    const sessions = await prisma.session.findMany();

    const sessionIds = sessions.map(s => s.id);

    const messages = await prisma.message.findMany({
      where: { sessionId: { in: sessionIds } }
    });

    const files = await prisma.file.findMany({
      where: { sessionId: { in: sessionIds } }
    });

    const sessionsConnected = sessions.filter(s => s.status === 'connected').length;
    const sessionsQR = sessions.filter(s => s.status === 'qr').length;
    const sessionsDisconnected = sessions.filter(s => s.status === 'disconnected').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const messagesToday = await prisma.message.count({
      where: {
        createdAt: { gte: today },
        sessionId: { in: sessionIds }
      }
    });

    const filesToday = await prisma.file.count({
      where: {
        createdAt: { gte: today },
        sessionId: { in: sessionIds }
      }
    });

    res.json({
      data: {
        sessions: {
          total: sessions.length,
          connected: sessionsConnected,
          qr: sessionsQR,
          disconnected: sessionsDisconnected
        },
        messages: {
          total: messages.length,
          today: messagesToday
        },
        files: {
          total: files.length,
          today: filesToday
        },
        queue: {
          messages: { waiting: 0, active: 0, completed: 0 },
          files: { waiting: 0, active: 0, completed: 0 }
        },
        today: {
          sessions: sessions.filter(s => {
            const created = new Date(s.createdAt);
            created.setHours(0, 0, 0, 0);
            return created >= today;
          }).length
        }
      }
    });
  } catch (error) {
    console.error('Error getting overview:', error);
    res.status(500).json({ error: 'Failed to get overview' });
  }
}
