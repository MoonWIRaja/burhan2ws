import { Router } from "express";
import { db, messages, campaigns, contacts, conversations } from "@whatsapp-blast/database";
import { eq, and, gte, lte, count, sql, desc } from "drizzle-orm";
import { getSessionId, getRealUserId } from "../utils/get-user.js";

const router = Router();

// GET /api/dashboard/stats - Get dashboard statistics (Blast & Bot focused)
router.get("/stats", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { from, to } = req.query;

    // Parse date strings (YYYY-MM-DD format from frontend)
    // These represent LOCAL dates, so we need to create proper UTC ranges
    let fromDate: Date;
    let toDate: Date;

    if (from && typeof from === 'string') {
      // Parse the YYYY-MM-DD string as a LOCAL date (not UTC)
      const [year, month, day] = from.split('-').map(Number);
      // Create date for start of day in LOCAL timezone, then convert to UTC
      // For Malaysia (UTC+8), Feb 6 00:00 local = Feb 5 16:00 UTC
      fromDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    if (to && typeof to === 'string') {
      // Parse the YYYY-MM-DD string as a LOCAL date
      const [year, month, day] = to.split('-').map(Number);
      // Create date for END of day in LOCAL timezone
      // For Malaysia (UTC+8), Feb 6 23:59:59 local = Feb 6 15:59:59 UTC
      toDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
    }

    console.log('[Dashboard Stats] userId:', userId);
    console.log('[Dashboard Stats] Parsed date range (LOCAL time -> UTC):', {
      fromLocal: from,
      toLocal: to,
      fromUTC: fromDate.toISOString(),
      toUTC: toDate.toISOString()
    });

    // Get blast statistics from campaigns
    // NOTE: Blast service updates sentCount (successful sends) and failedCount
    // deliveredCount is not used by blast service, so we use sentCount for success
    const campaignsResult = await db
      .select({
        totalSent: sql<number>`SUM(${campaigns.sentCount}) + SUM(COALESCE(${campaigns.failedCount}, 0))`.mapWith(Number),
        successCount: sql<number>`SUM(${campaigns.sentCount})`.mapWith(Number),
        failedCount: sql<number>`SUM(${campaigns.failedCount})`.mapWith(Number),
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.userId, userId),
          gte(campaigns.createdAt, fromDate),
          lte(campaigns.createdAt, toDate)
        )
      );

    const blastStats = campaignsResult[0] || { totalSent: 0, successCount: 0, failedCount: 0 };

    // Get bot replies (AI sent messages)
    const [botRepliesResult] = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.userId, userId),
          eq(messages.isFromAi, true),
          gte(messages.timestamp, fromDate),
          lte(messages.timestamp, toDate)
        )
      );

    // Get conversations handled (conversations with AI activity)
    const [conversationsResult] = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversations.isAiEnabled, true),
          gte(conversations.lastMessageAt, fromDate),
          lte(conversations.lastMessageAt, toDate)
        )
      );

    // Get total contacts
    const [contactsResult] = await db
      .select({ count: count() })
      .from(contacts)
      .where(eq(contacts.userId, userId));

    // Get actual AI cost from messages (sum of aiCost where isFromAi=true)
    const aiCostResult = await db
      .select({
        totalCost: sql<string>`COALESCE(SUM(CAST(${messages.aiCost} AS NUMERIC)), 0)`.mapWith(String)
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.userId, userId),
          eq(messages.isFromAi, true),
          gte(messages.timestamp, fromDate),
          lte(messages.timestamp, toDate)
        )
      );

    const totalSent = blastStats?.totalSent || 0;
    const successCount = blastStats?.successCount || 0;
    const failedCount = blastStats?.failedCount || 0;
    const botReplies = botRepliesResult?.count || 0;
    const conversationsHandled = conversationsResult?.count || 0;
    const totalContacts = contactsResult?.count || 0;
    const actualAiCost = parseFloat(aiCostResult[0]?.totalCost || "0");

    const result = {
      totalSent,
      successCount,
      failedCount,
      botReplies,
      conversationsHandled,
      totalContacts,
      actualAiCost,  // Actual AI cost from database (RM)
    };
    console.log('[Dashboard Stats] result:', result);
    console.log('[Dashboard Stats] Sending response with data filtered by date range');

    // Add no-cache headers to prevent browser caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(result);
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// GET /api/dashboard/recent-blasts - Get campaigns with date filtering
router.get("/recent-blasts", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { from, to } = req.query;

    // Parse date strings (YYYY-MM-DD format from frontend) as LOCAL dates
    let fromDate: Date;
    let toDate: Date;

    if (from && typeof from === 'string') {
      const [year, month, day] = from.split('-').map(Number);
      fromDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    if (to && typeof to === 'string') {
      const [year, month, day] = to.split('-').map(Number);
      toDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
    }

    console.log('[Dashboard Recent Blasts] Parsed date range:', {
      fromLocal: from,
      toLocal: to,
      fromUTC: fromDate.toISOString(),
      toUTC: toDate.toISOString()
    });

    const recentCampaigns = await db.query.campaigns.findMany({
      where: and(
        eq(campaigns.userId, userId),
        gte(campaigns.createdAt, fromDate),
        lte(campaigns.createdAt, toDate)
      ),
      orderBy: [desc(campaigns.createdAt)],
      limit: 10,
    });

    // Transform to match frontend expectations
    // NOTE: Use sentCount for success since blast service updates sentCount (not deliveredCount)
    const blasts = recentCampaigns.map((c: any) => ({
      id: c.id,
      title: c.title,
      recipientCount: c.recipientCount || 0,
      successCount: c.sentCount || 0,
      failedCount: c.failedCount || 0,
      status: c.status || "draft",
      scheduledAt: c.scheduledAt || c.createdAt,
    }));

    console.log('[Dashboard Recent Blasts] Returning', blasts.length, 'campaigns for date range');

    // Add no-cache headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ blasts });
  } catch (error) {
    console.error("Error getting recent blasts:", error);
    res.status(500).json({ error: "Failed to get recent blasts" });
  }
});

