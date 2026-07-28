import { visibilityOFF, visibilityON } from '../functions.js';
// In ELMO-GEM, custom coverage is available only for Gravity-over-Oceans
// products of Altimetry-derived models.
$(document).ready(function () {
	const modelTypeSelect = $('#input-model-type');
	const gravityOverOceansCheckbox = $('#altimetryGRA');
	const spatialCoverageSelect = $('#input-gra-spatial-coverage');
	if (!modelTypeSelect.length || !gravityOverOceansCheckbox.length || !spatialCoverageSelect.length) {
		return;
	}
    const stcCard = $('#group-stc').closest('.card');

	function normalizeModelType(value) {
		return (value || '').toString().trim().toLowerCase();
	}

	function toggleSTCByCoverage() {
		const modelType = normalizeModelType(modelTypeSelect.val());
		const isAltimetry = modelType === 'altimetry-derived';
		const isGravityOverOceans = gravityOverOceansCheckbox.is(':checked');
		const hasCustomCoverage = normalizeModelType(spatialCoverageSelect.val()) === 'custom';
		const toShow = isAltimetry && isGravityOverOceans && hasCustomCoverage;

		if (toShow) {
			visibilityON(stcCard);
		} else {
			visibilityOFF(stcCard);
		}
	}

	$(document).on('change', '#input-model-type, #altimetryGRA, #input-gra-spatial-coverage', toggleSTCByCoverage);
	toggleSTCByCoverage();
});
