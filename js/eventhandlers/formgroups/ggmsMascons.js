import { visibilityOFF, visibilityON } from '../functions.js';

/** Normalizes a lookup label for comparisons. */
function normalizeValue(value) {
	return (value || '').toString().trim().toLowerCase();
}

/** True when the mathematical representation dropdown is set to MASCON. */
function isMasconRepresentation(selectElement) {
	if (!selectElement || !selectElement.length) {
		return false;
	}

	const value = normalizeValue(selectElement.val());
	if (value === 'mascon') {
		return true;
	}

	const selectedText = normalizeValue(selectElement.find('option:selected').text());
	return selectedText === 'mascon';
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

/**
 * Shows the MASCON form group if and only if mathematical representation is MASCON.
 * Safe to call after user changes, vocab AJAX, upload, and clear.
 */
function toggleMasconSpecificGroups() {
	const mathematicalRepresentationSelect = $('#input-mathematical-representation');
	const modelTypeSelect = $('#input-model-type');
	const masconCard = $('#group-ggmsmascons').closest('.card');
	const characteristicsCard = $('#input-degree').closest('.card');

	if (!masconCard.length) {
		return;
	}

	const isMascon = isMasconRepresentation(mathematicalRepresentationSelect);

	if (isMascon) {
		// MASCON describes the representation; it is a temporal model so its
		// existing temporal properties remain available.
		if (modelTypeSelect.length && normalizeValue(modelTypeSelect.val()) !== 'temporal') {
			selectByText(modelTypeSelect, 'Temporal');
		}
		visibilityON(masconCard);
		visibilityOFF(characteristicsCard);
	} else {
		visibilityOFF(masconCard);
		const modelType = normalizeValue(modelTypeSelect.val());
		if (modelType !== 'altimetry-derived') {
			visibilityON(characteristicsCard);
		}
	}
}

$(document).ready(function () {
	const masconCard = $('#group-ggmsmascons').closest('.card');
	if (!masconCard.length) {
		return;
	}

	$(document).on('change', '#input-mathematical-representation', toggleMasconSpecificGroups);
	$(document).on('icgem:form-populated', toggleMasconSpecificGroups);
	toggleMasconSpecificGroups();
});
