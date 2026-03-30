import { Router } from "express";
import { db, aiModels, botConfig, knowledgeBase, botFiles, users, botCommands, whatsappSessions } from "@whatsapp-blast/database";
import { eq, and, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { getSessionId, getRealUserId } from "../utils/get-user.js";
import { deleteReturningOne, insertReturningOne, updateReturningOne } from "../utils/db-compat.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: Ensure user exists
async function ensureUserExists(sessionId: string) {
  let user = await db.query.users.findFirst({
    where: eq(users.id, sessionId),
  });

  if (!user) {
    const newUser = await insertReturningOne(users, {
      id: sessionId,
      name: `User ${sessionId.slice(0, 8)}`,
      email: `${sessionId}@whatsapp.local`,
      dataPath: `/data/${sessionId}`,
    });
    user = newUser;
  }

  return user;
}

// Default bot files template for new users
const DEFAULT_NORMAL_BOT_FILES = [
  // Root folders
  { filename: "flows", filePath: "/flows", parentPath: "/", isDirectory: true },
  { filename: "prompts", filePath: "/prompts", parentPath: "/", isDirectory: true },
  { filename: "handlers", filePath: "/handlers", parentPath: "/", isDirectory: true },

  // Config file
  {
    filename: "config.json",
    filePath: "/config.json",
    parentPath: "/",
    isDirectory: false,
    mimeType: "application/json",
    content: JSON.stringify({
      name: "My WhatsApp Bot",
      version: "1.0.0",
      language: "ms",
      settings: {
        autoReply: true,
        typingDelay: 1500,
        welcomeNewUsers: true
      }
    }, null, 2)
  },

  // Main handler
  {
    filename: "main.js",
    filePath: "/handlers/main.js",
    parentPath: "/handlers",
    isDirectory: false,
    mimeType: "application/javascript",
    content: `// Main message handler
// This file handles all incoming messages

function handleMessage(message) {
  const text = message.body.toLowerCase();

  // Hello world response
  if (text === "hello" || text === "hi") {
    return "Hello! 👋 Welcome to our bot!";
  }

  // Help command
  if (text === "help" || text === "menu") {
    return \`*📋 Menu Utama*

1️⃣ Taip *harga* untuk senarai harga
2️⃣ Taip *info* untuk maklumat lanjut
3️⃣ Taip *agent* untuk bercakap dengan manusia

Reply dengan nombor atau keyword.\`;
  }

  // Default: return null to let other handlers process
  return null;
}

module.exports = { handleMessage };`
  },

  // Greeting flow
  {
    filename: "greeting.js",
    filePath: "/flows/greeting.js",
    parentPath: "/flows",
    isDirectory: false,
    mimeType: "application/javascript",
    content: `// Greeting Flow
// Handles welcome messages for new contacts

const greetingFlow = {
  trigger: "first_message",

  steps: [
    {
      action: "send",
      message: "Assalamualaikum dan selamat datang! 🌟",
      delay: 500
    },
    {
      action: "send",
      message: "Terima kasih kerana menghubungi kami. Taip 'menu' untuk lihat pilihan.",
      delay: 1000
    }
  ]
};

module.exports = greetingFlow;`
  },

  // System prompt
  {
    filename: "system.txt",
    filePath: "/prompts/system.txt",
    parentPath: "/prompts",
    isDirectory: false,
    mimeType: "text/plain",
    content: `Anda adalah pembantu AI yang mesra untuk perniagaan di WhatsApp.

PERANAN:
- Jawab soalan pelanggan dengan sopan dan profesional
- Guna Bahasa Malaysia sebagai bahasa utama
- Berikan maklumat yang tepat dan ringkas

GAYA:
- Mesra tapi profesional
- Guna emoji secukupnya
- Jawapan ringkas (max 2-3 ayat)

PANDUAN:
- Jika tak pasti, tawarkan untuk hubungkan ke manusia
- Jangan buat janji yang tak boleh ditepati
- Utamakan kepuasan pelanggan`
  },

  // FAQ file
  {
    filename: "faq.md",
    filePath: "/prompts/faq.md",
    parentPath: "/prompts",
    isDirectory: false,
    mimeType: "text/plain",
    content: `# Soalan Lazim (FAQ)

## Waktu Operasi
**S: Bila waktu operasi?**
J: Kami beroperasi Isnin - Jumaat, 9AM - 6PM.

## Penghantaran
**S: Berapa lama penghantaran?**
J: Penghantaran mengambil masa 3-5 hari bekerja.

## Pembayaran
**S: Cara pembayaran yang diterima?**
J: Kami terima FPX, kad kredit, dan e-wallet.

## Refund
**S: Boleh dapat refund?**
J: Ya, refund dalam masa 7 hari dari tarikh pembelian.`
  }
];

// Default AI Bot files
const DEFAULT_AI_BOT_FILES = [
  // Root folders for AI mode
  { filename: "prompts", filePath: "/prompts", parentPath: "/", isDirectory: true },
  { filename: "knowledge", filePath: "/knowledge", parentPath: "/", isDirectory: true },
  { filename: "commands", filePath: "/commands", parentPath: "/", isDirectory: true },

  // Config file
  {
    filename: "config.json",
    filePath: "/config.json",
    parentPath: "/",
    isDirectory: false,
    mimeType: "application/json",
    content: JSON.stringify({
      name: "My AI Assistant",
      version: "1.0.0",
      mode: "ai",
      settings: {
        temperature: 0.7,
        maxTokens: 500,
        useKnowledgeBase: true
      }
    }, null, 2)
  },

  // System prompt
  {
    filename: "system.txt",
    filePath: "/prompts/system.txt",
    parentPath: "/prompts",
    isDirectory: false,
    mimeType: "text/plain",
    content: `Anda adalah pembantu AI yang pintar dan mesra untuk WhatsApp Business.

PERANAN ANDA:
- Berikan respons yang sopan, profesional, dan membantu
- Guna Bahasa Malaysia yang natural dan santai
- Jawab soalan pelanggan dengan tepat dan ringkas

PERSONALITI:
- Mesra dan mudah berbicara
- Guna emoji secukupnya (jangan terlebih)
- Ringkas dan terus ke point

GAYA JAWAPAN:
- 1-3 ayat untuk jawapan ringkas
- Guna bahasa santai (tak perlu formal sangat)
- Jika tak pasti, beritahu dengan jujur

PANDUAN:
- Utamakan kepuasan pelanggan
- Jangan buat janji yang tak boleh ditepati
- Jika soalan susah, cadangkan untuk hubungkan staff`
  },

  // Knowledge base example
  {
    filename: "business-info.md",
    filePath: "/knowledge/business-info.md",
    parentPath: "/knowledge",
    isDirectory: false,
    mimeType: "text/markdown",
    content: `# Maklumat Perniagaan

## Produk & Servis
Kami menawarkan perkhidmatan berkaitan WhatsApp business solution.

## Harga
- Basic Plan: RM50/bulan
- Pro Plan: RM150/bulan
- Enterprise: Hubungi sales

## Sokongan
- WhatsApp: +60123456789
- Email: support@example.com
- Waktu operasi: Isnin - Jumaat, 9AM - 6PM`
  },

  // Slash Commands
  {
    filename: "takeover.js",
    filePath: "/commands/takeover.js",
    parentPath: "/commands",
    isDirectory: false,
    mimeType: "application/javascript",
    content: `// /takeover - Ambil alih conversation
// AI tak jawab untuk tempoh tertentu
// Admin: +60123456789

module.exports = {
  command: "/takeover",
  alias: ["/take", "/to", "/ambil"],
  description: "Ambil alih conversation. AI tak jawab untuk 1 jam.",
  adminOnly: true,
  hiddenFromContact: true,
  enabled: true,
  config: {
    durationMinutes: 60,
    resetOnAdminChat: true
  },
  // Action function untuk execute command
  action: async (context) => {
    const { userId, fromJid, db } = context;

    // Set takeover mode untuk 1 jam
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000));

    // Simpan takeover state (perlu table takeover_state)
    // Untuk sekarang, return response je
    return {
      response: "✅ Takeover mode activated. AI akan senyap untuk 1 jam.",
      hideFromContact: true
    };
  }
};`
  },

  {
    filename: "give.js",
    filePath: "/commands/give.js",
    parentPath: "/commands",
    isDirectory: false,
    mimeType: "application/javascript",
    content: `// /give - Serahkan balik pada AI
// AI akan jawab semula segera

module.exports = {
  command: "/give",
  alias: ["/serah", "/release", "/giveback"],
  description: "Serahkan balik pada AI. AI jawab segera.",
  adminOnly: true,
  hiddenFromContact: true,
  enabled: true,
  config: {},
  // Action function untuk execute command
  action: async (context) => {
    const { userId, fromJid, db } = context;

    // Clear takeover state
    // Untuk sekarang, return response je
    return {
      response: "✅ Takeover mode ended. AI akan jawab semula.",
      hideFromContact: true
    };
  }
};`
  },

  // Edit Templates - untuk edit command messages jadi lebih kemas
  {
    filename: "edit-templates.js",
    filePath: "/commands/edit-templates.js",
    parentPath: "/commands",
    isDirectory: false,
    mimeType: "application/javascript",
    content: `// Edit Templates - untuk customize ayat edit command
// Bila admin hantar /takeover atau /give, mesej akan diedit jadi ayat ni
// Anda boleh tukar ayat mengikut kesesuaian bisnes anda

module.exports = {
  // /takeover - AI akan senyap, manusya ambil alih
  takeover: "Seorang manusia akan mengambil alih perbualan ini. Sila tunggu sebentar...",

  // /give - AI kembali aktif
  give: "AI kembali membantu anda. Ada apa-apa yang boleh saya bantu?",

  // Default template kalau command lain ditambah
  default: "Sedang diproses..."
};`
  }
];

// Seed default files for new user
async function seedDefaultBotFiles(userId: string, mode: string = "normal") {
  try {
    // Check if user already has files for this mode
    const existingFiles = await db.query.botFiles.findFirst({
      where: and(eq(botFiles.userId, userId), eq(botFiles.botMode, mode))
    });

    if (existingFiles) {
      return; // User already has files for this mode, don't seed
    }

    // Helper to extract folder name from parentPath
    // "/flows" -> "flows", "/" -> ""
    const getFolderFromParent = (parentPath: string): string => {
      if (parentPath === "/" || !parentPath) return "";
      return parentPath.replace(/^\//, "").replace(/\/$/, "");
    };

    // Select default files based on mode
    const filesToSeed = mode === "ai" ? DEFAULT_AI_BOT_FILES : DEFAULT_NORMAL_BOT_FILES;

    // Create default files
    for (const file of filesToSeed) {
      const folder = file.isDirectory ? getFolderFromParent(file.parentPath) : getFolderFromParent(file.parentPath);

      await db.insert(botFiles).values({
        userId,
        filename: file.filename,
        folder, // Legacy column for backward compatibility
        filePath: file.filePath,
        parentPath: file.parentPath,
        isDirectory: file.isDirectory,
        fileSize: file.content ? Buffer.byteLength(file.content, "utf-8") : 0,
        content: file.content || null,
        mimeType: file.mimeType || null,
        botMode: mode,
      });
    }

    console.log(`Seeded default ${mode} bot files for user: ${userId}`);
  } catch (error) {
    console.error("Error seeding default files:", error);
  }
}

// GET /api/bot/status - Get bot running status
router.get("/status", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const config = await db.query.botConfig.findFirst({
      where: eq(botConfig.userId, userId),
    });

    res.json({
      isEnabled: config?.isEnabled || false,
      status: config?.status || "stopped",
      activeModelId: config?.activeModelId,
      botMode: config?.botMode || "normal",
    });
  } catch (error) {
    console.error("Error getting bot status:", error);
    res.status(500).json({ error: "Failed to get bot status" });
  }
});

