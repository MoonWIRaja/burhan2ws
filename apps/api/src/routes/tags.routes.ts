import { Router } from "express";
import { db, tags, contactTags } from "@whatsapp-blast/database";
import { eq, and, count, desc } from "drizzle-orm";
import { getSessionId, getRealUserId } from "../utils/get-user.js";

const router = Router();

// GET /api/tags - List all tags with usage count
router.get("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const userTags = await db.query.tags.findMany({
      where: eq(tags.userId, userId),
      orderBy: [desc(tags.createdAt)],
    });

    // Get usage count for each tag
    const tagsWithUsage = await Promise.all(
      userTags.map(async (tag) => {
        const [result] = await db
          .select({ count: count() })
          .from(contactTags)
          .where(eq(contactTags.tagId, tag.id));

        return {
          ...tag,
          contactCount: result?.count || 0,
        };
      })
    );

    res.json(tagsWithUsage);
  } catch (error) {
    console.error("Error listing tags:", error);
    res.status(500).json({ error: "Failed to list tags" });
  }
});

// POST /api/tags - Create new tag
router.post("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Tag name is required" });
    }

    const [tag] = await db
      .insert(tags)
      .values({
        userId,
        name,
        color: color || "green",
      })
      .returning();

    res.status(201).json(tag);
  } catch (error: any) {
    console.error("Error creating tag:", error);
    if (error.code === "23505") {
      return res.status(400).json({ error: "Tag with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// GET /api/tags/:id/usage - Check if tag is in use
router.get("/:id/usage", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    // Verify tag belongs to user
    const tag = await db.query.tags.findFirst({
      where: and(eq(tags.id, req.params.id), eq(tags.userId, userId)),
    });

    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Count contacts using this tag
    const [result] = await db
      .select({ count: count() })
      .from(contactTags)
      .where(eq(contactTags.tagId, req.params.id));

    res.json({
      tagId: req.params.id,
      contactCount: result?.count || 0,
      inUse: (result?.count || 0) > 0,
    });
  } catch (error) {
    console.error("Error checking tag usage:", error);
    res.status(500).json({ error: "Failed to check tag usage" });
  }
});

// PATCH /api/tags/:id - Update tag
router.patch("/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { name, color } = req.body;

    const [updated] = await db
      .update(tags)
      .set({ name, color })
      .where(and(eq(tags.id, req.params.id), eq(tags.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating tag:", error);
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// DELETE /api/tags/:id - Delete tag
router.delete("/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    // Check if tag exists and belongs to user
    const tag = await db.query.tags.findFirst({
      where: and(eq(tags.id, req.params.id), eq(tags.userId, userId)),
    });

    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Check if tag is being used by any contacts
    const [contactCount] = await db
      .select({ count: count() })
      .from(contactTags)
      .where(eq(contactTags.tagId, req.params.id));

    if ((contactCount?.count || 0) > 0) {
      return res.status(400).json({
        error: "Cannot delete tag that is in use",
        message: `This tag is used by ${contactCount?.count || 0} contact(s). Please remove the tag from all contacts first.`
      });
    }

    // Safe to delete - no contacts using this tag
    const [deleted] = await db
      .delete(tags)
      .where(and(eq(tags.id, req.params.id), eq(tags.userId, userId)))
      .returning();

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting tag:", error);
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
