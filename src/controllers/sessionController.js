import prisma from '../config/database.js';
import { createSession } from '../services/whatsappService.js';

// Get all sessions
export async function getSessions(req, res) {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        _count: {
          select: { messages: true, files: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: { sessions } });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get session by ID
export async function getSessionById(req, res) {
  try {
    const { id } = req.params;
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        _count: {
          select: { messages: true, files: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Create new session
export async function createNewSession(req, res) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    // Create session in database without user (for login flow)
    const session = await prisma.session.create({
      data: {
        sessionId,
        status: 'connecting'
      },
      // Skip user relation for login sessions
      select: {
        id: true,
        sessionId: true,
        status: true,
        createdAt: true
      }
    });

    // Initialize WhatsApp socket (background, don't await)
    createSession(sessionId).catch((whatsappError) => {
      console.error('Error initializing WhatsApp socket:', whatsappError);
    });

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Disconnect session
export async function disconnectSessionById(req, res) {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({ where: { id } });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Update session status
    await prisma.session.update({
      where: { id },
      data: {
        status: 'disconnected',
        lastActive: new Date()
      }
    });

    res.json({ success: true, data: { message: 'Session disconnected' } });
  } catch (error) {
    console.error('Error disconnecting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get session stats
export async function getSessionStats(req, res) {
  try {
    const sessions = await prisma.session.findMany();

    const stats = {
      total: sessions.length,
      connected: sessions.filter(s => s.status === 'connected').length,
      qr: sessions.filter(s => s.status === 'qr').length,
      disconnected: sessions.filter(s => s.status === 'disconnected').length
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting session stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
