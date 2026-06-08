/**
 * services/chunker.js — découpage intelligent des textes longs
 *
 * Au lieu de tronquer à 80 K chars, le texte est découpé en parties.
 * Chaque partie est traitée indépendamment, puis les résultats sont fusionnés.
 *
 * Coût en jetons : base + (chunks − 1) × 2
 *   résumé  (base=3) : 1 part→3j · 2 parts→5j · 3 parts→7j · 4 parts→9j
 *   quiz    (base=4) : 1 part→4j · 2 parts→6j · 3 parts→8j
 *   flash.  (base=3) : 1 part→3j · 2 parts→5j · 3 parts→7j
 */

const CHUNK_SIZE      = 80_000; // ~40 pages (~20 000 tokens) — Mistral / Claude
const CHUNK_SIZE_GROQ = 30_000; // ~15 pages (~7 500 tokens) — Groq free tier (TPM 12 000)

/**
 * Découpe un texte en chunks de CHUNK_SIZE caractères.
 * Coupe préférentiellement aux fins de paragraphes (\n\n),
 * puis aux fins de phrases, pour éviter de couper au milieu d'une idée.
 *
 * @param {string} text
 * @param {number} [chunkSize]
 * @returns {string[]}
 */
function splitIntoChunks(text, chunkSize = CHUNK_SIZE) {
  if (!text) return [''];
  if (text.length <= chunkSize) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    if (start + chunkSize >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    let end = start + chunkSize;
    const searchFrom = end - 4000; // zone de recherche de coupure naturelle

    // Priorité 1 : double saut de ligne (fin de paragraphe)
    const paraBreak = text.lastIndexOf('\n\n', end);
    if (paraBreak > searchFrom) {
      end = paraBreak + 2;
    } else {
      // Priorité 2 : fin de phrase
      const sentBreak = text.lastIndexOf('. ', end);
      if (sentBreak > searchFrom) end = sentBreak + 2;
      // Priorité 3 : coupure brute (rien de mieux trouvé)
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

/**
 * Calcule le coût total en jetons pour une action multi-chunk.
 *
 * @param {number} baseCost  coût normal pour 1 chunk (ex. 3 pour résumé)
 * @param {number} numChunks nombre de parties
 * @returns {number}
 */
function chunkCost(baseCost, numChunks) {
  if (numChunks <= 1) return baseCost;
  return baseCost + (numChunks - 1) * 2;
}

/** Taille de chunk adaptée au provider (limites de token et de payload pour les tiers gratuits). */
function chunkSizeFor(provider) {
  if (provider === 'groq' || provider === 'gemini' || provider === 'github') {
    return 25_000;
  }
  return CHUNK_SIZE;
}

module.exports = { CHUNK_SIZE, CHUNK_SIZE_GROQ, splitIntoChunks, chunkCost, chunkSizeFor };
