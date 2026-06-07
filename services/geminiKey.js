function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function hasGeminiApiKey() {
  return !!getGeminiApiKey();
}

let cooldownUntil = 0;
const DEFAULT_COOLDOWN_MS = 60_000;

function isGeminiCoolingDown() {
  return Date.now() < cooldownUntil;
}

function getGeminiCooldownMs() {
  return Math.max(0, cooldownUntil - Date.now());
}

function markGeminiRateLimited(ms = DEFAULT_COOLDOWN_MS) {
  cooldownUntil = Math.max(cooldownUntil, Date.now() + ms);
}

function hasUsableGeminiApiKey() {
  return hasGeminiApiKey() && !isGeminiCoolingDown();
}

module.exports = {
  getGeminiApiKey,
  hasGeminiApiKey,
  hasUsableGeminiApiKey,
  isGeminiCoolingDown,
  getGeminiCooldownMs,
  markGeminiRateLimited,
};
