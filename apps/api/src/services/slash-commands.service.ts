import { db, botFiles, whatsappSessions, conversations } from "@whatsapp-blast/database";
import { eq, and } from "drizzle-orm";

export interface FileCommand {
  filename?: string; // Optional - set when loaded from file
  command: string;
  alias: string[];
  description: string;
  adminOnly: boolean;
  hiddenFromContact: boolean;
  enabled: boolean;
  config: any;
  action?: string; // For backward compatibility
}

export interface CommandResult {
  executed: boolean;
  response?: string;
  hideFromContact: boolean;
  editedMessage?: string;  // The edited message to replace original command (if hideFromContact=true)
  takeoverMode?: {
    enabled: boolean;
    expiresAt?: Date;
  };
}

// Get edit templates from /commands/edit-templates.js
export async function getEditTemplates(userId: string): Promise<Record<string, string>> {
  try {
    const templateFile = await db.query.botFiles.findFirst({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.botMode, "ai"),
        eq(botFiles.filePath, "/commands/edit-templates.js"),
        eq(botFiles.isDirectory, false)
      ),
    });

    if (!templateFile || !templateFile.content) {
      // Return default templates
      return {
        takeover: "Seorang manusia akan mengambil alih perbualan ini. Sila tunggu sebentar...",
        give: "AI kembali membantu anda. Ada apa-apa yang boleh saya bantu?",
        default: "Sedang diproses..."
      };
    }

    // Parse the templates file
    const match = templateFile.content.match(/module\.exports\s*=\s*(\{[\s\S]*?\});?\s*$/);
    if (match) {
      try {
        // Use Function constructor for safer parsing
        const templatesFunc = new Function(`return ${match[1]}`);
        return templatesFunc();
      } catch {
        return {};
      }
    }

    return {};
  } catch (error) {
    console.error("[Commands] Error getting edit templates:", error);
    return {
      takeover: "Seorang manusia akan mengambil alih perbualan ini.",
      give: "AI kembali membantu anda."
    };
  }
}

// Get all enabled commands from /commands files
export async function getCommandsForSession(userId: string): Promise<FileCommand[]> {
  try {
    // Get all command files from /commands folder (AI mode)
    const commandFiles = await db.query.botFiles.findMany({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.botMode, "ai"),
        eq(botFiles.parentPath, "/commands"),
        eq(botFiles.isDirectory, false)
      ),
    });

    const commands: FileCommand[] = [];

    for (const file of commandFiles) {
      if (!file.content) continue;

      try {
        // Parse the JavaScript file to extract command config
        const commandConfig = parseCommandFile(file.content);
        if (commandConfig && commandConfig.enabled !== false) {
          commands.push({
            filename: file.filename,
            command: commandConfig.command,
            alias: commandConfig.alias,
            description: commandConfig.description,
            adminOnly: commandConfig.adminOnly,
            hiddenFromContact: commandConfig.hiddenFromContact,
            enabled: commandConfig.enabled,
            config: commandConfig.config,
            action: commandConfig.action,
          });
        }
      } catch (err) {
        console.error(`[Commands] Error parsing command file ${file.filename}:`, err);
      }
    }

    return commands;
  } catch (error) {
    console.error("[Commands] Error fetching commands:", error);
    return [];
  }
}