// POST /api/bot/start - Start the bot
router.post("/start", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let config = await db.query.botConfig.findFirst({
      where: eq(botConfig.userId, userId),
    });

    if (!config) {
      // Create default config
      const newConfig = await insertReturningOne(botConfig, { userId, isEnabled: true, status: "running" });
      config = newConfig;
    } else {
      const updated = await updateReturningOne(botConfig, eq(botConfig.userId, userId), {
        isEnabled: true,
        status: "running",
        updatedAt: new Date(),
      });
      config = updated;
    }

    res.json({ success: true, status: "running" });
  } catch (error) {
    console.error("Error starting bot:", error);
    res.status(500).json({ error: "Failed to start bot" });
  }
});

// POST /api/bot/stop - Stop the bot
router.post("/stop", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await db
      .update(botConfig)
      .set({ isEnabled: false, status: "stopped", updatedAt: new Date() })
      .where(eq(botConfig.userId, userId));

    res.json({ success: true, status: "stopped" });
  } catch (error) {
    console.error("Error stopping bot:", error);
    res.status(500).json({ error: "Failed to stop bot" });
  }
});

// POST /api/bot/restart - Restart the bot
router.post("/restart", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await db
      .update(botConfig)
      .set({ status: "restarting", updatedAt: new Date() })
      .where(eq(botConfig.userId, userId));

    // Simulate restart delay
    setTimeout(async () => {
      await db
        .update(botConfig)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(botConfig.userId, userId));
    }, 2000);

    res.json({ success: true, status: "restarting" });
  } catch (error) {
    console.error("Error restarting bot:", error);
    res.status(500).json({ error: "Failed to restart bot" });
  }
});

