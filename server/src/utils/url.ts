/**
 * LogicWhile LiRE — URL and Origin Resolution Utilities
 * Resolves single canonical client origins from multiple comma-delimited environment settings.
 */

export function getPrimaryClientOrigin(): string {
  const v = process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.CLIENT_ORIGIN;
  const origin = (v || (process.env.NODE_ENV === 'production' ? 'https://logicwhilelire.com' : 'http://localhost:5173')).split(',')[0].trim();
  return origin.replace(/\/+$/, '');
}
