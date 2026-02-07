/**
 * Quick script to update GLM model pricing in the database
 * Run with: node scripts/update-glm-pricing.js
 */

import { db, aiModels } from "@whatsapp-blast/database";
import { eq } from "drizzle-orm";

async function updateGLMPricing() {
  try {
    console.log("🔄 Updating GLM model pricing...");

    // Get all GLM models
    const glmModels = await db.select().from(aiModels);

    const updatedModels = [];

    for (const model of glmModels) {
      const modelName = model.modelName?.toLowerCase() || "";

      // Update GLM models with default pricing
      if (modelName.includes("glm")) {
        let inputPrice = "0.07";
        let outputPrice = "0.28";

        // Specific pricing for different GLM variants
        if (modelName.includes("glm-4-plus")) {
          inputPrice = "0.10";
          outputPrice = "0.40";
        } else if (modelName.includes("glm-4-air") || modelName.includes("glm-4-flash")) {
          inputPrice = "0.01";
          outputPrice = "0.04";
        } else if (modelName.includes("glm-3-turbo")) {
          inputPrice = "0.05";
          outputPrice = "0.25";
        }

        await db.update(aiModels)
          .set({
            inputPricePer1M: inputPrice,
            outputPricePer1M: outputPrice,
            updatedAt: new Date()
          })
          .where(eq(aiModels.id, model.id));

        updatedModels.push({
          alias: model.alias,
          modelName: model.modelName,
          newPricing: `Input: $${inputPrice}, Output: $${outputPrice}`
        });

        console.log(`✅ Updated: ${model.alias} (${model.modelName})`);
        console.log(`   Input: $${inputPrice}/1M tokens | Output: $${outputPrice}/1M tokens`);
      }
    }

    if (updatedModels.length === 0) {
      console.log("⚠️ No GLM models found in database.");
    } else {
      console.log(`\n✨ Updated ${updatedModels.length} GLM model(s)`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating GLM pricing:", error);
    process.exit(1);
  }
}

updateGLMPricing();
