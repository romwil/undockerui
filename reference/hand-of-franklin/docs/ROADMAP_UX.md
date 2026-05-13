# UX roadmap — Vault 1848 (Citizen · Overseer · TV/NOC)

This document is separate from **`ROADMAP.md`** (GraphQL / backend features). Here we focus on **experiences**, **layouts**, and **mobile excellence**.

---

## Experience map

| Surface | Role | Primary device | Success criteria |
|--------|------|----------------|------------------|
| **Citizen** | Lightweight homepage / portals / status line | Phone first, then desktop | Fast load, thumb reach, minimal chrome, clear CTAs |
| **Overseer** | Full operations: disks, telemetry, Docker, diag, GNR | Desktop / tablet | Dense but scannable; keyboard-friendly where possible |
| **TV / NOC wall** | Read-only situational awareness at a glance | Large landscape display | Legible at 3–6 m; no tiny controls; emotional “mission control” feel |

Each surface may share components (chyron, fonts) but **information hierarchy** and **density** should differ by mode.

---

## Phase 1 — Mobile exceptional (Citizen + Overseer)

**Citizen (`/` and `/tv`)**

- [x] **Viewport & safe areas**: `env(safe-area-inset-*)` on fixed ticker and hamburger; avoid horizontal scroll.
- [x] **Touch targets**: Settings ☰, portal links, GNR controls ≥ 44×44 px equivalent; adequate spacing between links.
- [x] **Typography scale**: `clamp()` on body and ticker so small phones never clip chyron text; test 320 px width.
- [x] **Reduced motion**: Respect `prefers-reduced-motion` for marquee and GNR animations (pause or static).
- [x] **Offline / slow**: Friendly skeleton or stale banner when `/api/telemetry` fails; don’t flash empty black.
- [x] **Citizen TV (`/tv`)**: Single column already; verify padding vs ticker height on notched phones.

**Overseer (non-TV)**

- [x] **Breakpoint ~900px**: Stack grid to one column; matrix becomes horizontal scroll strip or 2-col mini grid.
- [x] **Docker panel**: Horizontal scroll for action buttons on narrow screens; sticky section titles optional.
- [x] **Hamburger menu**: Full-screen or drawer on small viewports so range sliders are usable.
- [x] **Tables** (shares preview): Horizontal scroll with fade hint or card collapse.

---

## Phase 2 — Overseer desktop polish

- [x] **Focus order**: Skip link to Docker swarm; natural tab order in column (filters → rows → diag).
- [x] **Diag log**: Collapsible toolbar, vertical resize, copy-to-clipboard for support.
- [x] **Consistency**: Same decimal **TB** language as matrix tooltips for array capacity + share snapshot (backend hydrate).
- [x] **Theme**: **Intentionally fixed** Pip-Boy / amber-on-dark — no dark/light toggle (by design).

---

## Phase 3 — TV / NOC wall

- [x] **Widescreen grid**: Left = storage matrix + telemetry; right = **Operations deck** (no Docker list).
- [x] **Operations deck**: Vault integrity + array/host ribbon; CPU / RAM / capacity bars (warn/crit tint); tiles for Docker & VM counts, shares, parity, flash, plugins; “array scan” conic animation + **Signal log** (recent notifications); **Resource feed** (`telemetry_stream`).
- [x] **Responsive**: Below ~1100px width the deck stacks under telemetry; below ~640px tiles go single-column.
- [x] **`prefers-reduced-motion`**: Radar sweep disabled / static.
- [x] **GNR on wall**: Header **▶ PLAY / ■ STOP** + radio indicator; `radio_status` from `/api/telemetry` when not playing locally.
- [x] **Ultrawide / portrait**: Extra layout rules for 21:9+ and portrait tablets.

---

## Phase 4 — Cross-cutting UX

- [ ] **Onboarding**: One-time tooltip or `/help` deep links per surface (“what is NOC mode?”).
- [ ] **Language / units**: °C/°F already on Overseer; surface same preference on Citizen matrix hint only — consider global banner.
- [ ] **Accessibility**: `aria-live` for critical integrity changes; sufficient contrast on amber (WCAG check).
- [ ] **Print / export**: Low priority; “print telemetry” hidden style sheet if requested.

---

## Principles

1. **Citizen = calm** — Few decisions, big targets, quick scan.  
2. **Overseer = power** — More columns, actions, and logs.  
3. **NOC = theater** — Big type, motion used sparingly for status, not noise.  
4. **Mobile first for Citizen**; **desktop first for Overseer**; **wall first for NOC**.

---

*Companion to `docs/ROADMAP.md` (API / feature backlog).*