// GET /api/dashboard/analytics - Get blast analytics by day
router.get("/analytics", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { from, to } = req.query;

    // Parse date strings (YYYY-MM-DD format from frontend) as LOCAL dates
    let fromDate: Date;
    let toDate: Date;

    if (from && typeof from === 'string') {
      const [year, month, day] = from.split('-').map(Number);
      fromDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    } else {
      fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    if (to && typeof to === 'string') {
      const [year, month, day] = to.split('-').map(Number);
      toDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      toDate = new Date();
      toDate.setHours(23, 59, 59, 999);
    }

    const fromDateStr = fromDate.toISOString();
    const toDateStr = toDate.toISOString();

    console.log('[Dashboard Analytics] Parsed date range:', {
      fromLocal: from,
      toLocal: to,
      fromUTC: fromDateStr,
      toUTC: toDateStr
    });

    // Get daily blast counts using campaigns data
    // NOTE: sent_count = successful sends, delivered_count is not used by blast service
    // Use AT TIME ZONE to convert UTC timestamps to Malaysia time (UTC+8) before extracting date
    const blastAnalytics = await db.execute(sql`
      SELECT
        DATE(ca.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur') as date,
        COALESCE(SUM(ca.sent_count), 0) + COALESCE(SUM(ca.failed_count), 0) as sent,
        COALESCE(SUM(ca.sent_count), 0) as success,
        COALESCE(SUM(ca.failed_count), 0) as failed,
        0 as pending
      FROM campaigns ca
      WHERE ca.user_id = ${userId}
        AND ca.created_at >= ${fromDateStr}::timestamp
        AND ca.created_at <= ${toDateStr}::timestamp
      GROUP BY DATE(ca.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')
      ORDER BY DATE(ca.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')
    `);

    // Get bot replies per day
    // Use AT TIME ZONE to convert UTC timestamps to Malaysia time (UTC+8) before extracting date
    const botAnalytics = await db.execute(sql`
      SELECT
        DATE(m.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur') as date,
        COUNT(*) as bot_replies
      FROM messages m
      INNER JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = ${userId}
        AND m.is_from_ai = true
        AND m.timestamp >= ${fromDateStr}::timestamp
        AND m.timestamp <= ${toDateStr}::timestamp
      GROUP BY DATE(m.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')
      ORDER BY DATE(m.timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')
    `);

    // Merge results
    const analyticsMap = new Map<string, any>();

    // Initialize with blast data
    for (const row of blastAnalytics as any[]) {
      analyticsMap.set(row.date, {
        date: row.date,
        sent: parseInt(row.sent) || 0,
        success: parseInt(row.success) || 0,
        failed: parseInt(row.failed) || 0,
        botReplies: 0,
      });
    }

    // Add bot replies
    for (const row of botAnalytics as any[]) {
      const existing = analyticsMap.get(row.date);
      if (existing) {
        existing.botReplies = parseInt(row.bot_replies) || 0;
      } else {
        analyticsMap.set(row.date, {
          date: row.date,
          sent: 0,
          success: 0,
          failed: 0,
          botReplies: parseInt(row.bot_replies) || 0,
        });
      }
    }

    // Convert to array and sort
    const data = Array.from(analyticsMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    console.log('[Dashboard Analytics] Returning', data.length, 'data points for date range');

    // Add no-cache headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ data });
  } catch (error) {
    console.error("Error getting analytics:", error);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export default router;
