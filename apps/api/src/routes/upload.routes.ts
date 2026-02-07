import { Router } from "express";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs/promises";

const router = Router();

// Helper to get session ID from request (cookie or header)
function getSessionId(req: any): string | null {
  return req.cookies?.session_id || req.headers["x-session-id"] as string || null;
}

// Helper to determine media type from mimetype
function getMediaTypeFromMime(mimetype: string): string {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  return "document";
}

// POST /api/upload/base64 - Upload media file via base64 JSON with increased body limit (500MB)
router.post("/base64", bodyParser.json({ limit: "500mb" }), async (req, res) => {
  try {
    const userId = getSessionId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { base64, fileName, fileType } = req.body;

    if (!base64 || !fileName || !fileType) {
      return res.status(400).json({ error: "Missing required fields: base64, fileName, fileType" });
    }

    // Create uploads directory
    const uploadDir = path.join(process.env.DATA_PATH || "./data", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(fileName);
    const filename = "media-" + uniqueSuffix + ext;
    const filePath = path.join(uploadDir, filename);

    // Convert base64 to buffer and save
    const buffer = Buffer.from(base64, "base64");
    await fs.writeFile(filePath, buffer);

    const mediaType = getMediaTypeFromMime(fileType);

    res.json({
      url: `/uploads/${filename}`,
      type: mediaType,
      mimeType: fileType, // Preserve original mimetype for sending
      name: fileName,
      size: buffer.length,
    });
  } catch (error) {
    console.error("Error uploading file (base64):", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

export default router;
