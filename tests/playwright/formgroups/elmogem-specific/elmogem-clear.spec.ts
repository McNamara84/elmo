import { test, expect } from '@playwright/test';
import { navigateToHome } from '../../utils';

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
    await navigateToHome(page);
    await expect(page.locator('#group-ggmspropertiesessential')).toBeVisible();
  });

  test('fills all GGMs fields, clears, and asserts everything is empty / default', async ({ page }) => {

    // Wait for dynamically populated selects (model type, math rep, file format)
    await page.waitForFunction(
      () => ((document.querySelector('#input-model-type') as HTMLSelectElement | null)?.options.length ?? 0) > 1,
      { timeout: 10_000 },
    );

    // ── GGMs Definition ────────────────────────────────────────────────────

    await page.locator(DEF.celestialBody).selectOption('Moon of the Earth');
    await page.locator(DEF.modelName).fill('TEST_CLEAR_MODEL');

    await page.waitForFunction(
      () => ((document.querySelector('#input-mathematical-representation') as HTMLSelectElement | null)?.options.length ?? 0) > 1,
      { timeout: 10_000 },
    );
    await page.locator(DEF.mathRep).selectOption({ index: 1 });

    await page.waitForFunction(
      () => ((document.querySelector('#input-file-format') as HTMLSelectElement | null)?.options.length ?? 0) > 1,
      { timeout: 10_000 },
    );
    await page.locator(DEF.fileFormat).selectOption({ index: 1 });

    // ── GGMs Characteristics ───────────────────────────────────────────────

    await page.locator(CHAR.tideSystem).selectOption('zero tide');
    await page.locator(CHAR.degree).fill('300');
    await page.locator(CHAR.errors).selectOption('calibrated');
    await page.locator(CHAR.errorHandlingApproach).fill('Calibration approach text');
    await page.locator(CHAR.earthGravityConstant).fill('3.986004415e14');

    // ── Model Type: Static ─────────────────────────────────────────────────

    await page.locator(DEF.modelType).selectOption('Static');
    await expect(page.locator('.visibility-modeltype-static')).toBeVisible();

    await page.locator(MT.timeVariableCheckbox).check();
    // Checking the checkbox reveals the description textarea
    await expect(page.locator('#time-variable-description-container')).toBeVisible({ timeout: 5_000 });
    await page.locator(MT.staticDescription).fill('Static time-variable description');

    // ── Model Type: Temporal ───────────────────────────────────────────────

    await page.locator(DEF.modelType).selectOption('Temporal');
    await expect(page.locator('.visibility-modeltype-temporal')).toBeVisible();

    await page.locator(MT.temporalStart).fill('2002-04-01');
    await page.locator(MT.temporalEnd).fill('2023-06-30');
    await page.locator(MT.temporalFreqPredef).selectOption('monthly');
    await page.locator(MT.temporalInstitution).fill('GFZ');
    await page.locator(MT.releaseNumber).fill('RL07');

    // ── Model Type: Topographic ────────────────────────────────────────────

    await page.locator(DEF.modelType).selectOption('Topographic');
    await expect(page.locator('.visibility-modeltype-topographic')).toBeVisible();

    await page.locator(MT.topoLayerApproach).selectOption('single-layer');
    await page.locator(MT.topoDomain).selectOption('spatial');
    await page.locator(MT.topoApproximation).selectOption('spherical');
    await page.locator(MT.topoDensity).selectOption('constant');
    await page.locator(MT.topoDensityDetails).fill('2670 kg/m³');

    // ── GGMs Data Sources ─────────────────────────────────────────────────

    await page.locator('#button-datasource-add').click();
    await expect(page.locator(DS_ROW)).toHaveCount(2);

    const secondRow = page.locator(DS_ROW).nth(1);
    await secondRow.locator('textarea[name="datasource_description[]"]').fill('Second source description');
    await secondRow.locator('input[name="dName[]"]').fill('GRACE-FO');

    // ── Descriptions ──────────────────────────────────────────────────────

    await page.locator('#input-abstract').fill('Test abstract for clear test');

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