// Parse command file content to extract config
function parseCommandFile(content: string): FileCommand | null {
  try {
    // Extract module.exports object using regex
    // Match: module.exports = { ... };
    const match = content.match(/module\.exports\s*=\s*(\{[\s\S]*?\});?\s*$/);
    if (!match) {
      return null;
    }

    // Parse the exported object
    // Use eval-like approach with Function constructor for safer parsing
    // We only parse the config, not execute the action function
    const configStr = match[1];

    // Extract properties using regex
    const commandMatch = configStr.match(/command:\s*["']([^"']+)["']/);
    const aliasMatch = configStr.match(/alias:\s*\[([\s\S]*?)\]/);
    const descMatch = configStr.match(/description:\s*["']([^"']+)["']/);
    const adminOnlyMatch = configStr.match(/adminOnly:\s*(true|false)/);
    const hiddenMatch = configStr.match(/hiddenFromContact:\s*(true|false)/);
    const enabledMatch = configStr.match(/enabled:\s*(true|false)/);
    const configMatch = configStr.match(/config:\s*(\{[\s\S]*?\n\s*\})/);

    if (!commandMatch) {
      return null;
    }

    // Parse aliases
    let alias: string[] = [];
    if (aliasMatch) {
      const aliasStr = aliasMatch[1];
      const aliasItems = aliasStr.match(/["']([^"']+)["']/g);
      if (aliasItems) {
        alias = aliasItems.map(a => a.replace(/["']/g, ''));
      }
    }

    // Parse config object
    let config = {};
    if (configMatch) {
      try {
        // Safe parse for config
        config = JSON.parse(configMatch[1].replace(/(\w+):/g, '"$1":').replace(/'/g, '"'));
      } catch {
        config = {};
      }
    }

    return {
      command: commandMatch[1],
      alias,
      description: descMatch ? descMatch[1] : "",
      adminOnly: adminOnlyMatch ? adminOnlyMatch[1] === 'true' : true,
      hiddenFromContact: hiddenMatch ? hiddenMatch[1] === 'true' : true,
      enabled: enabledMatch ? enabledMatch[1] === 'true' : true,
      config,
    };
  } catch (error) {
    console.error("[Commands] Error parsing command file:", error);
    return null;
  }
}

// Get session by user ID
async function getSessionByUser(userId: string) {
  return await db.query.whatsappSessions.findFirst({
    where: and(
      eq(whatsappSessions.userId, userId),
      eq(whatsappSessions.status, "connected")
    ),
  });
}

// Parse message to check if it's a command
export function parseCommand(message: string): string | null {
  const trimmed = message.trim();
  if (trimmed.startsWith("/")) {
    // Extract command (first word)
    const parts = trimmed.split(/\s+/);
    return parts[0]; // e.g., "/takeover", "/give"
  }
  return null;
}

// Check if a string matches any command or alias
function matchesCommand(input: string, command: FileCommand): boolean {
  const normalizedInput = input.toLowerCase().trim();

  // Check main command
  if (normalizedInput === command.command.toLowerCase()) {
    return true;
  }

  // Check aliases
  if (command.alias) {
    for (const alias of command.alias) {
      if (normalizedInput === alias.toLowerCase()) {
        return true;
      }
    }
  }

  return false;
}

// Check if sender is admin (WhatsApp owner)
function isAdmin(senderJid: string, sessionPhoneNumber: string): boolean {
  // Normalize phone numbers for comparison
  const normalizePhone = (phone: string) => phone.split("@")[0].replace(/\D/g, "");

  const senderPhone = normalizePhone(senderJid);
  const ownerPhone = normalizePhone(sessionPhoneNumber || "");

  // Debug log
  console.log(`[Commands] 🔑 Admin check: sender="${senderPhone}", owner="${ownerPhone}", match=${senderPhone === ownerPhone}, sessionPhone="${sessionPhoneNumber}"`);

  // If owner phone is empty, anyone with same phone prefix is admin (fallback)
  if (!ownerPhone) {
    console.log(`[Commands] ⚠️ No session phone number, allowing command`);
    return true;
  }

  return senderPhone === ownerPhone;
}

// Execute takeover command
async function executeTakeover(userId: string, senderJid: string, config: any): Promise<CommandResult> {
  try {
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");

    // Find or create conversation
    const existingConv = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.userId, userId),
        eq(conversations.phoneNumber, senderPhone)
      ),
    });

    const durationMinutes = config?.durationMinutes || 60;
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    if (existingConv) {
      // Update existing conversation
      await db.update(conversations)
        .set({
          takeoverMode: true,
          takeoverExpiresAt: expiresAt,
          takeoverAdminId: senderJid,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, existingConv.id));
    } else {
      // Create new conversation with takeover mode
      const [newConv] = await db.insert(conversations)
        .values({
          userId,
          phoneNumber: senderPhone,
          takeoverMode: true,
          takeoverExpiresAt: expiresAt,
          takeoverAdminId: senderJid,
        })
        .returning();
    }

    console.log(`[Commands] ✅ TAKEOVER activated for ${senderPhone} until ${expiresAt.toISOString()}`);

    // Get edit template for takeover
    const templates = await getEditTemplates(userId);
    const editedMessage = templates.takeover || templates.default || "Seorang manusia akan mengambil alih perbualan ini.";

    return {
      executed: true,
      response: "✅ Takeover mode activated. AI akan senyap untuk 1 jam.",
      hideFromContact: true,
      editedMessage,  // The message to edit the original command with
      takeoverMode: {
        enabled: true,
        expiresAt,
      },
    };
  } catch (error) {
    console.error("[Commands] Error executing takeover:", error);
    return { executed: false, hideFromContact: true };
  }
}

// Execute give command
async function executeGive(userId: string, senderJid: string): Promise<CommandResult> {
  try {
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");

    // Find conversation
    const existingConv = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.userId, userId),
        eq(conversations.phoneNumber, senderPhone)
      ),
    });

    if (existingConv && existingConv.takeoverMode) {
      // Disable takeover mode
      await db.update(conversations)
        .set({
          takeoverMode: false,
          takeoverExpiresAt: null,
          takeoverAdminId: null,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, existingConv.id));

      console.log(`[Commands] ✅ GIVE executed - takeover disabled for ${senderPhone}`);
    }

    // Get edit template for give
    const templates = await getEditTemplates(userId);
    const editedMessage = templates.give || templates.default || "AI kembali membantu anda.";

    return {
      executed: true,
      response: "✅ Takeover mode ended. AI akan jawab semula.",
      hideFromContact: true,
      editedMessage,  // The message to edit the original command with
      takeoverMode: {
        enabled: false,
      },
    };
  } catch (error) {
    console.error("[Commands] Error executing give:", error);
    return { executed: false, hideFromContact: true };
  }
}

