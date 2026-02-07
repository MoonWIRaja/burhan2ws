import { db, users, whatsappSessions, botFiles, botConfig, aiModels, knowledgeBase, contacts, tags, campaigns, conversations, contactTags } from "@whatsapp-blast/database";

/**
 * RESET ALL USER DATA
 *
 * This script deletes ALL users and their associated data.
 * Use this for testing purposes to start fresh.
 */

async function resetAllUsers() {
  console.log("🔄 Starting complete user data reset...\n");

  try {
    // Delete in order of dependencies to avoid foreign key violations
    console.log("📋 Deleting campaigns...");
    await db.delete(campaigns);
    console.log("   ✅ Campaigns deleted");

    console.log("📋 Deleting conversations...");
    await db.delete(conversations);
    console.log("   ✅ Conversations deleted");

    console.log("📋 Deleting contact-tag relations...");
    await db.delete(contactTags);
    console.log("   ✅ Contact-tag relations deleted");

    console.log("📋 Deleting contacts...");
    await db.delete(contacts);
    console.log("   ✅ Contacts deleted");

    console.log("📋 Deleting tags...");
    await db.delete(tags);
    console.log("   ✅ Tags deleted");

    console.log("📋 Deleting knowledge base...");
    await db.delete(knowledgeBase);
    console.log("   ✅ Knowledge base deleted");

    console.log("📋 Deleting AI models...");
    await db.delete(aiModels);
    console.log("   ✅ AI models deleted");

    console.log("📋 Deleting bot config...");
    await db.delete(botConfig);
    console.log("   ✅ Bot config deleted");

    console.log("📋 Deleting bot files...");
    await db.delete(botFiles);
    console.log("   ✅ Bot files deleted");

    console.log("📋 Deleting WhatsApp sessions...");
    await db.delete(whatsappSessions);
    console.log("   ✅ WhatsApp sessions deleted");

    console.log("📋 Deleting users...");
    await db.delete(users);
    console.log("   ✅ Users deleted");

    console.log("\n✨ Reset complete! All user data has been deleted.");
    console.log("\n📝 Next steps:");
    console.log("   1. Clear your browser cookies (session_id)");
    console.log("   2. Refresh the page");
    console.log("   3. Login with WhatsApp QR");
    console.log("   4. Profile setup popup should appear\n");

  } catch (error) {
    console.error("❌ Error during reset:", error);
    process.exit(1);
  }
}

// Run the reset
resetAllUsers()
  .then(() => {
    console.log("✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
