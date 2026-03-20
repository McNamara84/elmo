import { visibilityOFF, visibilityON } from '../functions.js';

$(document).ready(function () {
	const modelTypeSelect = $('#input-model-type');
	if (!modelTypeSelect.length) {
		return;
	}

	const masconCard = $('#group-ggmsmascons').closest('.card');
	const modelSpecificCard = $('#model-specific-card');
	const characteristicsCard = $('#input-degree').closest('.card');

	/** Normalizes model type string for comparisons. */
	function normalizeModelType(value) {
		return (value || '').toString().trim().toLowerCase();
	}

	/** Toggles MASCON-specific behavior based on model type selection. */
	function toggleMasconSpecificGroups() {
		const modelType = normalizeModelType(modelTypeSelect.val());
		const isMascon = modelType === 'mascon';

		if (isMascon) {
			visibilityON(masconCard);
			visibilityOFF(modelSpecificCard);
			visibilityOFF(characteristicsCard);
		} else {
			visibilityOFF(masconCard);
		}
	}

	$(document).on('change', '#input-model-type', toggleMasconSpecificGroups);
	toggleMasconSpecificGroups();
});