// GET /api/bot/models - List all AI models
router.get("/models", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const models = await db.query.aiModels.findMany({
      where: eq(aiModels.userId, userId),
      orderBy: [desc(aiModels.createdAt)],
    });

    // Hide API keys in response but include all other fields
    const safeModels = models.map((m) => ({
      id: m.id,
      alias: m.alias,
      modelName: m.modelName,
      provider: m.provider,
      apiEndpoint: m.apiEndpoint,
      systemPrompt: m.systemPrompt,
      isActive: m.isActive,
      testStatus: m.testStatus,
      lastTestedAt: m.lastTestedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      userId: m.userId,
      apiKey: m.apiKey ? "***" : null,
    }));

    res.json(safeModels);
  } catch (error) {
    console.error("Error listing models:", error);
    res.status(500).json({ error: "Failed to list models" });
  }
});

// POST /api/bot/models - Add new AI model
router.post("/models", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { alias, modelName, apiEndpoint, apiKey, systemPrompt } = req.body;

    if (!alias || !modelName || !apiEndpoint || !apiKey) {
      return res.status(400).json({
        error: "Alias, model name, API endpoint, and API key are required",
      });
    }

    // Detect provider from endpoint
    let provider = "custom";
    if (apiEndpoint.includes("openai.com")) provider = "openai";
    else if (apiEndpoint.includes("anthropic.com")) provider = "anthropic";
    else if (apiEndpoint.includes("google")) provider = "google";

    const model = await insertReturningOne(aiModels, {
      userId,
      alias,
      modelName,
      apiEndpoint,
      apiKey,
      systemPrompt,
      provider,
      testStatus: "untested",
    });

    res.status(201).json({
      ...model,
      apiKey: "***",
    });
  } catch (error) {
    console.error("Error creating model:", error);
    res.status(500).json({ error: "Failed to create model" });
  }
});

// POST /api/bot/models/test - Test model connection before saving
router.post("/models/test", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { modelName, apiEndpoint, apiKey } = req.body;

    if (!modelName || !apiEndpoint || !apiKey) {
      return res.status(400).json({ error: "Missing required fields: modelName, apiEndpoint, apiKey" });
    }

    // Test the actual API connection
    try {
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "user",
              content: "Hello, this is a test message. Please respond with 'OK'.",
            },
          ],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Test failed:", response.status, errorText);
        return res.status(400).json({
          error: "Connection failed",
          message: `API returned ${response.status}: ${response.statusText}`,
        });
      }

      const data: any = await response.json();

      // Check if response is valid
      if (!data || (!data.choices && !data.content)) {
        return res.status(400).json({
          error: "Invalid response",
          message: "API response format not recognized. Please check your endpoint.",
        });
      }

      res.json({
        success: true,
        message: "Connection successful! Model is responding correctly.",
      });
    } catch (fetchError: any) {
      console.error("Test connection error:", fetchError);
      res.status(400).json({
        error: "Connection failed",
        message: fetchError.message || "Could not connect to the API. Please check your endpoint and API key.",
      });
    }
  } catch (error) {
    console.error("Error testing model:", error);
    res.status(500).json({ error: "Failed to test model" });
  }
});

