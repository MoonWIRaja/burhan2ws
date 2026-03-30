import { db, botFiles, botConfig, aiModels, conversations } from "@whatsapp-blast/database";
import { eq, and } from "drizzle-orm";
import { whatsappInstances } from "@whatsapp-blast/whatsapp";
import {
  parseCommand,
  executeCommand,
  checkTakeoverStatus,
  resetTakeoverTimer,
  CommandResult,
} from "./slash-commands.service.js";

interface BotMessage {
  from: string; // JID of sender
  fromMe: boolean;
  body: string;
  timestamp: number;
  messageKey?: any; // Full message key for deleting messages
}

export interface BotResponse {
  reply: string | null;  // The reply to send
  editOriginal: string | null;  // The edited text to replace original message (for commands)
  inputTokens?: number;  // Input tokens used (for cost tracking)
  outputTokens?: number; // Output tokens used (for cost tracking)
  cost?: string;         // Calculated AI cost in RM (e.g., "0.0123")
}

interface AiModeResult {
  response: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: string;
}

// Normalize phone number (remove @s.whatsapp.net suffix and special chars)
function normalizePhoneNumber(phone: string): string {
  if (!phone) return phone;
  return phone.split("@")[0].replace(/\D/g, "");
}

// Process incoming message and return response
export async function processBotMessage(userId: string, message: BotMessage): Promise<BotResponse> {
  try {
    console.log(`[Bot] 📨 Processing message from ${message.from}: "${message.body}" (userId: ${userId})`);

    // Get bot config
    const config = await db.query.botConfig.findFirst({
      where: eq(botConfig.userId, userId),
    });

    console.log(`[Bot] 📋 Config found: ${config ? "YES" : "NO"}, isEnabled: ${config?.isEnabled || false}`);

    if (!config) {
      console.log(`[Bot] ❌ No bot config found for user ${userId}`);
      return { reply: null, editOriginal: null };
    }

    if (!config.isEnabled) {
      console.log(`[Bot] ⏸️ Bot is disabled for user ${userId}`);
      return { reply: null, editOriginal: null };
    }

    // Check conversation-level AI setting (from /chat page)
    // AI only replies if BOTH global bot is enabled AND conversation AI is enabled
    const senderPhone = normalizePhoneNumber(message.from);

    // Get all conversations and find by normalized phone
    const allConversations = await db.query.conversations.findMany({
      where: eq(conversations.userId, userId),
    });

    const conversation = allConversations.find(c => {
      const convPhone = normalizePhoneNumber(c.phoneNumber);
      return convPhone === senderPhone;
    });

    if (conversation && conversation.isAiEnabled === false) {
      console.log(`[Bot] 🔇 AI disabled for this conversation (from /chat toggle)`);
      return { reply: null, editOriginal: null };
    }

    const botMode = config.botMode || "normal";
    console.log(`[Bot] 🤖 Mode: ${botMode}, activeModelId: ${config.activeModelId || "none"}`);

    // ============================================================
    // SLASH COMMANDS HANDLING (AI Mode Only)
    // ============================================================
    if (botMode === "ai") {
      const commandInput = parseCommand(message.body);

      if (commandInput) {
        console.log(`[Bot] 🎯 Command detected: ${commandInput}, fromMe=${message.fromMe}`);

        // Execute the command - pass fromMe to check admin properly
        const result: CommandResult = await executeCommand(
          userId,
          commandInput,
          message.from,
          botMode,
          message.fromMe  // CRITICAL: fromMe=true means admin (WhatsApp owner) sent this
        );

        if (result.executed) {
          console.log(`[Bot] ✅ Command executed successfully`);

          // If command says hide from contact, edit the original message with template
          if (result.hideFromContact) {
            const editedMessage = result.editedMessage || result.response || null;
            console.log(`[Bot] ✏️ Command message will be edited to: "${editedMessage}"`);
            return { reply: null, editOriginal: editedMessage };
          }

          // Otherwise return the response
          return { reply: result.response || null, editOriginal: null };
        }

        // Command not executed, continue to normal processing
      }

      // ============================================================
      // TAKEOVER MODE CHECK
      // ============================================================
      const takeoverStatus = await checkTakeoverStatus(userId, message.from, message.fromMe);

      if (takeoverStatus.inTakeover) {
        if (takeoverStatus.isAdmin) {
          // Admin is chatting - reset timer and let message through
          console.log(`[Bot] 👑 Admin chatting in takeover mode - resetting timer`);
          await resetTakeoverTimer(userId, message.from);
          // Admin's message will be sent normally (not processed by AI)
          return { reply: null, editOriginal: null };
        } else {
          // Contact is chatting - SILENCE AI
          console.log(`[Bot] 🔇 Takeover mode active - AI silenced for contact`);
          return { reply: null, editOriginal: null };
        }
      }
    }

    let response: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    if (botMode === "normal") {
      // Normal mode: execute handlers from File Manager
      response = await processNormalMode(userId, message);
    } else if (botMode === "ai") {
      // AI mode: call AI with Knowledge Base
      const aiResult = await processAIMode(userId, message, config.activeModelId);
      if (aiResult) {
        response = aiResult.response;
        inputTokens = aiResult.inputTokens || 0;
        outputTokens = aiResult.outputTokens || 0;
      }
    }

    if (response) {
      console.log(`[Bot] ✅ Response: "${response.substring(0, 100)}${response.length > 100 ? "..." : ""}"`);
    } else {
      console.log(`[Bot] ⚠️ No response generated`);
    }

    return {
      reply: response,
      editOriginal: null,
      inputTokens,
      outputTokens
    };
  } catch (error) {
    console.error("[Bot] ❌ Error processing message:", error);
    return { reply: null, editOriginal: null };
  }
}

