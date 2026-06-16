/**
 * Normalize a URL by removing invisible characters, line breaks, and extra spaces.
 */
function normalizeUrl(raw: string): string {
  return raw
    .replace(/[\r\n\t\u00A0\u200B\u200C\u200D\uFEFF]/g, '') // remove line breaks, tabs, zero-width chars, nbsp
    .replace(/\s+/g, '') // collapse any remaining whitespace
    .trim();
}

/**
 * URL regex that matches http/https URLs including complex SharePoint paths
 * with special characters like :f:, :x:, :w:, etc.
 */
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

/**
 * Extract a URL from pasted content (HTML or plain text).
 * Handles paste from Word, OneDrive, SharePoint and other rich text sources.
 */
export function extractUrlFromPaste(clipboardData: DataTransfer): string | null {
  // First try HTML — Word/OneDrive paste rich content with <a> tags
  const html = clipboardData.getData('text/html');
  if (html) {
    const hrefMatch = html.match(/href=["']([^"']+)["']/i);
    if (hrefMatch && hrefMatch[1]) {
      return normalizeUrl(hrefMatch[1]);
    }
  }

  // Fallback to plain text — detect URLs even if broken across lines
  const text = clipboardData.getData('text/plain') || clipboardData.getData('text');
  if (text) {
    // Join lines first so split URLs are reassembled
    const joined = normalizeUrl(text);
    const urlMatch = joined.match(URL_REGEX);
    if (urlMatch) {
      return urlMatch[0];
    }
  }

  return null;
}

/**
 * Get a short display label for a URL.
 * Recognises SharePoint resource types (:x: :w: :p: :f: :b: :v: :t:).
 */
export function getShortUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    // SharePoint with resource-type paths
    if (host.includes('sharepoint')) {
      const typeMatch = url.match(/\/:([a-z]):\//) ;
      if (typeMatch) {
        const typeMap: Record<string, string> = {
          x: 'SharePoint Excel',
          w: 'SharePoint Word',
          p: 'SharePoint PowerPoint',
          f: 'SharePoint Carpeta',
          b: 'SharePoint Notebook',
          v: 'SharePoint Video',
          t: 'SharePoint Forms',
        };
        return typeMap[typeMatch[1]] || 'SharePoint';
      }
      return 'SharePoint';
    }

    // OneDrive with resource-type paths
    if (host.includes('onedrive') || host.includes('1drv')) {
      const typeMatch = url.match(/\/:([a-z]):\//) ;
      if (typeMatch) {
        const typeMap: Record<string, string> = {
          x: 'OneDrive Excel',
          w: 'OneDrive Word',
          p: 'OneDrive PowerPoint',
          f: 'OneDrive Carpeta',
          b: 'OneDrive Notebook',
          v: 'OneDrive Video',
          t: 'OneDrive Forms',
        };
        return typeMap[typeMatch[1]] || 'OneDrive';
      }
      return 'OneDrive';
    }

    if (host.includes('drive.google')) return 'Google Drive';
    if (host.includes('docs.google')) return 'Google Docs';
    if (host.includes('dropbox')) return 'Dropbox';
    if (host.includes('notion')) return 'Notion';
    if (host.includes('figma')) return 'Figma';
    if (host.includes('canva')) return 'Canva';
    return host;
  } catch {
    return url.length > 30 ? url.substring(0, 30) + '…' : url;
  }
}