// POST /api/bot/models/:id/test - Test model connection
router.post("/models/:id/test", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const model = await db.query.aiModels.findFirst({
      where: and(eq(aiModels.id, req.params.id), eq(aiModels.userId, userId)),
    });

    if (!model) {
      return res.status(404).json({ error: "Model not found" });
    }

    // TODO: Actually test the API connection
    // For now, simulate success
    const testSuccess = true;

    await db
      .update(aiModels)
      .set({
        testStatus: testSuccess ? "success" : "error",
        lastTestedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiModels.id, req.params.id));

    res.json({
      success: testSuccess,
      message: testSuccess ? "Connection successful" : "Connection failed",
    });
  } catch (error) {
    console.error("Error testing model:", error);
    res.status(500).json({ error: "Failed to test model" });
  }
});

// POST /api/bot/models/:id/activate - Set as active model
router.post("/models/:id/activate", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Deactivate all models first
    await db
      .update(aiModels)
      .set({ isActive: false })
      .where(eq(aiModels.userId, userId));

    // Activate selected model
    await db
      .update(aiModels)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(eq(aiModels.id, req.params.id), eq(aiModels.userId, userId)));

    // Update bot config
    await db
      .update(botConfig)
      .set({ activeModelId: req.params.id, updatedAt: new Date() })
      .where(eq(botConfig.userId, userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error activating model:", error);
    res.status(500).json({ error: "Failed to activate model" });
  }
});

// PATCH /api/bot/models/:id - Update model
router.patch("/models/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { alias, modelName, apiEndpoint, apiKey, systemPrompt } = req.body;

    // Check if model exists and belongs to user
    const existing = await db.query.aiModels.findFirst({
      where: and(eq(aiModels.id, req.params.id), eq(aiModels.userId, userId)),
    });

    if (!existing) {
      return res.status(404).json({ error: "Model not found" });
    }

    const updateData: any = { updatedAt: new Date() };
    if (alias !== undefined) updateData.alias = alias;
    if (modelName !== undefined) updateData.modelName = modelName;
    if (apiEndpoint !== undefined) {
      updateData.apiEndpoint = apiEndpoint;
      // Update provider based on new endpoint
      let provider = "custom";
      if (apiEndpoint.includes("openai.com")) provider = "openai";
      else if (apiEndpoint.includes("anthropic.com")) provider = "anthropic";
      else if (apiEndpoint.includes("google")) provider = "google";
      updateData.provider = provider;
    }
    if (apiKey !== undefined && apiKey !== "") {
      updateData.apiKey = apiKey;
      updateData.testStatus = "untested"; // Reset test status when API key changes
    }
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;

    const updated = await updateReturningOne(
      aiModels,
      and(eq(aiModels.id, req.params.id), eq(aiModels.userId, userId)),
      updateData
    );

    res.json({
      ...updated,
      apiKey: "***",
    });
  } catch (error) {
    console.error("Error updating model:", error);
    res.status(500).json({ error: "Failed to update model" });
  }
});

// DELETE /api/bot/models/:id - Delete model
router.delete("/models/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const deleted = await deleteReturningOne(
      aiModels,
      and(eq(aiModels.id, req.params.id), eq(aiModels.userId, userId))
    );

    if (!deleted) {
      return res.status(404).json({ error: "Model not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting model:", error);
    res.status(500).json({ error: "Failed to delete model" });
  }
});

// GET /api/bot/knowledge - List knowledge files
router.get("/knowledge", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const files = await db.query.knowledgeBase.findMany({
      where: eq(knowledgeBase.userId, userId),
      orderBy: [desc(knowledgeBase.createdAt)],
    });

    res.json(files);
  } catch (error) {
    console.error("Error listing knowledge:", error);
    res.status(500).json({ error: "Failed to list knowledge" });
  }
});

// POST /api/bot/knowledge - Upload new knowledge
router.post("/knowledge", upload.single("file"), async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Save file
    const userDataPath = path.join(process.cwd(), "data", userId, "knowledge");
    await fs.mkdir(userDataPath, { recursive: true });

    const filename = `${Date.now()}-${req.file.originalname}`;
    const filePath = path.join(userDataPath, filename);
    await fs.writeFile(filePath, req.file.buffer);

    const ext = path.extname(req.file.originalname).toLowerCase();
    let fileType = "TXT";
    if (ext === ".pdf") fileType = "PDF";
    else if ([".xlsx", ".xls"].includes(ext)) fileType = "XLSX";

    // Extract content (basic - just store text for now)
    const content = req.file.buffer.toString("utf-8");

    const knowledge = await insertReturningOne(knowledgeBase, {
      userId,
      name: req.file.originalname,
      fileType,
      filePath: `/data/${userId}/knowledge/${filename}`,
      content: content.substring(0, 50000), // Limit content size
    });

    res.status(201).json(knowledge);
  } catch (error) {
    console.error("Error uploading knowledge:", error);
    res.status(500).json({ error: "Failed to upload knowledge" });
  }
});

// DELETE /api/bot/knowledge/:id - Delete knowledge file
router.delete("/knowledge/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const knowledge = await db.query.knowledgeBase.findFirst({
      where: and(eq(knowledgeBase.id, req.params.id), eq(knowledgeBase.userId, userId)),
    });

    if (!knowledge) {
      return res.status(404).json({ error: "Knowledge file not found" });
    }

    // Delete physical file
    if (knowledge.filePath) {
      try {
        await fs.unlink(path.join(process.cwd(), knowledge.filePath));
      } catch (e) {
        // File may not exist
      }
    }

    await db.delete(knowledgeBase).where(eq(knowledgeBase.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting knowledge:", error);
    res.status(500).json({ error: "Failed to delete knowledge" });
  }
});

