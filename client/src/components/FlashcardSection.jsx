import { useState } from 'react';
import { getSRSStatus, getSRSLabel } from '../hooks/useFlashcards.js';

/* ── Icônes SVG ──────────────────────────────────────────────────────────── */
const IcoShuffle = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>;
const IcoRefresh = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>;
const IcoXCircle = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
const IcoCheck   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoX       = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoCards   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="16" height="12" rx="2"/><path d="M6 8V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/></svg>;
const IcoRepeat  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;

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
            <button className="fc-card-no-btn"  onClick={() => handleMark('review')}><IcoX /> À revoir</button>
            <button className="fc-card-yes-btn" onClick={() => handleMark('known')}><IcoCheck /> Je sais</button>
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
              {srsOnlyDue ? <><IcoCards /> Toutes les cartes</> : <><IcoRepeat /> Révision espacée</>}
            </button>
            <button className="fc-tool-btn" id="fc-shuffle" onClick={onShuffle}><IcoShuffle /> Mélanger</button>
            <button className="fc-tool-btn" id="fc-restart" onClick={onRestart}><IcoRefresh /> Reprendre</button>
            <button className="fc-tool-btn" id="fc-redo-wrong" onClick={onRedoWrong}><IcoXCircle /> Revoir erronées</button>
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
