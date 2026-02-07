-- Update GLM 4.7 model pricing
-- USD prices converted from official Zhipu AI pricing
UPDATE ai_models
SET
  input_price_per_1m = '0.07',
  output_price_per_1m = '0.28',
  updated_at = NOW()
WHERE model_name LIKE '%glm-4.7%' OR model_name LIKE '%glm-4%';

-- Verify update
SELECT id, alias, model_name, input_price_per_1m, output_price_per_1m
FROM ai_models
WHERE model_name LIKE '%glm%';
