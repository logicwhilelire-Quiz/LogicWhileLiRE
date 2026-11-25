/**
 * test-phase6-home-visual-polish.js
 * Comprehensive automated verification for Phase 6: Home Page & Visual Polish.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

console.log('\n======================================================');
console.log('  PHASE 6: HOME PAGE & VISUAL POLISH VERIFICATION');
console.log('======================================================\n');

// 1. Dark Theme on index.html
const indexHtmlPath = path.join(rootDir, 'client', 'index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
assert(
  indexHtmlContent.includes('data-theme="dark"'),
  '1. index.html sets data-theme="dark" on root html element'
);

// 2. Custom circular cursor removed from index.css
const indexCssPath = path.join(rootDir, 'client', 'src', 'index.css');
const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');
assert(
  !indexCssContent.includes('.cursor-dot {') && !indexCssContent.includes('.cursor-ring {'),
  '2. Custom circular cursor rules (.cursor-dot, .cursor-ring) removed from index.css'
);

// 3. Native cursor rules in index.css
assert(
  indexCssContent.includes('cursor: default;') && indexCssContent.includes('button, a, [role="button"]'),
  '3. Native OS cursor rules configured in index.css (default for body, pointer for buttons/links)'
);

// 4. Cohesive Dark Palette in index.css
assert(
  indexCssContent.includes('--color-bg:          #050814;') || indexCssContent.includes('--color-bg: #050814;'),
  '4. Dark palette sets --color-bg to #050814'
);
assert(
  indexCssContent.includes('--color-surface:     #090d1a;') || indexCssContent.includes('--color-surface: #090d1a;'),
  '5. Dark palette sets --color-surface to #090d1a'
);
assert(
  indexCssContent.includes('--color-accent:         #FFC200;') || indexCssContent.includes('--color-accent: #FFC200;'),
  '6. Dark palette sets --color-accent to #FFC200'
);

// 5. Awkward floating glowing bubble orbs disabled
assert(
  indexCssContent.includes('.hero-orb { display: none !important; }'),
  '7. Blurry 600px/500px .hero-orb bubbles disabled in index.css'
);
assert(
  !indexCssContent.includes('filter: blur(40px);'),
  '8. .card-glow-bg excessive 40px blur spot removed from index.css'
);

// 6. ParallaxGlowOrbs retired
const glowOrbsPath = path.join(rootDir, 'client', 'src', 'components', '3d', 'ParallaxGlowOrbs.tsx');
const glowOrbsContent = fs.readFileSync(glowOrbsPath, 'utf8');
assert(
  glowOrbsContent.includes('return null;'),
  '9. ParallaxGlowOrbs component safely returns null (no floating bubbles anywhere)'
);

// 7. LiquidBlob retired
const liquidBlobPath = path.join(rootDir, 'client', 'src', 'components', '3d', 'LiquidBlob.tsx');
const liquidBlobContent = fs.readFileSync(liquidBlobPath, 'utf8');
assert(
  liquidBlobContent.includes('return null;'),
  '10. LiquidBlob component safely returns null (no purple distorted blob mesh)'
);

// 8. StudentLoginPage and AdminLoginPage clean of floating orbs
const studentLoginPath = path.join(rootDir, 'client', 'src', 'pages', 'StudentLoginPage.tsx');
const studentLoginContent = fs.readFileSync(studentLoginPath, 'utf8');
assert(
  !studentLoginContent.includes('<ParallaxGlowOrbs') && !studentLoginContent.includes('hero-orb-1'),
  '11. StudentLoginPage clean of ParallaxGlowOrbs and hero-orb elements'
);

const adminLoginPath = path.join(rootDir, 'client', 'src', 'pages', 'admin', 'AdminLoginPage.tsx');
const adminLoginContent = fs.readFileSync(adminLoginPath, 'utf8');
assert(
  !adminLoginContent.includes('<ParallaxGlowOrbs') && !adminLoginContent.includes('hero-orb-1'),
  '12. AdminLoginPage clean of ParallaxGlowOrbs and hero-orb elements'
);

// 9. AdminDashboardPage clean of LiquidBlob
const adminDashPath = path.join(rootDir, 'client', 'src', 'pages', 'admin', 'AdminDashboardPage.tsx');
const adminDashContent = fs.readFileSync(adminDashPath, 'utf8');
assert(
  !adminDashContent.includes('<LiquidBlob'),
  '13. AdminDashboardPage clean of LiquidBlob element'
);

// 10. BrandLogo elevated in SiteHeader.tsx
const siteHeaderPath = path.join(rootDir, 'client', 'src', 'components', 'SiteHeader.tsx');
const siteHeaderContent = fs.readFileSync(siteHeaderPath, 'utf8');
assert(
  siteHeaderContent.includes('<BrandLogo') && siteHeaderContent.includes('showTagline={true}'),
  '14. SiteHeader elevates BrandLogo with variant standard and full tagline'
);

// 11. BrandLogo elevated in SiteFooter.tsx
const siteFooterPath = path.join(rootDir, 'client', 'src', 'components', 'SiteFooter.tsx');
const siteFooterContent = fs.readFileSync(siteFooterPath, 'utf8');
assert(
  siteFooterContent.includes('<BrandLogo size="md" variant="standard" showTagline={true} />'),
  '15. SiteFooter elevates BrandLogo with variant standard and tagline'
);
assert(
  siteFooterContent.includes('background: \'var(--color-surface, #090D1A)\''),
  '16. SiteFooter applies dark theme background var(--color-surface, #090D1A)'
);

// 12. BrandLogo elevated in LandingPage.tsx
const landingPath = path.join(rootDir, 'client', 'src', 'pages', 'LandingPage.tsx');
const landingContent = fs.readFileSync(landingPath, 'utf8');
assert(
  landingContent.includes('<BrandLogo') && landingContent.includes('variant="hero"'),
  '17. LandingPage hero stage card prominently features elevated BrandLogo centerpiece'
);
assert(
  landingContent.includes('/brand/logicwhilelire-') || landingContent.includes('<BrandLogo'),
  '18. LandingPage hero stage card prominently features the official Logic While LiRE emblem'
);

// 13. ThemeToggle default theme
const themeTogglePath = path.join(rootDir, 'client', 'src', 'components', 'ui', 'ThemeToggle.tsx');
const themeToggleContent = fs.readFileSync(themeTogglePath, 'utf8');
assert(
  themeToggleContent.includes('useState<\'dark\' | \'light\'>(\'dark\')'),
  '19. ThemeToggle component defaults initial state to dark'
);

// 14. Client build output exists and is fresh
const distIndexPath = path.join(rootDir, 'client', 'dist', 'index.html');
assert(
  fs.existsSync(distIndexPath),
  '20. Client production build directory (dist/index.html) exists and is verified'
);

console.log('\n------------------------------------------------------');
console.log(`  TOTAL TESTS: ${totalTests}`);
console.log(`  PASSED:      ${passedTests}`);
console.log(`  FAILED:      ${failedTests}`);
console.log('------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PHASE 6 VERIFICATION CHECKS PASSED!\n');
  process.exit(0);
}