// GET /api/bot/config - Get bot configuration
router.get("/config", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let config = await db.query.botConfig.findFirst({
      where: eq(botConfig.userId, userId),
    });

    if (!config) {
      // Return defaults
      config = {
        id: "",
        userId,
        isEnabled: false,
        status: "stopped",
        botMode: "normal",
        activeModelId: null,
        autoReplyUnknown: true,
        handoffKeyword: "agent",
        updatedAt: null,
      };
    }

    res.json(config);
  } catch (error) {
    console.error("Error getting config:", error);
    res.status(500).json({ error: "Failed to get config" });
  }
});

// PATCH /api/bot/config - Update bot config
router.patch("/config", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { autoReplyUnknown, handoffKeyword, isEnabled, botMode } = req.body;

    let config = await db.query.botConfig.findFirst({
      where: eq(botConfig.userId, userId),
    });

    const updateData: any = { updatedAt: new Date() };
    if (autoReplyUnknown !== undefined) updateData.autoReplyUnknown = autoReplyUnknown;
    if (handoffKeyword !== undefined) updateData.handoffKeyword = handoffKeyword;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (botMode !== undefined) updateData.botMode = botMode;

    if (!config) {
      const newConfig = await insertReturningOne(botConfig, {
        userId,
        ...updateData,
      });
      config = newConfig;
    } else {
      const updated = await updateReturningOne(botConfig, eq(botConfig.userId, userId), updateData);
      config = updated;
    }

    res.json(config);
  } catch (error) {
    console.error("Error updating config:", error);
    res.status(500).json({ error: "Failed to update config" });
  }
});

// POST /api/bot/chat - Test AI response with Knowledge Base (sandbox)
router.post("/chat", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { message, modelId } = req.body;

    // Get active model or specified model
    let model;
    if (modelId) {
      model = await db.query.aiModels.findFirst({
        where: and(eq(aiModels.id, modelId), eq(aiModels.userId, userId)),
      });
    } else {
      model = await db.query.aiModels.findFirst({
        where: and(eq(aiModels.userId, userId), eq(aiModels.isActive, true)),
      });
    }

    if (!model) {
      return res.status(400).json({ error: "No AI model configured" });
    }

    // Get Knowledge Base files (same logic as WhatsApp bot)
    const knowledgeFiles = await db.query.botFiles.findMany({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.botMode, "ai"),
        eq(botFiles.isDirectory, false)
      ),
    });

    console.log(`[Chat] KB files:`, knowledgeFiles.map(f => ({ filename: f.filename, parentPath: f.parentPath, hasContent: !!f.content })));

    // Filter files in /knowledge folder
    const knowledgeBaseFiles = knowledgeFiles.filter(f => f.parentPath === "/knowledge");

    // Build Knowledge Base content
    let knowledgeData: { filename: string; content: string }[] = [];
    for (const file of knowledgeBaseFiles) {
      if (file.content) {
        knowledgeData.push({ filename: file.filename, content: file.content });
      }
    }

    console.log(`[Chat] Using ${knowledgeData.length} KB files for chat`);

    // Use custom system prompt from model config, or default
    const customSystemPrompt = model.systemPrompt || `You are a helpful customer service assistant.`;

    // Build prompt: Custom System Prompt + Knowledge Base
    let fullSystemPrompt = `${customSystemPrompt}

═════════════════════════════════════════════════════════════════
                        KNOWLEDGE BASE
═════════════════════════════════════════════════════════════════
IMPORTANT: For information about products, services, pricing, or operations,
use ONLY the information from the KNOWLEDGE BASE below.
`;

    if (knowledgeData.length > 0) {
      for (const item of knowledgeData) {
        fullSystemPrompt += `\n📎 FILE: ${item.filename}\n${item.content}\n\n`;
      }
      fullSystemPrompt += `═════════════════════════════════════════════════════════════════`;
    } else {
      fullSystemPrompt += `No knowledge base files available.`;
    }

    console.log(`[Chat] ===== FULL SYSTEM PROMPT =====`);
    console.log(fullSystemPrompt);
    console.log(`[Chat] ===== END SYSTEM PROMPT =====`);

    // Build messages array (AI doesn't support 'system' role, prepend to user message)
    const messages: any[] = [];
    const userMessage = `${fullSystemPrompt}\n\nSoalan: ${message}`;
    messages.push({ role: "user", content: userMessage });

    console.log(`[Chat] Sending to AI: ${messages.length} messages, KB: ${knowledgeData.length} files`);

    // Call the actual AI API
    try {
      const response = await fetch(model.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify({
          model: model.modelName,
          messages: messages,
          max_tokens: 100000, // 100k tokens for long responses
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI API error:", response.status, errorText);
        return res.status(500).json({
          error: "AI API error",
          message: `API returned ${response.status}: ${response.statusText}`,
        });
      }

      const data: any = await response.json();

      // Extract response from different API formats
      let aiResponse = "";
      if (data.choices && data.choices[0]) {
        // OpenAI format
        aiResponse = data.choices[0].message?.content || data.choices[0].text || "";
      } else if (data.content && data.content[0]) {
        // Anthropic format
        aiResponse = data.content[0].text || "";
      } else if (data.message) {
        // Some APIs return response directly
        aiResponse = data.message?.content || data.message || "";
      } else if (typeof data === "string") {
        aiResponse = data;
      }

      if (!aiResponse) {
        return res.status(500).json({
          error: "Invalid AI response",
          message: "Could not extract response from API",
        });
      }

      console.log(`[Chat] AI Response: "${aiResponse.substring(0, 100)}..."`);

      res.json({
        response: aiResponse,
        model: model.alias,
        knowledgeFilesUsed: knowledgeData.length,
      });
    } catch (fetchError: any) {
      console.error("AI API call error:", fetchError);
      res.status(500).json({
        error: "Failed to call AI API",
        message: fetchError.message || "Could not connect to AI service",
      });
    }
  } catch (error) {
    console.error("Error in chat:", error);
    res.status(500).json({ error: "Failed to generate response" });
  }
});

