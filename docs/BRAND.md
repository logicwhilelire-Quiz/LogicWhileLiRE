# GROWTHRAN — Brand Identity & Design System Specification

**Product:** GROWTHRAN  
**Tagline:** "Learn. Grow. Run."  
**Developer:** R. Charan Sai  
**Copyright:** © 2026 R. Charan Sai. All rights reserved.

---

## 1. Brand Philosophy & Identity

**GROWTHRAN** represents continuous intellectual elevation, academic velocity, and uncompromised examination integrity.

- **The Open Book:** Represents deep foundational knowledge, rigorous scholarship, and verified examination standards.
- **The Rising Growth Arrow:** Ascends from within the pages, breaks through institutional constraints, and surges diagonally upward-right at +45°, embodying upward trajectory, rapid growth, and execution speed.
- **The Wordmark:** **GROWTHRAN** — set in bold, geometric all-caps sans-serif in deep authority blue (`#0A3F8F`), projecting institutional reliability and technological leadership.
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

## 3. Official Vector Logo Assets

All canonical vector assets are stored in `client/public/brand/`:

1. **Horizontal Full Lockup (`growthran-logo-full.svg`):**
   - Mark + Wordmark + Tagline.
   - Primary representation for landing pages, marketing materials, and official exam score reports.
2. **Lockup Without Tagline (`growthran-logo-notag.svg`):**
   - Mark + Wordmark.
   - For compact navigation bars, mobile headers, and tight spaces.
3. **Icon-Only Mark (`growthran-mark.svg`):**
   - Open book + rising growth arrow.
   - For avatars, app icons, favicons, and micro-badges.
4. **Reversed Dark Lockup (`growthran-logo-dark.svg`):**
   - White wordmark + bright blue mark + sky blue tagline.
   - Specifically engineered for dark themes, night modes, and proctoring consoles.
5. **Monochrome Lockup (`growthran-monochrome.svg`):**
   - Single-color vector utilizing `currentColor`.
   - For single-ink print, fax, monochrome stencils, and stamp engravings.

---

## 4. Typography Hierarchy

GROWTHRAN uses modern geometric typography loaded with `font-display: swap`:

- **Primary Display & Headings:** `Inter` or `Space Grotesk` (weights 600, 700, 800)
- **Body & UI Elements:** `Inter` (weights 400, 500)
- **Code & Examination Sandbox:** `JetBrains Mono` (weights 400, 500)

```css
/* Typography Scale */
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-display: 'Space Grotesk', var(--font-sans);
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

---

## 5. Component Integration

All frontend pages render the brand through the canonical component:
`client/src/components/BrandLogo.tsx`

```tsx
import { BrandLogo } from '../components/BrandLogo';

// Default full logo with tagline
<BrandLogo size="md" />

// Navbar compact version (no tagline)
<BrandLogo size="sm" showTagline={false} />

// Dark theme / High contrast
<BrandLogo size="lg" theme="dark" />
```

---

## 6. Co-Branding & Institutional Display

When an engineering college or recruitment partner hosts an assessment on GROWTHRAN:
1. The **GROWTHRAN** logo must remain clearly visible in the primary navigation or footer.
2. Partner logos must appear adjacent to the phrase *"Powered by GROWTHRAN Assessment Engine"*.
3. Footer credit format:
   `GROWTHRAN — Learn. Grow. Run. | Developed by R. Charan Sai`
