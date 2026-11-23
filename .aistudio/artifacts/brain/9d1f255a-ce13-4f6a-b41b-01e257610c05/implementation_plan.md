# LineBook Pro — Commercial SaaS Upgrade Plan

A phase-by-phase upgrade roadmap to transform LineBook Pro from a working family line book into a market-ready, visually polished, offline-first micro-lending SaaS that any daily, weekly, or monthly lender can adopt safely. Every phase is scoped for step-by-step implementation and verified with automated unit tests plus real mobile/desktop browser checks before moving forward.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Your confirmed preferences from our planning discussion govern the scope and build order below. Existing local data keys (`slg_*`) remain 100% intact across every upgrade so your dad's live ledger is never disturbed.

- **Confirmed Decision 1 — Priority Upgrade Areas**: Focus on three pillars before selling to other lenders: (a) fixing light/dark theme contrast and visual polish, (b) guarantor/surety records, 1-tap calling, and loan renewal/settlement, and (c) a Daily Cashbook, printable/shareable Borrower Passbook, and CSV/PDF exports.
- **Confirmed Decision 2 — Flexible Lending Schedules**: Expand beyond Monday/Tuesday lines so lenders can assign villages/routes across all 7 weekdays (Monday–Sunday) and issue **Weekly**, **Daily**, or **Monthly** loans.
- **Confirmed Decision 3 — Cloud Backup & Phone Recovery**: Pair zero-lag offline local storage with **Google Sign-In + hardened Firebase Firestore sync** (plus manual JSON export), so lenders can switch or lose phones without losing their ledger or accidentally exposing data via unauthenticated IDs.
- **Confirmed Decision 4 — Rollout Method**: Build and verify **phase-by-phase**, testing each capability cleanly before starting the next.

---

## 1. Overview & Core Concept

- **What It Does**: LineBook Pro becomes a complete digital line-book platform supporting village-route collection sheets, daily/weekly/monthly lending cycles, borrower KYC & guarantor tracking, daily bag cash reconciliation, borrower passbook statements, accountant-ready CSV/PDF exports, and one-tap cross-device Google cloud recovery.
- **Target Audience / Persona**: Independent micro-lenders, village finance operators, and small collection teams across India operating on Android smartphones in outdoor sunlight—often in low-network rural areas—plus reviewing books at home on tablets or laptops.
- **Key Value**: Eliminates paper notebooks and fragile local-only storage while keeping field collection speed under 2 taps per borrower, with crisp daylight contrast and auditable daily cash balancing.

---

## 2. User Experience & Visual Design

### Visual Identity & Theme Fix (Resolving the Split-Brain Theme Bug)

In the current build, global CSS uses Tailwind v4 without explicitly wiring the `.dark` class selector, causing `dark:` cards (like in Settings and the PWA install banner) to turn dark or washed-out even when the user selects **Light Mode** on a dark-mode device.

- **Aesthetic Direction**: High-craft **Daylight Ledger Clarity** — clean, tactile financial cards built for outdoor readability with strict light/dark parity, zero visual clutter, and crisp numeric precision (`tabular-nums`).
- **Color Palette & Theme Tokens**:
  - **Root Binding**: Bind Tailwind's dark variant explicitly to `.dark` so system OS dark mode never bleeds into Light Mode, and toggle surfaces coherently when the user switches themes.
  - **Light Mode Surface System**: Crisp slate canvas (`#EDF1F7`), elevated pure/tinted card surfaces (`#FFFFFF` / `#F8FAFC`), deep ink typography (`#0F172A` / `#475569`) guaranteeing WCAG AA contrast (`≥ 4.5:1`), deep cobalt primary action (`#1E3A8A`), warm amber gold accents (`#D97706`), emerald green for paid (`#059669`), and ruby red for skips/overdue (`#DC2626`).
  - **Dark Mode Surface System**: Deep midnight navy canvas (`#0B0F19`), elevated charcoal-slate cards (`#131B2E`) with subtle crisp borders (`rgba(255,255,255,0.08)`), high-contrast alabaster text (`#F8FAFC` / `#CBD5E1`), and luminous sky/emerald/amber semantic accents.