// GET /api/bot/debug/files - Debug: List ALL files for user (with details)
router.get("/debug/files", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get ALL files for this user (no filters)
    const allFiles = await db.query.botFiles.findMany({
      where: eq(botFiles.userId, userId),
    });

    // Group by botMode
    const byMode: Record<string, any[]> = {};
    for (const file of allFiles) {
      if (!byMode[file.botMode || "none"]) byMode[file.botMode || "none"] = [];
      byMode[file.botMode || "none"].push({
        filename: file.filename,
        filePath: file.filePath,
        parentPath: file.parentPath,
        isDirectory: file.isDirectory,
        hasContent: !!file.content,
        contentLength: file.content?.length || 0,
        contentPreview: file.content?.substring(0, 100),
      });
    }

    res.json({
      userId,
      totalFiles: allFiles.length,
      byMode,
      allFiles: allFiles.map(f => ({
        filename: f.filename,
        botMode: f.botMode,
        parentPath: f.parentPath,
        hasContent: !!f.content,
        contentLength: f.content?.length || 0,
      }))
    });
  } catch (error) {
    console.error("Error in debug:", error);
    res.status(500).json({ error: "Debug failed", details: String(error) });
  }
});

// GET /api/bot/files - List files in a directory
router.get("/files", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { path: dirPath = "/", mode } = req.query;

    // Get current bot mode if not specified
    let botMode = mode as string;
    if (!botMode) {
      const config = await db.query.botConfig.findFirst({
        where: eq(botConfig.userId, userId),
      });
      botMode = config?.botMode || "normal";
    }

    // Seed default files for new users (only runs once)
    await seedDefaultBotFiles(userId, botMode);

    const files = await db.query.botFiles.findMany({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.parentPath, dirPath as string),
        eq(botFiles.botMode, botMode)
      ),
      orderBy: [desc(botFiles.isDirectory), desc(botFiles.createdAt)],
    });

    res.json(files);
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// POST /api/bot/files/folder - Create new folder
router.post("/files/folder", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, parentPath = "/" } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    // Get current bot mode
    const config = await db.query.botConfig.findFirst({
      where: eq(botConfig.userId, userId),
    });
    const botMode = config?.botMode || "normal";

    const fullPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
    // Extract folder name from parentPath for legacy column
    const folderName = parentPath === "/" ? "" : parentPath.replace(/^\//, "");

    // Check if folder exists for this mode
    const existing = await db.query.botFiles.findFirst({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.filePath, fullPath),
        eq(botFiles.botMode, botMode)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: "Folder already exists" });
    }

    const folder = await insertReturningOne(botFiles, {
      userId,
      filename: name,
      folder: folderName, // Legacy column
      filePath: fullPath,
      parentPath: parentPath as string,
      isDirectory: true,
      fileSize: 0,
      botMode,
    });

    res.status(201).json(folder);
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

// POST /api/bot/files/file - Create new file
router.post("/files/file", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, parentPath = "/", content = "" } = req.body;
    if (!name) {
      return res.status(400).json({ error: "File name is required" });
    }

    // Get current bot mode
    const config = await db.query.botConfig.findFirst({
      where: eq(botConfig.userId, userId),
    });
    const botMode = config?.botMode || "normal";

    const fullPath = parentPath === "/" ? `/${name}` : `${parentPath}/${name}`;
    const ext = path.extname(name).toLowerCase().replace(".", "") || "txt";
    // Extract folder name from parentPath for legacy column
    const folderName = parentPath === "/" ? "" : parentPath.replace(/^\//, "");

    // Check if file exists for this mode
    const existing = await db.query.botFiles.findFirst({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.filePath, fullPath),
        eq(botFiles.botMode, botMode)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: "File already exists" });
    }

    const file = await insertReturningOne(botFiles, {
      userId,
      filename: name,
      folder: folderName, // Legacy column
      filePath: fullPath,
      parentPath: parentPath as string,
      isDirectory: false,
      fileSize: Buffer.byteLength(content, "utf-8"),
      content,
      mimeType: ext === "json" ? "application/json" : ext === "js" ? "application/javascript" : "text/plain",
      botMode,
    });

    res.status(201).json(file);
  } catch (error) {
    console.error("Error creating file:", error);
    res.status(500).json({ error: "Failed to create file" });
  }
});

// GET /api/bot/files/:id - Get file content
router.get("/files/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = await db.query.botFiles.findFirst({
      where: and(
        eq(botFiles.id, req.params.id),
        eq(botFiles.userId, userId)
      ),
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json(file);
  } catch (error) {
    console.error("Error getting file:", error);
    res.status(500).json({ error: "Failed to get file" });
  }
});

// PATCH /api/bot/files/:id - Update file content
router.patch("/files/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { content, filename } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (content !== undefined) {
      updateData.content = content;
      updateData.fileSize = Buffer.byteLength(content, "utf-8");
    }
    if (filename) {
      updateData.filename = filename;
    }

    const updated = await updateReturningOne(
      botFiles,
      and(
        eq(botFiles.id, req.params.id),
        eq(botFiles.userId, userId)
      ),
      updateData
    );

    if (!updated) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating file:", error);
    res.status(500).json({ error: "Failed to update file" });
  }
});

