import { visibilityOFF, visibilityON } from '../functions.js';
// This file handles ICGEM, specific behavior, where the STC group is only visible for Altimetry-derived models.
$(document).ready(function () {
	const modelTypeSelect = $('#input-model-type');
	if (!modelTypeSelect.length) {
		return;
	}
    const stcCard = $('#group-stc').closest('.card');

	function normalizeModelType(value) {
		return (value || '').toString().trim().toLowerCase();
	}

	function toggleSTCByModelType() {
		const modelType = normalizeModelType(modelTypeSelect.val());
		const hasModelType = modelType !== '' && modelType !== 'choose...';
		const isAltimetry = modelType === 'altimetry-derived';

		// Altimetry-specific group and STC are visible only for Altimetry-derived.
		if (isAltimetry) {
			visibilityON(stcCard);
		} else {
			visibilityOFF(stcCard);
		}
	}

	$(document).on('change', '#input-model-type', toggleSTCByModelType);
	toggleSTCByModelType();
});
