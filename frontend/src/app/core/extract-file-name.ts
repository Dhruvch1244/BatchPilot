const RUN_TIMESTAMP = /^(\d{8}-\d{6})(?::\d+)?$/;

/**
 * Mirrors the backend's PipelineStage.extract. Application names are
 * underscore-separated, starting with the stage keyword. What follows varies:
 *  - `<Stage>_<fileName>_<YYYYMMDD>` - the simple case.
 *  - `<Stage>_<vendor>_<fileName>.<fileType>.<YYYYMMDD>[_<runTimestamp>]` - the
 *    vendor-staging convention. Different stages of the same file don't always
 *    carry the same vendor prefix or run-timestamp suffix, so when this dot-form
 *    file token is found, it - not the surrounding tokens - is used as the file's
 *    identity, so a broad search on it still turns up every stage of the file.
 */
export function extractCoreFileName(applicationName: string): string {
  const rawParts = applicationName.split('_');
  if (rawParts.length < 2) {
    return applicationName;
  }
  const parts = rawParts.slice(1);

  for (let i = parts.length - 1; i >= 0; i--) {
    if (RUN_TIMESTAMP.test(parts[i])) {
      parts.splice(i, 1);
      break;
    }
  }

  for (let i = parts.length - 1; i >= 0; i--) {
    const dotParts = parts[i].split('.');
    if (dotParts.length === 3 && /^\d{8}$/.test(dotParts[2])) {
      return dotParts[0];
    }
  }

  const hasTrailingDate = parts.length > 0 && /^\d{8}$/.test(parts[parts.length - 1]);
  const coreParts = hasTrailingDate ? parts.slice(0, -1) : parts;
  const core = coreParts.join('_');
  return core || applicationName;
}
