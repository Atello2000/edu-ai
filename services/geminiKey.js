function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function hasGeminiApiKey() {
  return !!getGeminiApiKey();
}

module.exports = { getGeminiApiKey, hasGeminiApiKey };
