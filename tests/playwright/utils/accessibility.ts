import { expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export type AxeAuditOptions = {
  /**
   * Allows consumers to customise the Axe builder before the audit runs.
   * Useful for disabling rules or selecting tags when documenting known
   * exceptions.
   */
  configure?: (builder: AxeBuilder) => AxeBuilder;
};

export async function runAxeAudit(page: Page, options?: AxeAuditOptions) {
  const builder = new AxeBuilder({ page });
  const configuredBuilder = options?.configure
    ? options.configure(builder)
    : builder;

  const results = await configuredBuilder.analyze();

  const violations = results.violations ?? [];
  const formattedViolations = violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => {
          const targets = node.target.join(', ');
          return `    - ${targets}\n      ${node.failureSummary}`;
        })
        .join('\n');

      const helpUrlLine = violation.helpUrl
        ? `\n  More info: ${violation.helpUrl}`
        : '';

      return `- ${violation.id}: ${violation.help} (impact: ${violation.impact ?? 'unknown'})${helpUrlLine}\n  Nodes:\n${nodes}`;
    })
    .join('\n\n');

  const message =
    formattedViolations.length > 0
      ? `Accessibility violations detected:\n${formattedViolations}`
      : 'Accessibility audit completed successfully.';

  expect(violations, message).toEqual([]);

  return results;
}