// Normal mode: Execute handlers from File Manager
async function processNormalMode(userId: string, message: BotMessage): Promise<string | null> {
  try {
    // Get all handler files from File Manager
    const handlers = await db.query.botFiles.findMany({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.botMode, "normal"),
        eq(botFiles.isDirectory, false)
      ),
    });

    // Get main.js handler content
    const mainHandler = handlers.find(f => f.filePath === "/handlers/main.js");

    if (!mainHandler || !mainHandler.content) {
      console.log(`[Bot] No main.js handler found`);
      return null;
    }

    // Execute the handler (simple eval - in production use vm2 or similar)
    const userMessage = message.body.toLowerCase();

    // Create a safe execution context
    const handleMessage = new Function(
      "message",
      `
      ${mainHandler.content}
      return handleMessage({ body: message });
      `
    );

    const result = handleMessage(userMessage);

    if (result && typeof result === "string") {
      return result;
    }

    return null;
  } catch (error) {
    console.error("[Bot] Error in normal mode:", error);
    return null;
  }
}

// AI mode: Call AI API with Knowledge Base context
async function processAIMode(userId: string, message: BotMessage, activeModelId?: string | null): Promise<AiModeResult | null> {
  try {
    // Get active AI model
    let model;
    if (activeModelId) {
      model = await db.query.aiModels.findFirst({
        where: and(eq(aiModels.id, activeModelId), eq(aiModels.userId, userId)),
      });
    }

    if (!model) {
      model = await db.query.aiModels.findFirst({
        where: and(eq(aiModels.userId, userId), eq(aiModels.isActive, true)),
      });
    }

    if (!model) {
      console.log(`[Bot] No AI model configured`);
      return null;
    }

    console.log(`[Bot] Using AI model: ${model.alias} (${model.modelName})`);

    // Get knowledge base files from /knowledge folder
    const knowledgeFiles = await db.query.botFiles.findMany({
      where: and(
        eq(botFiles.userId, userId),
        eq(botFiles.botMode, "ai"),
        eq(botFiles.isDirectory, false)
      ),
    });

    console.log(`[Bot] ALL files for userId ${userId} (botMode=ai):`, knowledgeFiles.map(f => ({ filename: f.filename, parentPath: f.parentPath, hasContent: !!f.content, contentLength: f.content?.length || 0 })));

    // Filter files in /knowledge folder
    const knowledgeBaseFiles = knowledgeFiles.filter(f => f.parentPath === "/knowledge");

    console.log(`[Bot] Knowledge Base files found: ${knowledgeBaseFiles.length} files`);
    console.log(`[Bot] KB files details:`, knowledgeBaseFiles.map(f => ({ filename: f.filename, parentPath: f.parentPath, hasContent: !!f.content, contentLength: f.content?.length || 0 })));

    // Build knowledge base content
    let knowledgeFileList: string[] = [];
    let knowledgeData: { filename: string; content: string }[] = [];

    for (const file of knowledgeBaseFiles) {
      console.log(`[Bot] Processing file: ${file.filename}, content exists: ${!!file.content}, length: ${file.content?.length || 0}`);
      if (file.content) {
        knowledgeData.push({ filename: file.filename, content: file.content });
        knowledgeFileList.push(file.filename);
        console.log(`[Bot] Added to KB: ${file.filename} (${file.content.length} chars)`);
      }
    }

    console.log(`[Bot] Final Knowledge Base: ${knowledgeData.length} files - ${knowledgeFileList.join(", ")}`);

    // Try web search if enabled (DuckDuckGo - free, no API key needed)
    let webSearchContext: string | null = null;
    const shouldSearchWeb = knowledgeData.length === 0 || !knowledgeData.some(k => k.content.toLowerCase().includes(message.body.toLowerCase()));

    if (shouldSearchWeb) {
      try {
        console.log(`[Bot] Attempting web search for: "${message.body}"`);
        webSearchContext = await searchWeb(message.body);
        if (webSearchContext) {
          console.log(`[Bot] Web search found: ${webSearchContext.length} chars`);
        }
      } catch (searchError) {
        console.log(`[Bot] Web search failed:`, searchError);
      }
    }

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

    // Build messages array (AI doesn't support 'system' role, prepend to user message)
    const messages: any[] = [];

    // User message with Knowledge Base prepended
    let userMessage = `${fullSystemPrompt}\n\nSoalan: ${message.body}`;

    if (webSearchContext) {
      userMessage += `\n\n[Tambahan dari Web Search: ${webSearchContext}]`;
    }

    messages.push({ role: "user", content: userMessage });

    console.log(`[Bot] Sending to AI: ${messages.length} messages, KB: ${knowledgeData.length} files, prompt: ${fullSystemPrompt.length} chars`);
    console.log(`[Bot] AI Model: ${model.alias} | Endpoint: ${model.apiEndpoint}`);
    console.log(`[Bot] System prompt preview:`, fullSystemPrompt.substring(0, 300) + "...");
    console.log(`[Bot] User message:`, userMessage.substring(0, 500) + "...");
    console.log(`[Bot] ==================== FULL AI REQUEST (truncated) ====================`);

    // Call AI API
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
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bot] AI API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data: any = await response.json();

    // Extract response and token usage from different API formats
    let aiResponse = "";
    let inputTokens = 0;
    let outputTokens = 0;

    if (data.choices && data.choices[0]) {
      // OpenAI format
      aiResponse = data.choices[0].message?.content || data.choices[0].text || "";
      // Extract token usage
      if (data.usage) {
        inputTokens = data.usage.prompt_tokens || 0;
        outputTokens = data.usage.completion_tokens || 0;
      }
    } else if (data.content && data.content[0]) {
      // Anthropic format
      aiResponse = data.content[0].text || "";
      // Extract token usage
      if (data.usage) {
        inputTokens = data.usage.input_tokens || 0;
        outputTokens = data.usage.output_tokens || 0;
      }
    } else if (data.message) {
      // Some APIs return response directly
      aiResponse = data.message?.content || data.message || "";
    }

    console.log(`[Bot] AI Response length: ${aiResponse?.length || 0} chars`);
    console.log(`[Bot] Tokens: input=${inputTokens}, output=${outputTokens}`);

    // Calculate cost
    const inputPricePer1M = parseFloat(model.inputPricePer1M || "0");
    const outputPricePer1M = parseFloat(model.outputPricePer1M || "0");
    const inputCost = (inputTokens / 1_000_000) * inputPricePer1M;
    const outputCost = (outputTokens / 1_000_000) * outputPricePer1M;
    const totalCost = inputCost + outputCost;
    console.log(`[Bot] AI Cost: RM ${totalCost.toFixed(4)} (input: RM ${inputCost.toFixed(4)}, output: RM ${outputCost.toFixed(4)})`);

    return {
      response: aiResponse,
      inputTokens,
      outputTokens,
      cost: totalCost.toFixed(4)
    };
  } catch (error) {
    console.error("[Bot] Error in AI mode:", error);
    return null;
  }
}