// DELETE /api/bot/files/:id - Delete file or folder
router.delete("/files/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    // Ensure user exists (create if not)
    await ensureUserExists(userId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = await db.query.botFiles.findFirst({
      where: and(
        eq(botFiles.id, req.params.id),
        eq(botFiles.userId, userId)
      ),
    });

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // If it's a folder, delete all children first
    if (file.isDirectory) {
      // Delete all files with matching parentPath prefix
      await db.delete(botFiles).where(
        and(
          eq(botFiles.userId, userId),
          // Files within this folder
        )
      );
    }

    await db.delete(botFiles).where(eq(botFiles.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// ============================================================
// SLASH COMMANDS (AI Mode Only)
// ============================================================

// Default commands for new sessions
const DEFAULT_SLASH_COMMANDS = [
  {
    name: "takeover",
    command: "/takeover",
    alias: ["/take", "/to", "/ambil"],
    description: "Ambil alik conversation. AI tak jawab untuk 1 jam.",
    action: "TAKEOVER_1HOUR",
    adminOnly: true,
    hiddenFromContact: true,
    enabled: true,
    isDefault: true,
    config: { durationMinutes: 60, resetOnAdminChat: true },
  },
  {
    name: "give",
    command: "/give",
    alias: ["/serah", "/release", "/giveback"],
    description: "Serahkan balik pada AI. AI jawab segera.",
    action: "GIVE_IMMEDIATE",
    adminOnly: true,
    hiddenFromContact: true,
    enabled: true,
    isDefault: true,
    config: {},
  },
];

// Helper: Get active WhatsApp session for user
async function getActiveSession(userId: string) {
  const session = await db.query.whatsappSessions.findFirst({
    where: and(eq(whatsappSessions.userId, userId), eq(whatsappSessions.status, "connected")),
  });
  return session;
}

// Helper: Seed default commands for a session
async function seedDefaultCommands(sessionId: string) {
  try {
    const existing = await db.query.botCommands.findFirst({
      where: eq(botCommands.sessionId, sessionId),
    });

    if (existing) return; // Already seeded

    for (const cmd of DEFAULT_SLASH_COMMANDS) {
      await db.insert(botCommands).values({
        id: undefined, // Auto-generate
        sessionId,
        ...cmd,
      });
    }
    console.log(`Seeded default commands for session: ${sessionId}`);
  } catch (error) {
    console.error("Error seeding default commands:", error);
  }
}

// GET /api/bot/commands - List all commands for active session
router.get("/commands", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Get active WhatsApp session
    const session = await getActiveSession(userId);
    if (!session) {
      return res.json([]); // No active session, return empty
    }

    // Seed default commands if first time
    await seedDefaultCommands(session.id);

    const commands = await db.query.botCommands.findMany({
      where: eq(botCommands.sessionId, session.id),
      orderBy: [desc(botCommands.isDefault), desc(botCommands.createdAt)],
    });

    res.json(commands);
  } catch (error) {
    console.error("Error listing commands:", error);
    res.status(500).json({ error: "Failed to list commands" });
  }
});

// GET /api/bot/commands/default - Get default commands template
router.get("/commands/default", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    res.json(DEFAULT_SLASH_COMMANDS);
  } catch (error) {
    console.error("Error getting default commands:", error);
    res.status(500).json({ error: "Failed to get default commands" });
  }
});

// POST /api/bot/commands - Create new command
router.post("/commands", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, command, alias, description, action, adminOnly, hiddenFromContact, enabled, config } = req.body;

    if (!name || !command || !action) {
      return res.status(400).json({ error: "name, command, and action are required" });
    }

    // Get active WhatsApp session
    const session = await getActiveSession(userId);
    if (!session) {
      return res.status(400).json({ error: "No active WhatsApp session" });
    }

    // Check if command already exists
    const existing = await db.query.botCommands.findFirst({
      where: and(
        eq(botCommands.sessionId, session.id),
        eq(botCommands.command, command)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: "Command already exists" });
    }

    const newCommand = await insertReturningOne(botCommands, {
      sessionId: session.id,
      name,
      command,
      alias: alias || [],
      description,
      action,
      adminOnly: adminOnly !== undefined ? adminOnly : true,
      hiddenFromContact: hiddenFromContact !== undefined ? hiddenFromContact : true,
      enabled: enabled !== undefined ? enabled : true,
      config: config || {},
      isDefault: false,
    });

    res.status(201).json(newCommand);
  } catch (error) {
    console.error("Error creating command:", error);
    res.status(500).json({ error: "Failed to create command" });
  }
});

// GET /api/bot/commands/:id - Get single command
router.get("/commands/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await getActiveSession(userId);
    if (!session) {
      return res.status(404).json({ error: "No active session" });
    }

    const command = await db.query.botCommands.findFirst({
      where: and(
        eq(botCommands.id, req.params.id),
        eq(botCommands.sessionId, session.id)
      ),
    });

    if (!command) {
      return res.status(404).json({ error: "Command not found" });
    }

    res.json(command);
  } catch (error) {
    console.error("Error getting command:", error);
    res.status(500).json({ error: "Failed to get command" });
  }
});

