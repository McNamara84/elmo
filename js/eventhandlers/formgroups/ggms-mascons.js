import { visibilityOFF, visibilityON } from '../functions.js';

$(document).ready(function () {
	const mathematicalRepresentationSelect = $('#input-mathematical-representation');
	const modelTypeSelect = $('#input-model-type');
	if (!mathematicalRepresentationSelect.length || !modelTypeSelect.length) {
		return;
	}

	const masconCard = $('#group-ggmsmascons').closest('.card');
	const characteristicsCard = $('#input-degree').closest('.card');

	/** Normalizes a lookup label for comparisons. */
	function normalizeValue(value) {
		return (value || '').toString().trim().toLowerCase();
	}

	/** Selects an option by its displayed label. */
	function selectByText(selectElement, targetText) {
		const target = targetText.toLowerCase();
		selectElement.find('option').each(function () {
			if (normalizeValue($(this).text()) === target) {
				selectElement.val($(this).val()).trigger('change');
				return false;
			}
			return true;
		});
	}

	/** Toggles MASCON-specific behavior based on mathematical representation. */
	function toggleMasconSpecificGroups() {
		const mathematicalRepresentation = normalizeValue(mathematicalRepresentationSelect.val());
		const isMascon = mathematicalRepresentation === 'mascon';

		if (isMascon) {
			// MASCON describes the representation; it is a temporal model so its
			// existing temporal properties remain available.
			if (normalizeValue(modelTypeSelect.val()) !== 'temporal') {
				selectByText(modelTypeSelect, 'Temporal');
			}
			visibilityON(masconCard);
			visibilityOFF(characteristicsCard);
		} else {
			visibilityOFF(masconCard);
			visibilityON(characteristicsCard);
		}
	}

	$(document).on('change', '#input-mathematical-representation', toggleMasconSpecificGroups);
	toggleMasconSpecificGroups();
});
