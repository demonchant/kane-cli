const localPathPattern = /(?:[A-Za-z]:[\\/]|\\\\[^\\/\s]+[\\/][^\\/\s]+[\\/]|\/(?:Users|home|private|tmp|var|mnt|Volumes)\/)[^\s"'<>]*/g;

export function safeCatalogText(value, fallback = '') {
  return String(value ?? fallback)
    .replace(localPathPattern, '[local path]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 500);
}