- **Typography & Hierarchy**: `Plus Jakarta Sans` + `Noto Sans Telugu` with `font-variant-numeric: tabular-nums` on every rupee amount, balance, and sequence number (`#01`, `#12`) so columns align vertically on collection sheets.
- **Component & Mobile Ergonomics**:
  - **Thumb-Zone Discipline**: Keep primary tab navigation anchored in the bottom thumb zone (`≤ 15%` aggregate sticky height), with `≥ 44×44px` hit targets on all payment buttons (`Paid`, `Short`, `Skip`, `Extra`), 1-tap `Call` icons, and back buttons.
  - **Card Discipline & Zero Pill Clutter**: Remove redundant static decorative pills (`ACTIVE`, `OFFLINE READY` noise) from menu cards; reserve colored status badges strictly for live operational status (e.g., overdue skips, frequency tag, cloud sync status).
  - **Responsive Viewport Canvas**: Optimized for `375px–430px` phones on the field, expanding gracefully into 2-column / 3-column dashboard, borrower ledger, and cashbook views on tablets and desktops (`max-w-6xl`).
  - **100% Bilingual Parity**: Every new label (Guarantor, Cashbook, Daily/Monthly cycle, Passbook, Export, Google Sync) ships with both clear English and natural Telugu strings.

### Key User Flows

1. **Schedule & Village Setup (Zero-State to Route Ready)**: Lender picks any collection day (`Monday`–`Sunday`) or marks a route as `Daily Collection` / `Monthly Route`, adds borrowers with optional **Guarantor Name & Phone**, `S/o / W/o` relation, **Frequency (`Weekly` / `Daily` / `Monthly`)**, and saves cleanly.
2. **Field Collection, 1-Tap Call & Renewal**: Inside the Collection Sheet or Borrower Card, tapping a phone icon dials the borrower or guarantor immediately via `tel:`; tapping **Renew / Top-Up** on an active or finished loan closes the prior cycle cleanly (including optional **Early Settlement Discount**) and starts **Cycle #2** carrying forward KYC and guarantor details automatically.
3. **End-of-Day Cashbook Closing**: Opening Cash + Today's Field Collections − New Loans Given − Daily Expenses − Personal Withdrawals automatically calculates **Closing Cash in Bag**, allowing lenders to audit any past calendar date—not only today.
4. **Borrower Passbook & Accountant Exports**: From any borrower's profile, the lender generates a clean formatted **Borrower Passbook** (loan terms, installment timeline, paid/short/skip log, balance) for print/PDF save or direct WhatsApp sharing, and exports Weekly Sheets / All Borrowers / Cashbook Ledger as **CSV** spreadsheets.
5. **Cross-Phone Cloud Sync**: In Settings → Cloud Vault, lender signs in once with **Google Sign-In**. When logging into a new phone with that Google account, LineBook Pro detects the cloud vault and restores all villages, borrowers, collections, expenses, and settings in one tap.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Offline-First Hybrid Sync (LocalStorage + UID-Scoped Firestore)**
  - *Chosen Approach*: Keep local browser storage (`slg_*`) as the instant, zero-latency read/write engine for rural areas with zero signal, layered with authenticated Firebase Google Sign-In snapshot sync (`users/{uid}/vault/latest` + recent timestamped snapshots).
  - *Why*: Collection sheets in villages cannot wait on spinning loaders or drop edits offline. Pairing local speed with Google-authenticated Firestore solves both phone-loss recovery and SaaS multi-tenant security.
  - *Alternatives Considered*: Moving 100% to live Firestore reads/writes (rejected due to rural network lag) or keeping unauthenticated device-ID backups (rejected because any user guessing an ID would lack real account ownership across phones).