// Execute a command
export async function executeCommand(
  userId: string,
  commandInput: string,
  senderJid: string,
  botMode: string,
  fromMe: boolean = false  // CRITICAL: true = sent by WhatsApp owner (admin), false = sent by contact
): Promise<CommandResult> {
  // Only process commands in AI mode
  if (botMode !== "ai") {
    return { executed: false, hideFromContact: false };
  }

  // Get all enabled command files
  const commands = await getCommandsForSession(userId);
  if (commands.length === 0) {
    console.log("[Commands] No commands configured");
    return { executed: false, hideFromContact: false };
  }

  // Find matching command
  const matchedCommand = commands.find(cmd => matchesCommand(commandInput, cmd));
  if (!matchedCommand) {
    console.log(`[Commands] No matching command found for: ${commandInput}`);
    return { executed: false, hideFromContact: false };
  }

  // Check if admin only - fromMe=true means admin sent it (WhatsApp owner)
  if (matchedCommand.adminOnly) {
    if (!fromMe) {
      console.log(`[Commands] ❌ Command "${matchedCommand.command}" is admin only - sent by contact, not admin`);
      return { executed: false, hideFromContact: false }; // Treat as normal message
    }
    console.log(`[Commands] ✅ Admin verified via fromMe=true for command: ${matchedCommand.command}`);
  }

  console.log(`[Commands] ✅ Executing command: ${matchedCommand.command}`);

  // Execute based on command name
  switch (matchedCommand.command) {
    case "/takeover":
      return await executeTakeover(userId, senderJid, matchedCommand.config);

    case "/give":
      return await executeGive(userId, senderJid);

    default:
      console.log(`[Commands] ⚠️ Unknown command: ${matchedCommand.command}`);
      return { executed: false, hideFromContact: false };
  }
}

// Check if conversation is in takeover mode and if it has expired
export async function checkTakeoverStatus(
  userId: string,
  senderJid: string,
  fromMe: boolean = false  // CRITICAL: true = sent by WhatsApp owner (admin)
): Promise<{ inTakeover: boolean; isAdmin: boolean; shouldReset: boolean }> {
  try {
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");

    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.userId, userId),
        eq(conversations.phoneNumber, senderPhone)
      ),
    });

    if (!conversation || !conversation.takeoverMode) {
      return { inTakeover: false, isAdmin: false, shouldReset: false };
    }

    // Check if expired
    if (conversation.takeoverExpiresAt && new Date() > conversation.takeoverExpiresAt) {
      // Auto-expire takeover
      await db.update(conversations)
        .set({
          takeoverMode: false,
          takeoverExpiresAt: null,
          takeoverAdminId: null,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversation.id));

      console.log(`[Commands] ⏰ Takeover expired for ${senderPhone}`);
      return { inTakeover: false, isAdmin: false, shouldReset: true };
    }

    // Check if sender is admin - fromMe=true means admin sent it
    // No need to compare phone numbers - WhatsApp already verified this
    const isAdminUser = fromMe;

    return {
      inTakeover: true,
      isAdmin: isAdminUser,
      shouldReset: false,
    };
  } catch (error) {
    console.error("[Commands] Error checking takeover status:", error);
    return { inTakeover: false, isAdmin: false, shouldReset: false };
  }
}

// Reset takeover timer when admin chats
export async function resetTakeoverTimer(userId: string, senderJid: string): Promise<void> {
  try {
    const senderPhone = senderJid.split("@")[0].replace(/\D/g, "");

    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.userId, userId),
        eq(conversations.phoneNumber, senderPhone)
      ),
    });

    if (conversation && conversation.takeoverMode) {
      // Reset timer to 1 hour from now
      const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.update(conversations)
        .set({
          takeoverExpiresAt: newExpiresAt,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversation.id));

      console.log(`[Commands] ⏰ Takeover timer reset for ${senderPhone} until ${newExpiresAt.toISOString()}`);
    }
  } catch (error) {
    console.error("[Commands] Error resetting takeover timer:", error);
  }
}
