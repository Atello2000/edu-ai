# Design System: EDU AI

## 1. Visual Theme & Atmosphere

A premium, restrained product interface built for focused academic work. The atmosphere is clinical yet warm — like a well-lit study environment at night. Deep Space Navy backgrounds recede into darkness, letting content and semantic color carry hierarchy. Gold accents signal quality and editorial weight; the typefaces reinforce this duality between a distinguished academic tool and modern software.

**Density:** 5/10 — Daily App Balanced. Information-rich but not overwhelming. White space is generous in content areas; toolbars and panels are compact.

**Variance:** 4/10 — Offset Symmetric. Layouts are primarily structured but allow intentional asymmetry in headers and editorial moments.

**Motion:** 4/10 — Fluid CSS. Transitions are purposeful and short (150–250ms). No choreography on page load; motion communicates state change only.

---

## 2. Color Palette & Roles

### Dark theme (default)

- **Deep Space Navy** (`#070b14`) — Primary background. Never pure black; deep tinted navy creates depth.
- **Midnight Surface** (`#0d1422`) — Secondary background, panel backgrounds, side areas.
- **Slate Card** (`#111827`) — Card and container fill. Blue tint distinguishes from background.
- **Navy Border** (`#1e2d4a`) — Card borders, dividers. Hue-matched to background family.
- **Subtle Border** (`#162038`) — Sub-borders, lighter structural lines.
- **Cool White** (`#e8ecf6`) — Primary text. Slightly blue-tinted; never pure white.
- **Steel Blue Muted** (`#6b7fa3`) — Secondary text, metadata, placeholders, disabled states.
- **Warm Gold** (`#d4a94c`) — Brand accent. Premium headings, active states, key UI moments. Saturation ~62%.
- **Electric Blue** (`#3d7eff`) — Primary CTA, links, focus indicators. High saturation justified for interactive affordance.
- **Emerald Teal** (`#1dd1a1`) — Success states, completion indicators, quiz correct answers.
- **Soft Violet** (`#a78bfa`) — Flashcard and spaced-repetition UI. Functional semantic, NOT decorative.
- **Coral Rose** (`#ff6b81`) — Error states, quiz wrong answers, destructive actions, warnings.
- **Warm Gold Glow** (`rgba(212,169,76,.28)`) — Shadow tint for gold-accented elements.
- **Electric Blue Glow** (`rgba(61,126,255,.32)`) — Shadow tint for primary CTAs and focus rings.

### Light theme (secondary)

- **Parchment** (`#f2f1ed`) — Warm off-white background. Never pure white.
- **Warm Stone** (`#78716c`) — Muted text in light mode.

### Color rules

- No pure black (`#000000`) anywhere — use Deep Space Navy or Slate Card.
- No neon purple or blue gradients as the primary aesthetic. Violet and blue are functional/semantic only.
- No oversaturated decorative accents. Semantic colors (teal, rose, violet) carry meaning — do not reuse them for decoration.
- System is entirely cool/blue-tinted. Never mix warm and cool grays.
- Maximum one brand accent (Warm Gold) per surface. Blue/teal/violet/rose are semantic, not accent.

---

## 3. Typography Rules

- **Display / Editorial:** `Cormorant Garamond` — Used only for hero titles and editorial moments. Track-tight, large scale. NEVER in UI labels, buttons, data, or compact panels.
- **UI / Body:** `Outfit` — All interface text: headings, body, buttons, labels, metadata. Geometric sans, clean across all weights.
- **Mono:** `DM Mono` — Labels, timestamps, short codes. `JetBrains Mono` or `Fira Code` for code blocks.
- **Scale ratio:** 1.2 between steps. Tighter than brand surfaces — product UI needs density.
- **Line length:** Max `65ch` for body prose. Panels and data UI can be denser.
- **Weights in use:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold). Avoid 300 (thin) in small UI text.
- **Letter-spacing:** Negative tracking (`-0.01em` to `-0.02em`) on large headings. Positive (`+0.04em`) on small uppercase labels.
- **Banned:** `Inter` (Outfit fills this role). Generic serif fonts (`Times New Roman`, `Georgia`) banned everywhere. `Cormorant Garamond` only at display scale.

---

## 4. Component Stylings