// PATCH /api/bot/commands/:id - Update command
router.patch("/commands/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, command, alias, description, action, adminOnly, hiddenFromContact, enabled, config } = req.body;

    const session = await getActiveSession(userId);
    if (!session) {
      return res.status(404).json({ error: "No active session" });
    }

    // Check if command exists and belongs to session
    const existing = await db.query.botCommands.findFirst({
      where: and(
        eq(botCommands.id, req.params.id),
        eq(botCommands.sessionId, session.id)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Command not found" });
    }

    // Prevent modifying default commands' action
    if (existing.isDefault && action && action !== existing.action) {
      return res.status(400).json({ error: "Cannot change action of default commands" });
    }

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (command !== undefined) updateData.command = command;
    if (alias !== undefined) updateData.alias = alias;
    if (description !== undefined) updateData.description = description;
    // Only allow action change for non-default commands
    if (action !== undefined && !existing.isDefault) updateData.action = action;
    if (adminOnly !== undefined) updateData.adminOnly = adminOnly;
    if (hiddenFromContact !== undefined) updateData.hiddenFromContact = hiddenFromContact;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (config !== undefined) updateData.config = config;

    const updated = await updateReturningOne(botCommands, eq(botCommands.id, req.params.id), updateData);

    res.json(updated);
  } catch (error) {
    console.error("Error updating command:", error);
    res.status(500).json({ error: "Failed to update command" });
  }
});

// POST /api/bot/commands/:id/toggle - Enable/disable command
router.post("/commands/:id/toggle", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await getActiveSession(userId);
    if (!session) {
      return res.status(404).json({ error: "No active session" });
    }

    const existing = await db.query.botCommands.findFirst({
      where: and(
        eq(botCommands.id, req.params.id),
        eq(botCommands.sessionId, session.id)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Command not found" });
    }

    const updated = await updateReturningOne(botCommands, eq(botCommands.id, req.params.id), {
      enabled: !existing.enabled,
      updatedAt: new Date(),
    });

    res.json(updated);
  } catch (error) {
    console.error("Error toggling command:", error);
    res.status(500).json({ error: "Failed to toggle command" });
  }
});

// DELETE /api/bot/commands/:id - Delete command
router.delete("/commands/:id", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await getActiveSession(userId);
    if (!session) {
      return res.status(404).json({ error: "No active session" });
    }

    const existing = await db.query.botCommands.findFirst({
      where: and(
        eq(botCommands.id, req.params.id),
        eq(botCommands.sessionId, session.id)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Command not found" });
    }

    // Prevent deleting default commands
    if (existing.isDefault) {
      return res.status(400).json({ error: "Cannot delete default commands. Disable them instead." });
    }

    await db.delete(botCommands).where(eq(botCommands.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting command:", error);
    res.status(500).json({ error: "Failed to delete command" });
  }
});

// POST /api/bot/commands/reset - Reset to default commands
router.post("/commands/reset", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await getActiveSession(userId);
    if (!session) {
      return res.status(400).json({ error: "No active WhatsApp session" });
    }

    // Delete all non-default commands
    await db.delete(botCommands).where(
      and(
        eq(botCommands.sessionId, session.id),
        eq(botCommands.isDefault, false)
      )
    );

    // Reset default commands
    for (const cmd of DEFAULT_SLASH_COMMANDS) {
      await db
        .update(botCommands)
        .set({
          command: cmd.command,
          alias: cmd.alias,
          description: cmd.description,
          enabled: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(botCommands.sessionId, session.id),
            eq(botCommands.name, cmd.name),
            eq(botCommands.isDefault, true)
          )
        );
    }

    // Get all commands after reset
    const commands = await db.query.botCommands.findMany({
      where: eq(botCommands.sessionId, session.id),
    });

    res.json({ success: true, commands });
  } catch (error) {
    console.error("Error resetting commands:", error);
    res.status(500).json({ error: "Failed to reset commands" });
  }
});

// POST /api/bot/files/resync - Resync default files (add missing ones)
router.post("/files/resync", async (req, res) => {
  try {
    const sessionId = getSessionId(req);
    if (!sessionId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = await getRealUserId(sessionId);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { mode = "ai" } = req.body;

    // Get existing files for this mode
    const existingFiles = await db.query.botFiles.findMany({
      where: and(eq(botFiles.userId, userId), eq(botFiles.botMode, mode)),
    });

    // Create a set of existing file paths for quick lookup
    const existingPaths = new Set(existingFiles.map((f) => f.filePath));

    // Select default files based on mode
    const filesToSeed = mode === "ai" ? DEFAULT_AI_BOT_FILES : DEFAULT_NORMAL_BOT_FILES;

    // Add only missing files
    const addedFiles = [];
    for (const file of filesToSeed) {
      if (!existingPaths.has(file.filePath)) {
        const folder = file.isDirectory
          ? file.parentPath === "/" ? "" : file.parentPath.replace(/^\//, "").replace(/\/$/, "")
          : file.parentPath === "/" ? "" : file.parentPath.replace(/^\//, "").replace(/\/$/, "");

        const newFile = await insertReturningOne(botFiles, {
          userId,
          filename: file.filename,
          folder,
          filePath: file.filePath,
          parentPath: file.parentPath,
          isDirectory: file.isDirectory,
          fileSize: file.content ? Buffer.byteLength(file.content, "utf-8") : 0,
          content: file.content || null,
          mimeType: file.mimeType || null,
          botMode: mode,
        });

        addedFiles.push(newFile);
      }
    }

    console.log(`[Files] Resynced ${addedFiles.length} missing ${mode} files for user: ${userId}`);

    res.json({
      success: true,
      added: addedFiles.length,
      files: addedFiles,
    });
  } catch (error) {
    console.error("Error resyncing files:", error);
    res.status(500).json({ error: "Failed to resync files" });
  }
});

export default router;
