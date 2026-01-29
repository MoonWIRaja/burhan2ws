import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all contacts for a session
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { search, tags } = req.query;

    const where = {
      sessionId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search } },
        ],
      }),
      ...(tags && {
        tags: {
          hasSome: tags.split(','),
        },
      }),
    };

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { contacts },
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts',
    });
  }
});

// Get single contact
router.get('/detail/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    res.json({
      success: true,
      data: { contact },
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact',
    });
  }
});

// Create new contact
router.post('/', async (req, res) => {
  try {
    const { sessionId, name, phoneNumber, email, tags, notes } = req.body;

    // Check if contact already exists
    const existing = await prisma.contact.findFirst({
      where: {
        sessionId,
        phoneNumber,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Contact with this phone number already exists',
      });
    }

    const contact = await prisma.contact.create({
      data: {
        sessionId,
        name,
        phoneNumber,
        email,
        tags: tags || [],
        notes,
      },
    });

    res.status(201).json({
      success: true,
      data: { contact },
    });
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contact',
    });
  }
});

// Update contact
router.put('/:id', async (req, res) => {
  try {
    const { name, phoneNumber, email, tags, notes, isBlocked } = req.body;

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name,
        phoneNumber,
        email,
        tags,
        notes,
        isBlocked,
      },
    });

    res.json({
      success: true,
      data: { contact },
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact',
    });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    await prisma.contact.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
    });
  }
});

// Import contacts from CSV/JSON
router.post('/import', async (req, res) => {
  try {
    const { sessionId, contacts } = req.body;

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contacts data',
      });
    }

    const created = await prisma.contact.createMany({
      data: contacts.map(c => ({
        sessionId,
        name: c.name,
        phoneNumber: c.phoneNumber,
        email: c.email,
        tags: c.tags || [],
        notes: c.notes,
      })),
      skipDuplicates: true,
    });

    res.status(201).json({
      success: true,
      data: {
        imported: created.count,
      },
    });
  } catch (error) {
    console.error('Error importing contacts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import contacts',
    });
  }
});

// Get all unique tags across all contacts
router.get('/tags/:sessionId', async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { sessionId: req.params.sessionId },
      select: { tags: true },
    });

    const allTags = contacts.flatMap(c => c.tags);
    const uniqueTags = [...new Set(allTags)];

    res.json({
      success: true,
      data: { tags: uniqueTags },
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tags',
    });
  }
});

export default router;
