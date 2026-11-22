/**
 * Drops the console report for a PID4INST catalogue that Ernie did not deliver.
 *
 * A 503 is the normal empty state: the browser logs the failed resource, and
 * the instrument field logs the same response. Other warnings and errors stay.
 */
export function withoutExpectedInstrumentCatalogueNoise(messages: string[]): string[] {
  const catalogueWasUnavailable = messages.some(message =>
    message.includes('Failed to fetch PID4INST instruments'));

  return messages.filter(message => {
    if (message.includes('Failed to fetch PID4INST instruments')) {
      return false;
    }
    return !(catalogueWasUnavailable
      && message.includes('Failed to load resource')
      && message.includes('503'));
  });
}