- **Buttons (primary):** Warm Gold fill, dark text. Radius `var(--radius)` (16px). Subtle gold glow shadow on hover. `translateY(-1px)` on hover, `scale(0.98) translateY(1px)` on active. No outer neon glow. Focus: `outline: 2px solid var(--blue); outline-offset: 3px` via `:focus-visible`.
- **Buttons (ghost/secondary):** Transparent background, `var(--border)` border, `var(--muted)` text. Transitions to `var(--card)` background on hover.
- **Cards:** `var(--card)` background, `1px solid var(--border)` border, `border-radius: var(--radius)`. Shadows tinted to `rgba(0,0,0,.28)` — never pure black. Used ONLY when elevation communicates hierarchy. High-density panels: use border-top dividers or negative space instead.
- **Inputs/Selects:** `var(--card)` background, `var(--border)` border. Label above, error below. On `:focus-visible`: `border-color: var(--gold)` + `outline: 2px solid var(--gold-glow)`. Never `outline: none` without `:focus-visible` replacement.
- **Loaders:** Skeletal shimmer (`skel-shimmer`) matching layout dimensions. No circular spinners inside content areas.
- **Empty states:** Composed layout indicating the next action. Not blank space or plain "Aucun résultat" text.
- **Error states:** Inline, directly below the relevant field. Never `window.alert()`. Clear, direct language in active voice.
- **Section headers (accordion):** Must be `<button>` elements, not `<div>`, for keyboard access. Include `aria-expanded` state. Chevron rotates to indicate open/closed.

---

## 5. Layout Principles

- **Max-width:** `1200px` with `auto` margins. Content never stretches edge-to-edge on wide screens.
- **Grid-first:** CSS Grid for multi-column structures. Flexbox for single-axis alignment only.
- **Full-height sections:** Use `min-height: 100dvh` instead of `height: 100vh` — iOS Safari viewport jump fix.
- **Spacing base unit:** `0.25rem` (4px). Section gaps: `1.5rem`–`3rem`. Card padding: `1rem`–`1.5rem`.
- **ActionsPanel:** Current 3-equal-columns-with-icon+title+text pattern is the primary weak point. Next iteration: 2-column zig-zag with one emphasized "primary action" card, or featured horizontal layout for the dominant action.
- **No overlapping elements:** Every element occupies its own spatial zone. No absolute-positioned content stacking except intentional overlays and modals.
- **Sidebar shell:** Left sidebar + main content. Sidebar collapses on mobile below 768px.
- **Z-index scale:** Use CSS custom property variables — never raw arbitrary values. Scale: `--z-tooltip: 200`, `--z-dropdown: 300`, `--z-nav: 500`, `--z-overlay: 900`, `--z-header: 1000`, `--z-modal-bg: 1100`, `--z-modal: 1200`, `--z-toast: 1400`.

---

## 6. Motion & Interaction

- **Duration:** 150–250ms for most transitions. Never exceed 350ms for UI state changes.
- **Easing:** `cubic-bezier(.4,0,.2,1)` for state changes. `ease` for simple opacity fades.
- **Animatable properties only:** `transform`, `opacity`, `background-color`, `color`, `border-color`, `box-shadow`. **Never** animate `top`, `left`, `width`, or `height`.
- **Specify properties explicitly:** `transition: all` is banned in all new code. Name the properties.
- **Perpetual loops that are functional:** Skeleton shimmer, cursor blink, timer pulse — these communicate state, they are not decoration.
- **Page load:** No orchestrated entry sequences. The app loads directly into the task state.
- **Reduced motion:** All animations and transitions must respond to `@media (prefers-reduced-motion: reduce)` — either disabled or reduced to instant.

---

## 7. Anti-Patterns (Banned)

- `transition: all` — specify properties explicitly in new and edited code
- `outline: none` without `:focus-visible` replacement — WCAG AA violation
- Arbitrary `z-index` values (`9999`, `999`) — use the CSS custom property z-index scale
- Pure `#000000` text or backgrounds — use Deep Space Navy or Slate Card
- Neon gradients as primary aesthetic — violet and blue are semantic/functional only
- AI copywriting: "Révolutionnaire", "Expérience fluide", "Next-Gen", "Dopez votre", "Unleash"
- Generic 3-equal-cards layout — use asymmetric grid or featured-card emphasis
- `height: 100vh` — use `min-height: 100dvh`
- Empty `onClick` on `<div>` elements — always use `<button>` with real semantics and `aria-*`
- Glassmorphism for decoration — `backdrop-filter` is used only for functional surfaces (header, modals, nav)
- Exclamation marks in success/info messages — be calm and direct ("Copié" not "Copié !")
- Circular spinners inside content areas — use skeleton loaders
- `window.alert()` for errors — use inline error states or the toast system