// Free web search using DuckDuckGo Instant Answer API (no API key needed)
async function searchWeb(query: string): Promise<string | null> {
  try {
    // Clean the query - remove special characters, keep it simple
    const cleanQuery = encodeURIComponent(query.substring(0, 100));

    // DuckDuckGo Instant Answer API (free, no auth needed)
    const ddgUrl = `https://api.duckduckgo.com/?q=${cleanQuery}&format=json`;

    const response = await fetch(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();

    let results: string[] = [];

    // Get Abstract (main answer)
    if (data.Abstract) {
      results.push(`Answer: ${data.Abstract}`);
    } else if (data.AbstractText) {
      results.push(`Answer: ${data.AbstractText}`);
    } else if (data.Answer) {
      results.push(`Answer: ${data.Answer}`);
    }

    // Get AbstractSource/AbstractURL
    if (data.AbstractSource && data.AbstractURL) {
      results.push(`Source: ${data.AbstractSource} - ${data.AbstractURL}`);
    }

    // Get Infobox (structured data)
    if (data.Infobox && data.Infobox.content) {
      const infoContent = data.Infobox.content as any[];
      if (Array.isArray(infoContent)) {
        for (const item of infoContent.slice(0, 5)) {
          if (item.label && item.value) {
            results.push(`${item.label}: ${item.value}`);
          }
        }
      }
    }

    // Get RelatedTopics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      const related = data.RelatedTopics.slice(0, 3) as any[];
      for (const topic of related) {
        if (topic.Text && topic.FirstURL) {
          results.push(`• ${topic.Text}`);
          if (results.length >= 5) break;
        }
      }
    }

    if (results.length > 0) {
      return results.join("\n");
    }

    return null;
  } catch (error) {
    // Silently fail - web search is optional
    console.log(`[Bot] Web search failed for "${query}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

// Send reply via WhatsApp
export async function sendBotReply(userId: string, toJid: string, message: string, inputTokens: number = 0, outputTokens: number = 0, aiCost: string = "0"): Promise<boolean> {
  try {
    const wa = whatsappInstances.get(userId);
    if (!wa) {
      console.log(`[Bot] No WhatsApp instance for ${userId}`);
      return false;
    }

    // Check if connected
    if (!wa.isConnected()) {
      console.log(`[Bot] WhatsApp not connected for ${userId}`);
      return false;
    }

    // Remove @s.whatsapp.net if present and add it back
    const jid = toJid.includes("@s.whatsapp.net") ? toJid : `${toJid}@s.whatsapp.net`;

    await wa.sendTextMessage(jid, message);
    console.log(`[Bot] ✅ Reply sent to ${jid}: "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`);

    // Save the AI reply to database with isFromAi=true and token data
    const { saveMessage } = await import("./message-storage.service.js");
    await saveMessage(userId, jid, message, true, Date.now(), undefined, undefined, true, inputTokens, outputTokens, aiCost);
    console.log(`[Bot] 💾 AI reply saved - tokens: ${inputTokens}in + ${outputTokens}out, cost: RM ${aiCost}`);

    return true;
  } catch (error) {
    console.error("[Bot] Error sending reply:", error);
    return false;
  }
}
