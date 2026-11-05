// Set the theme before the iframe parses any visible content.
export function withReportTheme(html, theme) {
  const value = theme === 'dark' ? 'dark' : 'light';
  return html.replace(/<html\b([^>]*)>/i, (_, attributes) =>
    `<html${attributes.replace(/\sdata-theme\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')} data-theme="${value}">`);
}
