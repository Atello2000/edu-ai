import { useState } from 'react';
import { getSRSStatus, getSRSLabel } from '../hooks/useFlashcards.js';

/* ── Carte individuelle ───────────────────────────────────────────────────── */
function FlashCard({ card, cardIdx, state, onMark }) {
  const [flipped, setFlipped] = useState(false);
  const status = getSRSStatus(card.front);
  const label  = getSRSLabel(card.front);

  function handleFlip(e) {
    if (e.target.closest('.fc-card-btns')) return;
    setFlipped(f => !f);
  }

  function handleMark(s) {
    onMark(cardIdx, s);
    setFlipped(false);
  }

  let cls = 'fc-card';
  if (state === 'known')  cls += ' fc-known';
  if (state === 'review') cls += ' fc-review';
  if (flipped)            cls += ' flipped';

  return (
    <div className={cls} onClick={handleFlip}>
      {label && <div className={`fc-card-srs-badge ${status || ''}`}>{label}</div>}
      <div className="fc-card-inner">
        <div className="fc-card-front">
          <div className="fc-card-lbl">Question</div>
          <div className="fc-card-q">{card.front}</div>
          <div className="fc-card-hint">Cliquez pour voir la réponse</div>
        </div>
        <div className="fc-card-back">
          <div className="fc-card-lbl">Réponse</div>
          <div className="fc-card-a">{card.back}</div>
          <div className="fc-card-btns">
            <button className="fc-card-no-btn"  onClick={() => handleMark('review')}>✗ À revoir</button>
            <button className="fc-card-yes-btn" onClick={() => handleMark('known')}>✓ Je sais</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Composant principal ──────────────────────────────────────────────────── */
/**
 * Props :
 *   decks       [{ name, cards }]
 *   deckIdx     number
 *   cards       [{ front, back }]   — deck courant (peut être mélangé)
 *   cardStates  { [idx]: 'known'|'review' }
 *   srsOnlyDue  bool
 *   onMark      (idx, state) => void
 *   onShuffle   () => void
 *   onRestart   () => void
 *   onRedoWrong () => void
 *   onSwitchDeck(idx) => void
 *   onToggleSrs () => void
 */
export default function FlashcardSection({
  decks, deckIdx, cards, cardStates, srsOnlyDue,
  onMark, onShuffle, onRestart, onRedoWrong, onSwitchDeck, onToggleSrs,
}) {
  if (!decks.length) return null;

  const known     = Object.values(cardStates).filter(s => s === 'known').length;
  const review    = Object.values(cardStates).filter(s => s === 'review').length;
  const remaining = cards.length - known - review;

  // Filter for SRS mode
  const dueCards = srsOnlyDue
    ? cards.map((c, i) => ({ c, i })).filter(({ c }) => getSRSStatus(c.front) === 'due')
    : cards.map((c, i) => ({ c, i }));

  // Sort: due first, then soon, learned, new
  const order = { due: 0, soon: 1, learned: 2, null: 3 };
  const sortedCards = [...dueCards].sort(
    (a, b) => (order[getSRSStatus(a.c.front)] ?? 3) - (order[getSRSStatus(b.c.front)] ?? 3)
  );

  const dueCount = cards.filter(c => getSRSStatus(c.front) === 'due').length;

  return (
    <>
      {/* Tabs — plusieurs fichiers */}
      {decks.length > 1 && (
        <div id="fc-file-tabs" style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {decks.map((d, i) => (
            <button
              key={i}
              className={`fc-tab${i === deckIdx ? ' active' : ''}`}
              onClick={() => onSwitchDeck(i)}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats bar */}
      <div id="fc-viewer">
        <div className="fc-stats">
          <div className="fc-stat">
            <span className="fc-stat-val" id="fc-known-count">{known}</span>
            <span className="fc-stat-lbl">Sus</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-val" id="fc-review-count">{review}</span>
            <span className="fc-stat-lbl">À revoir</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-val" id="fc-remaining-count">{remaining}</span>
            <span className="fc-stat-lbl">Restantes</span>
          </div>
        </div>
        <div className="fc-progress-bar">
          <div id="fc-bar" style={{ width: `${cards.length ? (known / cards.length) * 100 : 0}%` }} />
        </div>

        {/* Toolbar */}
        <div className="fc-toolbar">
          <span className="fc-progress-info" id="fc-progress-info">
            {cards.length} carte{cards.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button
              id="srs-mode-btn"
              className={`fc-tool-btn${srsOnlyDue ? ' active' : ''}`}
              onClick={onToggleSrs}
            >
              {srsOnlyDue
                ? '📋 Toutes les cartes'
                : '🧠 Révision espacée'}
            </button>
            <button className="fc-tool-btn" id="fc-shuffle"  onClick={onShuffle}>🔀 Mélanger</button>
            <button className="fc-tool-btn" id="fc-restart"  onClick={onRestart}>↺ Reprendre</button>
            <button className="fc-tool-btn" id="fc-redo-wrong" onClick={onRedoWrong}>✗ Revoir erronées</button>
          </div>
        </div>

        {/* SRS due count */}
        {srsOnlyDue && (
          <div id="fc-srs-bar" className="fc-srs-bar">
            <span id="srs-due-label">{dueCount} carte{dueCount !== 1 ? 's' : ''} due{dueCount !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Grid */}
        <div id="fc-grid">
          {sortedCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontFamily: "'DM Mono',monospace", fontSize: '.8rem' }}>
              Aucune carte due pour aujourd&apos;hui ✓
            </div>
          ) : (
            <div className="fc-cat-group">
              <div className="fc-cat-title">
                {decks[deckIdx]?.name}{' '}
                <span className="fc-cat-count">{sortedCards.length} cartes</span>
              </div>
              <div className="fc-cards-grid">
                {sortedCards.map(({ c, i }) => (
                  <FlashCard
                    key={i}
                    card={c}
                    cardIdx={i}
                    state={cardStates[i]}
                    onMark={onMark}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
