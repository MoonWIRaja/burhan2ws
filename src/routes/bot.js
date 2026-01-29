import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get all bot rules for a session
router.get('/:sessionId', async (req, res) => {
  try {
    const rules = await prisma.botRule.findMany({
      where: { sessionId: req.params.sessionId },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { rules },
    });
  } catch (error) {
    console.error('Error fetching bot rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot rules',
    });
  }
});

// Get single bot rule
router.get('/detail/:id', async (req, res) => {
  try {
    const rule = await prisma.botRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Bot rule not found',
      });
    }

    res.json({
      success: true,
      data: { rule },
    });
  } catch (error) {
    console.error('Error fetching bot rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot rule',
    });
  }
});

// Create new bot rule
router.post('/', async (req, res) => {
  try {
    const { sessionId, name, keyword, response, isEnabled, matchType } = req.body;

    const rule = await prisma.botRule.create({
      data: {
        sessionId,
        name,
        keyword,
        response,
        isEnabled: isEnabled ?? true,
        matchType: matchType || 'contains',
      },
    });

    res.status(201).json({
      success: true,
      data: { rule },
    });
  } catch (error) {
    console.error('Error creating bot rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bot rule',
    });
  }
});

// Update bot rule
router.put('/:id', async (req, res) => {
  try {
    const { name, keyword, response, isEnabled, matchType } = req.body;

    const rule = await prisma.botRule.update({
      where: { id: req.params.id },
      data: {
        name,
        keyword,
        response,
        isEnabled,
        matchType,
      },
    });

    res.json({
      success: true,
      data: { rule },
    });
  } catch (error) {
    console.error('Error updating bot rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bot rule',
    });
  }
});

// Delete bot rule
router.delete('/:id', async (req, res) => {
  try {
    await prisma.botRule.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Bot rule deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting bot rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bot rule',
    });
  }
});

// Toggle bot rule enabled/disabled
router.patch('/:id/toggle', async (req, res) => {
  try {
    const rule = await prisma.botRule.findUnique({
      where: { id: req.params.id },
    });

    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Bot rule not found',
      });
    }

    const updated = await prisma.botRule.update({
      where: { id: req.params.id },
      data: { isEnabled: !rule.isEnabled },
    });

    res.json({
      success: true,
      data: { rule: updated },
    });
  } catch (error) {
    console.error('Error toggling bot rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle bot rule',
    });
  }
});

// Test bot rule with message
router.post('/test', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    const rules = await prisma.botRule.findMany({
      where: {
        sessionId,
        isEnabled: true,
      },
    });

    let matchedRule = null;

    for (const rule of rules) {
      const { keyword, matchType } = rule;

      let isMatch = false;

      if (matchType === 'exact') {
        isMatch = message.toLowerCase().trim() === keyword.toLowerCase().trim();
      } else if (matchType === 'regex') {
        try {
          const regex = new RegExp(keyword, 'i');
          isMatch = regex.test(message);
        } catch (e) {
          console.error('Invalid regex:', keyword);
        }
      } else {
        // contains (default)
        isMatch = message.toLowerCase().includes(keyword.toLowerCase());
      }

      if (isMatch) {
        matchedRule = rule;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        matched: !!matchedRule,
        rule: matchedRule,
        response: matchedRule?.response || null,
      },
    });
  } catch (error) {
    console.error('Error testing bot rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test bot rule',
    });
  }
});

export default router;
