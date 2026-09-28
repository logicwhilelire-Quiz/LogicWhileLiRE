# GROWTHRAN — Brand Identity & Design System Guidelines

**Product:** GROWTHRAN  
**Tagline:** "Learn. Grow. Run."  
**Developer:** R. Charan Sai  
**Copyright:** © 2026 R. Charan Sai. All rights reserved.

---

## 1. Logo Anatomy & Philosophy

The GROWTHRAN identity represents continuous academic elevation, intellectual velocity, and autonomous evaluation integrity.

- **The Open Book:** Represents structured foundational knowledge, rigorous scholarship, and verified examination standards.
- **The Rising Growth Arrow:** Ascends from within the pages, breaks beyond constraints, and points diagonally upward-right at +45°, embodying upward trajectory, rapid growth, and execution speed.
- **The Wordmark:** **GROWTHRAN** — set in bold, geometric all-caps sans-serif in deep authority blue (`#0A3F8F`), projecting institutional reliability.
- **The Tagline:** *"Learn. Grow. Run."* — set in modern medium weight in lighter growth blue (`#4A7DBE`), communicating momentum and action.

---

## 2. Official Color Palette & Tokens

| Color Name | Hex Code | HSL | Role & Usage | Contrast Ratio (on #FFF) |
| :--- | :--- | :--- | :--- | :--- |
| **Wordmark Deep Blue** | `#0A3F8F` | `hsl(216, 87%, 30%)` | Primary wordmark, major headings, dark surfaces | 8.8:1 (AAA) |
| **Icon / Mark Blue** | `#1B5FB5` | `hsl(213, 74%, 41%)` | Primary mark strokes, active buttons, focused states | 5.2:1 (AA) |
| **Tagline Light Blue** | `#4A7DBE` | `hsl(214, 48%, 52%)` | Tagline text, decorative accents | 3.6:1 (large text) |
| **Tagline Darkened (Body)** | `#2F63A0` | `hsl(213, 55%, 41%)` | Small tagline text on white background | 4.8:1 (AA) |
| **Reversed White** | `#FFFFFF` | `hsl(0, 0%, 100%)` | Dark mode wordmark, card surfaces | 21:1 |
| **Reversed Sky Blue** | `#93C5FD` | `hsl(213, 94%, 78%)` | Dark mode tagline text, secondary accents | 9.2:1 (on #0B1329) |
| **Deep Dark Surface** | `#080E1F` | `hsl(224, 58%, 8%)` | Dark mode background canvas | — |
| **Dark Elevated Card** | `#101D3F` | `hsl(223, 59%, 15%)` | Dark mode card container | — |

---

## 3. Logo Lockup Variants

All official vector assets reside in `client/public/brand/`:

1. **Horizontal Full Lockup (`growthran-logo-full.svg`):**
   - Mark + Wordmark + Tagline.
   - Primary representation for landing pages, marketing materials, and official reports.
2. **Lockup Without Tagline (`growthran-logo-notag.svg`):**
   - Mark + Wordmark.
   - For compact navigation bars, mobile headers, and tight spaces.
3. **Icon-Only Mark (`growthran-mark.svg`):**
   - Open book + rising growth arrow.
   - For avatars, app icons, favicons, and micro-badges.
4. **Reversed Dark Lockup (`growthran-logo-dark.svg`):**
   - White wordmark + bright blue mark + sky blue tagline.
   - Specifically engineered for dark themes, night modes, and dark-background slides.
5. **Monochrome Lockup (`growthran-monochrome.svg`):**
   - Single-color vector utilizing `currentColor`.
   - For single-ink print, fax, monochrome stencils, and stamp engravings.
6. **Certificate Watermark (`growthran-watermark.svg`):**
   - 8% opacity faint watermark for official PDF certificates and exam verification badges.

---

## 4. Clear Space & Minimum Sizing Rules

### Clear Space
- Always maintain clear space around the logo equal to at least the height of the capital letter **"G"** (`1.0X`) on all four sides.
- No text, UI buttons, borders, or images may intrude into this exclusion zone.

### Minimum Sizes
- **Digital / Screen:**
  - Full Lockup (with tagline): Minimum width **160px** (height ~42px).
  - Lockup without tagline: Minimum width **120px** (height ~32px).
  - Icon-only mark: Minimum size **24px × 24px** (Favicon supports 16px).
- **Print:**
  - Full Lockup: Minimum width **38 mm**.
  - Icon-only: Minimum size **8 mm × 8 mm**.

---

## 5. Strict Usage Prohibitions (Hard Rules)

- ❌ **NEVER stretch, skew, or distort** the aspect ratio of the logo or mark.
- ❌ **NEVER add drop shadows, neon glow, outer bevels, or Gaussian blurs** to the logo. Keep vector strokes crisp, flat, and modern.
- ❌ **NEVER place the dark-blue wordmark on dark surfaces** where contrast is lost; always use `growthran-logo-dark.svg`.
- ❌ **NEVER alter the relative proportions** between the open book, the growth arrow, and the wordmark.
- ❌ **NEVER change typography** inside the logo lockup.

---

## 6. Typography Stack

- **Display & Headings:** `Montserrat` or `Poppins` (SemiBold 600, Bold 700, ExtraBold 800).
- **Body & Interface:** `Inter`, system-ui, sans-serif (Regular 400, Medium 500, SemiBold 600).
- **Codes & Data:** `JetBrains Mono`, monospace (Medium 500, Bold 700).
