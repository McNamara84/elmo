import { visibilityOFF, visibilityON } from '../functions.js';

// In ELMO-GEM, custom coverage is available only for selected
// Altimetry-derived products.
$(document).ready(function () {
	const modelTypeSelect = $('#input-model-type');
	const products = [
		{
			checkbox: $('#altimetryGRA'),
			coverage: $('#input-gra-spatial-coverage'),
			description: 'Gravity over oceans',
		},
		{
			checkbox: $('#altimetryMSS'),
			coverage: $('#input-mss-spatial-coverage'),
			description: 'Mean sea surface',
		},
		{
			checkbox: $('#altimetryMDOT'),
			coverage: $('#input-mdot-spatial-coverage'),
			description: 'Mean dynamic ocean topography',
		},
	];
	if (!modelTypeSelect.length || products.some(({ checkbox, coverage }) => !checkbox.length || !coverage.length)) {
		return;
	}
	const stcCard = $('#group-stc').closest('.card');
	const descriptionInput = $('#input-stc-description');
	let lastAutoDescription = '';

	function normalizeModelType(value) {
		return (value || '').toString().trim().toLowerCase();
	}

	function selectedCustomProductDescriptions() {
		return products
			.filter(({ checkbox, coverage }) =>
				checkbox.is(':checked') && normalizeModelType(coverage.val()) === 'custom'
			)
			.map(({ description }) => description);
	}

	function updateSTCDescription(productDescriptions) {
		if (!descriptionInput.length) {
			return;
		}

		const automaticDescription = productDescriptions.join(', ');
		if (descriptionInput.val() === '' || descriptionInput.val() === lastAutoDescription) {
			descriptionInput.val(automaticDescription);
		}
		lastAutoDescription = automaticDescription;
	}

	function toggleSTCByCoverage() {
		const modelType = normalizeModelType(modelTypeSelect.val());
		const isAltimetry = modelType === 'altimetry-derived';
		const productDescriptions = selectedCustomProductDescriptions();
		const toShow = isAltimetry && productDescriptions.length > 0;

		if (toShow) {
			visibilityON(stcCard);
			updateSTCDescription(productDescriptions);
		} else {
			visibilityOFF(stcCard);
		}
	}

	$(document).on(
		'change',
		'#input-model-type, #altimetryGRA, #altimetryMSS, #altimetryMDOT, '
		+ '#input-gra-spatial-coverage, #input-mss-spatial-coverage, #input-mdot-spatial-coverage',
		toggleSTCByCoverage
	);
	toggleSTCByCoverage();
});