- **Decision 2 — Native Browser Print-to-PDF & UTF-8 CSV Generation**
  - *Chosen Approach*: Build clean dedicated print stylesheets (`@media print`) for **Borrower Passbooks** and **Weekly/Monthly Summary Reports** paired with BOM-prefixed UTF-8 **CSV generators** (so Telugu names render properly inside Microsoft Excel and Google Sheets).
  - *Why*: Zero heavy PDF library bloat (`jspdf` bundles struggle with Telugu Unicode script shaping), whereas Chromium/Android Print renders crisp Telugu + ₹ fonts natively with 100% fidelity and "Save as PDF" / Bluetooth thermal print support.
  - *Alternatives Considered*: Client-side canvas PDF rendering (poor Telugu glyph rendering and huge bundle size).

- **Decision 3 — Forward-Compatible Schedule Model (`Weekly` Default)**
  - *Chosen Approach*: Make `frequency: "weekly" | "daily" | "monthly"` optional on existing borrowers and default unset records to `"weekly"`, while replacing hardcoded `"Monday" | "Tuesday"` selects with full 7-day + Daily/Monthly options.
  - *Why*: Existing dad/client records automatically behave identically as Weekly loans without requiring a destructive migration script.

- **Decision 4 — Phased Delivery & Verification Gates**
  - *Chosen Approach*: Execute and verify 5 focused phases sequentially. Each phase runs full unit tests, TypeScript check, Vite build, and headless browser UI inspection across both Light & Dark themes before advancing.
  - *Why*: Keeps regressions zero and lets you test and deploy each milestone to real devices cleanly.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Hierarchy

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          LINEBOOK PRO CLIENT                            │
│                                                                         │
│  ┌───────────────────────┐   ┌────────────────────────────────────────┐ │
│  │  LocalStorage Engine  │◄─►│        App Root & Security Lock        │ │
│  │  (slg_* Offline Base) │   │  (4-Digit PIN, Idle Lock, Theme/Lang)  │ │
│  └───────────────────────┘   └───────────────────┬────────────────────┘ │
│                                                  │                      │
│  ┌───────────────────────┐                       ▼                      │
│  │ Firebase Google Auth  │   ┌────────────────────────────────────────┐ │
│  │ & Hardened Firestore  │◄─►│            Primary Tab Views           │ │
│  │ (/lenders/{uid}/...)  │   │ Home · Collect · Borrowers · Reports   │ │
│  └───────────────────────┘   │ Cashbook · Calendar · Calc · Settings  │ │
│                              └───────────────────┬────────────────────┘ │
│                                                  │                      │
│  ┌───────────────────────────────────────────────▼────────────────────┐ │
│  │                 Pure Domain & Export Services                      │ │
│  │  • Schedule & Finance Engine (Weekly / Daily / Monthly math)       │ │
│  │  • Cashbook Aggregator (Opening → Inflows/Outflows → Closing Bag)  │ │
│  │  • Passbook Print Renderer + UTF-8 Telugu CSV Exporter             │ │
│  │  • WhatsApp Automation & 1-Tap Tel Dialer                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Storage Strategy

All existing `slg_*` keys (`slg_data`, `slg_cols`, `slg_exp`, `slg_pin`, `slg_newloans`, `slg_personal`, `slg_profile`, `slg_whatsapp_rules`) remain unchanged at root, extended safely with optional properties:

- **Village Route**: Expands `day` to support all 7 weekdays (`Monday`–`Sunday`) plus optional `defaultFrequency` (`weekly` | `daily` | `monthly`).
- **Borrower Entity**: Adds optional KYC & lifecycle attributes:
  - `careOf` (S/o or W/o / Address Landmark)
  - `guarantorName` and `guarantorPhone`
  - `frequency` (`"weekly"` | `"daily"` | `"monthly"`, defaults to `"weekly"`)
  - `loanCycle` (numeric cycle count: Cycle `1`, `2`, `3`...) and `renewedFromId`
  - `settledEarly` / `settlementDiscount` for foreclosed loans
