/**
 * Mirrors the backend's PipelineStage.extract: application names follow
 * `<Stage>_<fileName>_<YYYYMMDD>` (trailing date optional). Splits on
 * underscores rather than a regex so file names that themselves contain
 * underscores are handled correctly.
 */
export function extractCoreFileName(applicationName: string): string {
  const parts = applicationName.split('_');
  if (parts.length < 2) {
    return applicationName;
  }
  const hasTrailingDate = /^\d{8}$/.test(parts[parts.length - 1]);
  const coreEnd = hasTrailingDate ? parts.length - 1 : parts.length;
  const core = parts.slice(1, coreEnd).join('_');
  return core || applicationName;
}
