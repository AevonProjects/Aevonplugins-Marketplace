/**
 * Returns a stable base plugin name even when an older marketplace entry
 * accidentally stored a version suffix such as "ALicense v1.1.1".
 */
export function getPluginBaseName(name: string) {
  const cleaned = String(name || "Plugin").trim();
  return cleaned.replace(/\s+v?\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?\s*$/i, "").trim() || cleaned;
}

/**
 * Marketplace-facing title. The displayed version always comes from the
 * plugins.version field, which is automatically advanced when a new release
 * JAR is saved through the version-history upload route.
 */
export function getPluginDisplayTitle(name: string, version?: string | null) {
  const base = getPluginBaseName(name);
  const latest = String(version || "").trim();
  return latest ? `${base} v${latest}` : base;
}
