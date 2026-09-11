import { test, expect } from '@playwright/test';
import { navigateToHome, fillGEM } from '../../utils';

const MODEL_TYPES_MOCK = [
  { id: 1, name: 'Static', description: 'Static model' },
  { id: 2, name: 'Temporal', description: 'Temporal model' },
  { id: 3, name: 'Topographic', description: 'Topographic model' },
  { id: 4, name: 'Simulated', description: 'Simulated model' },
];

const MATH_REPS_MOCK = [
  { id: 1, name: 'Spherical harmonics', description: 'Spherical harmonics' },
  { id: 2, name: 'Ellipsoidal harmonics', description: 'Ellipsoidal harmonics' },
];

const FILE_FORMATS_MOCK = [
  { id: 1, name: 'icgem1.0', description: 'icgem1.0 format' },
  { id: 2, name: 'icgem2.0', description: 'icgem2.0 format' },
];

/**
 * Selectors mirror GGMS_SELECTORS exported from js/clear.js.
 * Keep in sync when adding new ICGEM fields.
 */
const DEF = {
  modelType:  '#input-model-type',
  mathRep:    '#input-mathematical-representation',
  celestialBody: '#input-celestial-body',
  fileFormat: '#input-file-format',
  modelName:  '#input-model-name',
};

const CHAR = {
  tideSystem:           '#input-tide-system',
  degree:               '#input-degree',
  errors:               '#input-errors',
  errorHandlingApproach:'#input-error-handling-approach',
  earthGravityConstant: '#input-earth-gravity-constant',
  radius:               '#input-radius',
  semimajorAxis:        '#input-semimajor-axis',
  secondVariable:       '#input-second-variable',
  secondVariableValue:  '#input-second-variable-value',
};

const MT = {
  // Static
  timeVariableCheckbox: '#checkbox-time-variable',
  staticDescription:    '#input-static-description',
  // Temporal
  temporalStart:        '#input-temporal-start',
  temporalEnd:          '#input-temporal-end',
  temporalFreqPredef:   '#select-temporal-frequency-predef',
  customFreqCheckbox:   '#checkbox-custom-frequency',
  temporalFrequency:    '#input-temporal-frequency',
  temporalInstitution:  '#input-temporal-institution',
  releaseNumber:        '#input-release-number',
  // Topographic
  topoLayerApproach:    '#select-topo-layerapproach',
  topoDomain:           '#select-topo-domain',
  topoApproximation:    '#select-topo-approximation',
  topoDensity:          '#select-topo-density',
  topoDensityDetails:   '#input-topo-density-details',
  separateDensityCheckbox: '#checkbox-separate-density',
  topoDensityCrust:     '#select-topo-density-crust',
  topoDensityDetailsCrust: '#input-topo-density-details-crust',
  topoDensityMantle:    '#select-topo-density-mantle',
  topoDensityDetailsMantle: '#input-topo-density-details-mantle',
};

const DS_ROW = '#group-datasources .row[data-source-row]';

// ---------------------------------------------------------------------------

test.describe('GGMs / ICGEM – clearInputFields resets all fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v2/vocabs/modeltypes', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MODEL_TYPES_MOCK),
      });
    });
    await page.route('**/api/v2/vocabs/mathreps', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MATH_REPS_MOCK),
      });
    });
    await page.route('**/api/v2/vocabs/icgemformats', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FILE_FORMATS_MOCK),
      });
    });
    await navigateToHome(page);
    await expect(page.locator('#group-ggmspropertiesessential')).toBeVisible();
  });

  test('fills all GGMs fields, clears, and asserts everything is empty / default', async ({ page }) => {

    await fillGEM(page);

    // ═══════════════════ CLEAR ═══════════════════════════════════════════════

    await page.evaluate(() => (window as any).clearInputFields());

    // ── Assert GGMs Definition is reset ───────────────────────────────────

    await expect(page.locator(DEF.modelType)).toHaveValue('');
    await expect(page.locator(DEF.mathRep)).toHaveValue('');
    await expect(page.locator(DEF.celestialBody)).toHaveValue('Earth');
    await expect(page.locator(DEF.fileFormat)).toHaveValue('');
    await expect(page.locator(DEF.modelName)).toHaveValue('');

    // ── Assert GGMs Characteristics are reset ─────────────────────────────

    await expect(page.locator(CHAR.tideSystem)).toHaveValue('');
    await expect(page.locator(CHAR.degree)).toHaveValue('');
    await expect(page.locator(CHAR.errors)).toHaveValue('');
    await expect(page.locator(CHAR.errorHandlingApproach)).toHaveValue('');
    await expect(page.locator(CHAR.earthGravityConstant)).toHaveValue('');
    // Spherical / ellipsoidal fields (may be hidden, check DOM value)
    await expect(page.locator(CHAR.radius)).toHaveValue('');
    await expect(page.locator(CHAR.semimajorAxis)).toHaveValue('');
    await expect(page.locator(CHAR.secondVariableValue)).toHaveValue('');

    // ── Assert Model Types – Static – are reset ───────────────────────────

    await expect(page.locator(MT.timeVariableCheckbox)).not.toBeChecked();
    await expect(page.locator(MT.staticDescription)).toHaveValue('');

    // ── Assert Model Types – Temporal – are reset ─────────────────────────

    await expect(page.locator(MT.temporalStart)).toHaveValue('');
    await expect(page.locator(MT.temporalEnd)).toHaveValue('');
    await expect(page.locator(MT.temporalFreqPredef)).toHaveValue('');
    await expect(page.locator(MT.temporalInstitution)).toHaveValue('');
    await expect(page.locator(MT.releaseNumber)).toHaveValue('');
    await expect(page.locator(MT.customFreqCheckbox)).not.toBeChecked();
    await expect(page.locator(MT.temporalFrequency)).toHaveValue('');

    // ── Assert Model Types – Topographic – are reset ──────────────────────

    await expect(page.locator(MT.topoLayerApproach)).toHaveValue('');
    await expect(page.locator(MT.topoDomain)).toHaveValue('');
    await expect(page.locator(MT.topoApproximation)).toHaveValue('');
    await expect(page.locator(MT.topoDensity)).toHaveValue('');
    await expect(page.locator(MT.topoDensityDetails)).toHaveValue('');
    await expect(page.locator(MT.separateDensityCheckbox)).not.toBeChecked();
    await expect(page.locator(MT.topoDensityCrust)).toHaveValue('');
    await expect(page.locator(MT.topoDensityDetailsCrust)).toHaveValue('');
    await expect(page.locator(MT.topoDensityMantle)).toHaveValue('');
    await expect(page.locator(MT.topoDensityDetailsMantle)).toHaveValue('');

    // ── Assert Data Sources: only one row, first row cleared ──────────────

    await expect(page.locator(DS_ROW)).toHaveCount(1);
    const firstRow = page.locator(DS_ROW).first();
    await expect(firstRow.locator('textarea[name="datasource_description[]"]')).toHaveValue('');
    await expect(firstRow.locator('input[name="dName[]"]')).toHaveValue('');
    await expect(firstRow.locator('select[name="datasource_type[]"]')).toHaveValue('S');

    // ── Assert Descriptions are reset ─────────────────────────────────────

    await expect(page.locator('#input-abstract')).toHaveValue('');
  });
});
