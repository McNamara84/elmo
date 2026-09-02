import { visibilityOFF, visibilityON, createRemoveButton } from '../functions.js';

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
// Some of MASCON variables are shown-hidden based on the nearby variable
// IDs in the HTML are written in the format "input-<variable>-switch" for the switches and "input-<variable>" for the corresponding input fields.
function toggleMasconVariable() {
	const switchValue = String($(this).val() || '');
	const inputField = this.id.replace(/-switch$/, '');
	if (switchValue.toLowerCase() === 'given') {
		visibilityON($('#' + inputField).closest('.col-12'));
	} else {
		visibilityOFF($('#' + inputField).closest('.col-12'));
	}
}

/** Makes cloned background-model field ids unique and keeps labels in sync. */
function uniquifyBackgroundModelIds($model, index) {
	$model.find('[id]').each(function () {
		const oldId = $(this).attr('id');
		if (!oldId) {
			return;
		}
		const newId = `${oldId}-${index}`;
		$(this).attr('id', newId);
		$model.find(`label[for="${oldId}"]`).attr('for', newId);
	});
}

/**
 * Two models share one accordion row (each is col-md-6).
 * The first slot keeps +; extra slots get a remove button.
 */
function initMasconBackgroundModels() {
	const list = $('#mascon-background-model-list');
	if (!list.length) {
		return;
	}

	const originalModel = list.children('[data-mascon-background-model]').first().clone();

	list.on('click', '.addMasconBackgroundModel', function () {
		const newModel = originalModel.clone();
		newModel.find('input, select')
			.val('')
			.removeClass('is-invalid is-valid');
		uniquifyBackgroundModelIds(newModel, list.children('[data-mascon-background-model]').length);
		newModel.find('.addMasconBackgroundModel').replaceWith(createRemoveButton());
		list.append(newModel);
	});

	list.on('click', '.removeButton', function () {
		$(this).closest('[data-mascon-background-model]').remove();
	});
}

$(document).ready(function () {
	const masconCard = $('#group-ggmsmascons').closest('.card');
	if (!masconCard.length) {
		return;
	}
	masconCard.find('[id$="-switch"]').each(toggleMasconVariable);
	initMasconBackgroundModels();
	$(document).on('change', '#input-mathematical-representation', toggleMasconSpecificGroups);
	$(document).on('icgem:form-populated', toggleMasconSpecificGroups);
	$(document).on('change', '[id$="-switch"]', toggleMasconVariable);
	toggleMasconSpecificGroups();
});
