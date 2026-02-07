import { Router } from "express";
import { db, contacts, contactTags, tags, conversations, normalizePhoneNumber } from "@whatsapp-blast/database";
import { eq, and, ilike, or, inArray, desc, sql, count } from "drizzle-orm";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { createId } from "@paralleldrive/cuid2";
import { getSessionId, getRealUserId } from "../utils/get-user.js";
import { whatsappInstances } from "@whatsapp-blast/whatsapp";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/contacts - List all contacts (paginated)
router.get("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { search, tag, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build base conditions
    const conditions = [eq(contacts.userId, userId)];

    // Add search condition
    if (search) {
      const searchCondition = or(
        ilike(contacts.name, `%${search}%`),
        ilike(contacts.phoneNumber, `%${search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    // Build query
    let query = db.query.contacts.findMany({
      where: and(...conditions),
      with: {
        tags: {
          with: {
            tag: true,
          },
        },
      },
      orderBy: [desc(contacts.createdAt)],
      limit: limitNum,
      offset,
    });

    let results = await query;

    // Filter by tag if specified (must be done after fetching tags)
    if (tag) {
      results = results.filter((contact: any) =>
        contact.tags?.some((ct: any) => ct.tag.id === tag)
      );
    }

    // Get total count
    let countConditions = [eq(contacts.userId, userId)];
    if (search) {
      const searchCondition = or(
        ilike(contacts.name, `%${search}%`),
        ilike(contacts.phoneNumber, `%${search}%`)
      );
      if (searchCondition) countConditions.push(searchCondition);
    }

    // For count with tag filter, we need to join with contactTags
    const baseCountQuery = db.select({ count: count() }).from(contacts);
    let countResult;
    if (tag) {
      const countQueryWithTag = baseCountQuery
        .innerJoin(contactTags, eq(contactTags.contactId, contacts.id))
        .where(and(eq(contactTags.tagId, tag as string), ...countConditions));
      [countResult] = await countQueryWithTag;
    } else {
      const countQueryNoTag = baseCountQuery.where(and(...countConditions));
      [countResult] = await countQueryNoTag;
    }

    // Transform results to include tags as array
    const contactsWithTags = results.map((contact) => ({
      ...contact,
      tags: contact.tags?.map((ct: any) => ct.tag) || [],
    }));

    res.json({
      contacts: contactsWithTags,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / limitNum),
      },
    });
  } catch (error) {
    console.error("Error listing contacts:", error);
    res.status(500).json({ error: "Failed to list contacts" });
  }
});

// POST /api/contacts/check - Check if phone number is on WhatsApp
router.post("/check", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      console.log("[Check] Unauthorized - no session");
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      console.log("[Check] No phone number provided");
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Get WhatsApp instance
    const instanceKey = userId || sessionId;
    const wa = (whatsappInstances as Map<string, any>).get(instanceKey);

    console.log(`[Check] Instance key: ${instanceKey}, WA exists: ${!!wa}, Connected: ${wa?.isConnected()}`);

    if (!wa || !wa.isConnected()) {
      return res.status(400).json({ error: "WhatsApp not connected" });
    }

    // Check if number is on WhatsApp
    const result = await wa.checkNumber(phoneNumber);

    console.log(`[Check] Result for ${phoneNumber}:`, result);

    if (!result) {
      return res.status(500).json({ error: "Failed to check number" });
    }

    res.json({
      isOnWhatsApp: result.isOnWhatsApp,
      jid: result.jid,
    });
  } catch (error) {
    console.error("Error checking number:", error);
    res.status(500).json({ error: "Failed to check number" });
  }
});

// POST /api/contacts - Create single contact
router.post("/", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { name, phoneNumber, customData, tagIds } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Normalize phone number using shared utility
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // IMPORTANT: Verify number is on WhatsApp before saving
    const instanceKey = userId || sessionId;
    const wa = (whatsappInstances as Map<string, any>).get(instanceKey);

    if (wa && wa.isConnected()) {
      const checkResult = await wa.checkNumber(normalizedPhone);
      if (checkResult && !checkResult.isOnWhatsApp) {
        // Number is not on WhatsApp
        return res.status(400).json({
          error: "The phone number entered is not registered with WhatsApp",
          code: "NOT_ON_WHATSAPP"
        });
      }
    }

    // Create contact
    const [contact] = await db
      .insert(contacts)
      .values({
        userId,
        name,
        phoneNumber: normalizedPhone,
        customData,
      })
      .returning();

    // Add tags if provided
    if (tagIds && tagIds.length > 0) {
      await db.insert(contactTags).values(
        tagIds.map((tagId: string) => ({
          contactId: contact.id,
          tagId,
        }))
      );
    }

    res.status(201).json(contact);
  } catch (error: any) {
    console.error("Error creating contact:", error);
    if (error.code === "23505") {
      return res.status(400).json({ error: "Contact with this phone number already exists" });
    }
    res.status(500).json({ error: "Failed to create contact" });
  }
});

// POST /api/contacts/import - Import from CSV
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const csvContent = req.file.buffer.toString("utf-8");
    console.log("[Import] CSV Content:", csvContent);

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
    console.log("[Import] Parsed records:", records);
    console.log("[Import] Number of records:", records.length);

    const imported: any[] = [];
    const failed: any[] = [];

    for (const record of records) {
      try {
        let phoneNumber = (record.phone_number || record.phone || record.Phone || record.phoneNumber || record.no_telefon || "").toString().trim();

        console.log("[Import] Processing record:", { record, phoneNumber });

        if (!phoneNumber) {
          console.log("[Import] Skipping record - no phone number:", record);
          failed.push({ record, error: "No phone number provided" });
          continue;
        }

        // Normalize phone number using shared utility
        phoneNumber = normalizePhoneNumber(phoneNumber);

        const [contact] = await db
          .insert(contacts)
          .values({
            userId,
            name: record.name || record.Name || record.nama || null,
            phoneNumber,
            customData: record,
          })
          .returning();

        console.log("[Import] Created contact:", contact);

        // Handle tags if provided
        const tagsData = record.tags || record.Tags || record.tag || record.Tag;
        console.log("[Import] Tags data for record:", tagsData, "Type:", typeof tagsData);

        if (tagsData && typeof tagsData === "string" && tagsData.trim()) {
          const tagNames = tagsData.split(",").map((t: string) => t.trim()).filter((t: string) => t);
          console.log("[Import] Parsed tag names:", tagNames);

          for (const tagName of tagNames) {
            try {
              console.log("[Import] Processing tag:", tagName);

              // Find existing tag or create new one
              let [existingTag] = await db
                .select()
                .from(tags)
                .where(and(eq(tags.userId, userId), eq(tags.name, tagName)))
                .limit(1);

              if (!existingTag) {
                console.log("[Import] Creating new tag:", tagName);
                [existingTag] = await db
                  .insert(tags)
                  .values({
                    userId,
                    name: tagName,
                    color: "green",
                  })
                  .returning();
              } else {
                console.log("[Import] Using existing tag:", existingTag);
              }

              // Link tag to contact
              console.log("[Import] Linking tag to contact:", { contactId: contact.id, tagId: existingTag.id });
              await db
                .insert(contactTags)
                .values({
                  contactId: contact.id,
                  tagId: existingTag.id,
                })
                .onConflictDoNothing(); // Avoid duplicates
            } catch (tagError) {
              console.error("[Import] Error attaching tag:", tagError);
            }
          }
        } else {
          console.log("[Import] No tags to process for this record");
        }

        imported.push(contact);
      } catch (error: any) {
        console.error("[Import] Error processing record:", error);
        failed.push({ record, error: error.message });
      }
    }

    console.log("[Import] Final result:", { imported: imported.length, failed: failed.length });

    res.json({
      imported: imported.length,
      failed: failed.length,
      details: { imported, failed },
    });
  } catch (error) {
    console.error("Error importing contacts:", error);
    res.status(500).json({ error: "Failed to import contacts" });
  }
});

// GET /api/contacts/template - Download CSV template
router.get("/template", (req, res) => {
  const template = "name,phone,company,notes\nJohn Doe,+60123456789,ABC Corp,Hot lead\n";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=contacts_template.csv");
  res.send(template);
});

// GET /api/contacts/:id - Get single contact
router.get("/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const contact = await db.query.contacts.findFirst({
      where: and(eq(contacts.id, req.params.id), eq(contacts.userId, userId)),
      with: {
        tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json({
      ...contact,
      tags: contact.tags?.map((ct: any) => ct.tag) || [],
    });
  } catch (error) {
    console.error("Error getting contact:", error);
    res.status(500).json({ error: "Failed to get contact" });
  }
});

// PATCH /api/contacts/:id - Update contact
router.patch("/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { name, phoneNumber, customData, tagIds } = req.body;

    const [updated] = await db
      .update(contacts)
      .set({
        name,
        phoneNumber,
        customData,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.id, req.params.id), eq(contacts.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Update tags if provided
    if (tagIds !== undefined) {
      // Delete all existing tags for this contact
      await db.delete(contactTags).where(eq(contactTags.contactId, req.params.id));

      // Only insert valid tag IDs (tags that exist in the tags table)
      if (tagIds.length > 0) {
        // Verify each tag exists before inserting
        const validTags = await db
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              eq(tags.userId, userId),
              inArray(tags.id, tagIds)
            )
          );

        const validTagIds = validTags.map(t => t.id);

        if (validTagIds.length > 0) {
          await db.insert(contactTags).values(
            validTagIds.map((tagId: string) => ({
              contactId: req.params.id,
              tagId,
            }))
          );
        }

        // Log if any invalid tags were provided
        const invalidTags = tagIds.filter((id: string) => !validTagIds.includes(id));
        if (invalidTags.length > 0) {
          console.log("[Update Contact] Skipping invalid tag IDs:", invalidTags);
        }
      }
    }

    // Update all conversations linked to this contact with the new name
    await db
      .update(conversations)
      .set({
        contactName: name,
        updatedAt: new Date(),
      })
      .where(and(eq(conversations.contactId, req.params.id), eq(conversations.userId, userId)));

    console.log(`[Update Contact] Updated ${req.params.id} and linked conversations`);

    res.json(updated);
  } catch (error) {
    console.error("Error updating contact:", error);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

// DELETE /api/contacts/:id - Delete contact
router.delete("/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const [deleted] = await db
      .delete(contacts)
      .where(and(eq(contacts.id, req.params.id), eq(contacts.userId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// POST /api/contacts/bulk-delete - Delete multiple contacts
router.post("/bulk-delete", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);

    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No contact IDs provided" });
    }

    const deleted = await db
      .delete(contacts)
      .where(and(inArray(contacts.id, ids), eq(contacts.userId, userId)))
      .returning();

    res.json({ success: true, deletedCount: deleted.length });
  } catch (error) {
    console.error("Error bulk deleting contacts:", error);
    res.status(500).json({ error: "Failed to delete contacts" });
  }
});

export default router;
