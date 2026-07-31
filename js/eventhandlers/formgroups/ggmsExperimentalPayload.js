/**
 * Prototype: authors-style *Payload JSON for experimental ELMO-GEM form groups.
 * Altimetry-derived and MASCON collect into hidden inputs on save/submit.
 * No backend overlay/XSLT yet — FormData carries the payloads for later wiring.
 *
 * @module ggms-experimental-payload
 */

function readVal(selector) {
  const el = document.querySelector(selector);
  if (!el || el.disabled) {
    return null;
  }
  const value = (el.value || '').toString().trim();
  return value === '' ? null : value;
}

function isChecked(selector) {
  const el = document.querySelector(selector);
  return !!(el && el.checked);
}

/**
 * Builds altimetry-derived series + selected product panels.
 * Returns null when model type is not Altimetry-derived.
 */
function collectAltimetryDerivedPayload() {
  const modelType = (document.querySelector('#input-model-type')?.value || '')
    .toString()
    .trim()
    .toLowerCase();
  if (modelType !== 'altimetry-derived') {
    return null;
  }

  const referenceEllipsoid = readVal('#input-reference-ellipsoid');
  const referenceEllipsoidOther =
    referenceEllipsoid === 'Other' ? readVal('#input-reference-ellipsoid-other') : null;

  const products = {};

  if (isChecked('#altimetryGRA')) {
    products.gravityOverOceans = {
      fileName: readVal('#input-gra-file-name'),
      spatialResolution: readVal('#input-gra-spatial-resolution'),
      spatialCoverage: readVal('#input-gra-spatial-coverage'),
      calculationMethod: readVal('#input-gra-calc-method'),
    };
  }

  if (isChecked('#altimetryMSS')) {
    products.meanSeaSurface = {
      fileName: readVal('#input-mss-file-name'),
      spatialResolution: readVal('#input-mss-spatial-resolution'),
      spatialCoverage: readVal('#input-mss-spatial-coverage'),
    };
  }

  if (isChecked('#altimetryMDOT')) {
    products.meanDynamicOceanTopography = {
      fileName: readVal('#input-mdot-file-name'),
      spatialResolution: readVal('#input-mdot-spatial-resolution'),
      spatialCoverage: readVal('#input-mdot-spatial-coverage'),
      mssModel: readVal('#input-mdot-mss-model'),
      ggmModel: readVal('#input-mdot-ggm-model'),
    };
  }

  return {
    modelType: 'Altimetry-derived',
    referenceEllipsoid:
      referenceEllipsoid === 'Other' ? referenceEllipsoidOther : referenceEllipsoid,
    tideSystem: readVal('#input-altimetry-tide-system'),
    gravityFieldMethod: readVal('#input-gravity-field-method'),
    calculationMethod: readVal('#input-calculation-method'),
    products,
  };
}

/**
 * Builds MASCON properties when mathematical representation is MASCON.
 * Returns null otherwise.
 */
function collectMasconsPayload() {
  const mathRep = (document.querySelector('#input-mathematical-representation')?.value || '')
    .toString()
    .trim()
    .toLowerCase();
  if (mathRep !== 'mascon') {
    return null;
  }

  return {
    mathematicalRepresentation: 'MASCON',
    landMascon: readVal('#input-land-mascon'),
    timeBound: readVal('#input-time-bound'),
    dataEwh: readVal('#input-data-ewh'),
    uncertainty: readVal('#input-uncertainty'),
    scaleFactor: readVal('#input-scale-factor'),
    gad: readVal('#input-gad'),
    regularisationMethod: readVal('#input-mascon-regularisation-method'),
    shape: readVal('#input-mascon-shape'),
    spatialResolution: readVal('#input-mascon-spatial-resolution'),
  };
}

function writePayload(inputName, payload) {
  const input = document.querySelector(`input[name="${inputName}"]`);
  if (!input) {
    return payload;
  }
  input.value = payload == null ? 'null' : JSON.stringify(payload);
  return payload;
}

/**
 * Sync hidden JSON payloads. Call before FormData construction on save/submit.
 */
function updatePayload() {
  const altimetryDerivedPayload = writePayload(
    'altimetryDerivedPayload',
    collectAltimetryDerivedPayload()
  );
  const masconsPayload = writePayload('masconsPayload', collectMasconsPayload());

  document.dispatchEvent(
    new CustomEvent('ggmsExperimentalPayload:updated', {
      detail: { altimetryDerivedPayload, masconsPayload },
    })
  );

  return { altimetryDerivedPayload, masconsPayload };
}

function appendPayloadsToFormData(formData) {
  updatePayload();
  ['altimetryDerivedPayload', 'masconsPayload'].forEach((name) => {
    const input = document.querySelector(`input[name="${name}"]`);
    if (input) {
      formData.set(name, input.value);
    }
  });
}

window.ggmsExperimentalPayload = {
  collectAltimetryDerivedPayload,
  collectMasconsPayload,
  updatePayload,
  appendPayloadsToFormData,
};

document.addEventListener('DOMContentLoaded', () => {
  // Keep payloads roughly current while editing (prototype; not perfect).
  document.addEventListener('change', (event) => {
    const t = event.target;
    if (!(t instanceof Element)) {
      return;
    }
    if (
      t.closest('#group-ggmsaltimetrymodels') ||
      t.closest('#group-ggmsmascons') ||
      t.id === 'input-model-type' ||
      t.id === 'input-mathematical-representation'
    ) {
      updatePayload();
    }
  });
  updatePayload();
});