- **Cashbook Opening Balances (`slg_cash_opening`)**: Lightweight date-keyed store (`YYYY-MM-DD -> amount`) allowing lenders to verify or set a day's starting bag cash and compute historical daily cashbooks cleanly.
- **Hardened Firestore Rules (`firestore.rules` & `firebase-blueprint.json`)**:
  - Replace open `lenderId` access with strict Firebase Auth UID ownership (`request.auth != null && request.auth.uid == lenderId && request.auth.token.email_verified == true`), explicit schema validation helpers, `.size()` caps, and immutable owner/timestamp enforcement.

### Step-by-Step Build & Verification Phases

1. **Phase 1 — Theme Contrast Fix & Clean UI Polish**
   - *Scope*: Add Tailwind v4 `.dark` variant binding (`@custom-variant dark`) to eliminate light/dark split-brain bugs across Home, Settings, PWA Install card, Collect, Borrowers, Reports, Expenses, Calendar, and Calculator; audit text/surface contrast in both modes; clean up decorative pills; enforce tabular numerals and `≥44px` touch targets; expand desktop grid layouts cleanly; unify EN/TE translations.
   - *Verification*: Headless browser visual audit on `390×844` mobile and `1280×800` desktop in both Light Mode and Dark Mode (even with OS dark preference active).

2. **Phase 2 — Flexible 7-Day/Daily/Monthly Schedules, Guarantor CRM, 1-Tap Call & Loan Renewal**
   - *Scope*: Unlock all 7 weekdays (`Monday`–`Sunday`) in Village forms + Dashboard/Calendar filters; support **Weekly / Daily / Monthly** frequency selection with automatic installment calculation (`₹ / day`, `₹ / week`, `₹ / month`); add **Guarantor Name, Guarantor Phone, and S/o / W/o / Address** fields to Borrower Add/Edit/Profile; add **1-Tap Call** (`tel:`) buttons for borrower & guarantor; build **Early Settlement / Discount Closure** and **1-Tap Loan Renewal (Cycle #2+)** flows.
   - *Verification*: Pure math unit tests for Weekly/Daily/Monthly installments, cycle renewal & foreclosure + browser walkthrough creating a Daily loan, renewing a completed loan, and verifying 1-tap call links.

3. **Phase 3 — Daily Cashbook, Borrower Passbook & PDF/CSV Exports**
   - *Scope*: Add dedicated **Daily Cashbook** view showing date-by-date Opening Cash, Collections (Cash vs PhonePe/Online split), New Loans Issued, Field Expenses, Personal Withdrawals, and **Closing Cash in Bag**; add formatted **Borrower Passbook** sheet with Print/Save-PDF and WhatsApp summary share; add UTF-8 BOM **CSV Export** for Borrowers List, Collection Sheets, and Monthly P&L Reports.
   - *Verification*: Cashbook reconciliation unit tests + CSV UTF-8 encoding test + browser verification of Cashbook date navigation, Passbook render, and CSV download trigger.

4. **Phase 4 — Google Sign-In Cloud Sync & Cross-Phone Recovery**
   - *Scope*: Integrate Firebase Google Sign-In inside Settings → Cloud Vault; upgrade `firestore.rules` and `firebase-blueprint.json` to strict UID-scoped, validated security rules (deploying updated rules cleanly); add conflict-aware cloud snapshot upload & one-tap restore when signing into a fresh browser/phone, keeping offline fallback JSON backup active.
   - *Verification*: Rules validation + auth-gated backup/restore flow check + clean fresh-device restore verification.

5. **Phase 5 — Commercial SaaS Onboarding Polish & Full End-to-End Audit**
   - *Scope*: Streamline first-launch empty-state onboarding checklist (Setup Business Profile → Add First Village → Add First Borrower → Backup Vault); align Settings version/branding (`LineBook Pro`); full regression sweep across all 8 views in English and Telugu.
   - *Verification*: Full unit test suite + TypeScript + Vite production build + complete end-to-end Playwright browser audit across Light/Dark/EN/TE.
