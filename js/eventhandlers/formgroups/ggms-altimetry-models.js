import { visibilityOFF, visibilityON } from '../functions.js';

$(document).ready(function () {
	const modelTypeSelect = $('#input-model-type');
	if (!modelTypeSelect.length) {
		return;
	}

	const altimetryCard = $('#group-ggmsaltimetrymodels').closest('.card');
	const characteristicsCard = $('#input-degree').closest('.card');
	const datasourceGroup = $('#group-datasources');
	const fileFormatSelect = $('#input-file-format');
	const refEllipsoidOtherWrapper = $('#ref-ellipsoid-other-wrapper');
	const refEllipsoidOtherInput = $('#input-reference-ellipsoid-other');

	let previousFileFormatValue = null;
	let wasAltimetry = false;

	/** Normalizes model type string for comparisons. */
	function normalizeModelType(value) {
		return (value || '').toString().trim().toLowerCase();
	}

	/** Adds one auto-managed datasource row of type M for altimetry. */
	function ensureAltimetryModelDatasource() {
		if (!datasourceGroup.length) {
			return;
		}

		const autoRows = datasourceGroup.find('.row[data-auto-altimetry-model="true"]');
		if (autoRows.length > 0) {
			return;
		}

		const addButton = datasourceGroup.find('.addDataSource').first();
		if (!addButton.length) {
			return;
		}

		addButton.trigger('click');

		const newRow = datasourceGroup.children('.row').last();
		newRow.attr('data-auto-altimetry-model', 'true');

		const typeSelect = newRow.find('select[name="datasource_type[]"]');
		typeSelect.val('M').trigger('change');

		const detailsSelect = newRow.find('select[name="datasource_details[]"]');
		if (detailsSelect.find('option[value="Global Gravitational Model"]').length > 0) {
			detailsSelect.val('Global Gravitational Model').trigger('change');
		}
	}

	/** Removes the auto-managed altimetry datasource row. */
	function removeAutoAltimetryModelDatasource() {
		if (!datasourceGroup.length) {
			return;
		}
		datasourceGroup.find('.row[data-auto-altimetry-model="true"]').remove();
	}

	/** Finds option value by visible text (case-insensitive). */
	function findOptionValueByText(selectElement, targetText) {
		const target = (targetText || '').toLowerCase();
		let matchValue = null;

		selectElement.find('option').each(function () {
			const optionText = ($(this).text() || '').trim().toLowerCase();
			if (optionText === target) {
				matchValue = $(this).val();
				return false;
			}
			return true;
		});

		return matchValue;
	}

	/** Applies NetCDF as default file format for altimetry mode. */
	function applyAltimetryFileFormatDefault(forceOverride = false) {
		if (!fileFormatSelect.length) {
			return;
		}

		if (previousFileFormatValue === null) {
			previousFileFormatValue = fileFormatSelect.val() || '';
		}

		const currentValue = fileFormatSelect.val() || '';
		if (!forceOverride && currentValue !== '') {
			return;
		}

		let netcdfValue = findOptionValueByText(fileFormatSelect, 'NetCDF');

		if (netcdfValue === null) {
			netcdfValue = 'NetCDF';
			fileFormatSelect.append(
				$('<option>', {
					value: netcdfValue,
					text: 'NetCDF',
					'data-auto-altimetry-option': 'true'
				})
			);
		}

		fileFormatSelect.val(netcdfValue).trigger('change');
	}

	/** Restores file format selected before entering altimetry mode. */
	function restoreFileFormatAfterAltimetry() {
		if (!fileFormatSelect.length) {
			return;
		}

		if (previousFileFormatValue !== null) {
			fileFormatSelect.val(previousFileFormatValue).trigger('change');
			previousFileFormatValue = null;
		}

		fileFormatSelect.find('option[data-auto-altimetry-option="true"]').remove();
	}

	/** Toggles altimetry-only behavior based on model type selection. */
	function toggleAltimetrySpecificGroups() {
		const modelType = normalizeModelType(modelTypeSelect.val());
		const isAltimetry = modelType === 'altimetry-derived';

		if (isAltimetry) {
			visibilityON(altimetryCard);
			visibilityOFF(characteristicsCard);

			ensureAltimetryModelDatasource();
			applyAltimetryFileFormatDefault(!wasAltimetry);
		} else {
			visibilityOFF(altimetryCard);
			removeAutoAltimetryModelDatasource();
			restoreFileFormatAfterAltimetry();
		}

		wasAltimetry = isAltimetry;
	}

	$(document).on('change', '#input-reference-ellipsoid', function () {
		if ($(this).val() === 'Other') {
			refEllipsoidOtherWrapper.removeClass('d-none').attr('aria-hidden', 'false');
			refEllipsoidOtherInput.prop('disabled', false).prop('required', true);
		} else {
			refEllipsoidOtherWrapper.addClass('d-none').attr('aria-hidden', 'true');
			refEllipsoidOtherInput.prop('disabled', true).prop('required', false).val('');
		}
	});

	$(document).on('change', '#input-model-type', toggleAltimetrySpecificGroups);
	$(document).on('change', '#input-file-format', function () {
		const modelType = normalizeModelType(modelTypeSelect.val());
		if (modelType !== 'altimetry-derived') {
			previousFileFormatValue = fileFormatSelect.val() || '';
		}
	});
	$(document).ajaxComplete(function () {
		const modelType = normalizeModelType(modelTypeSelect.val());
		if (modelType === 'altimetry-derived') {
			applyAltimetryFileFormatDefault(false);
		}
	});

	const productGroups = {
		altimetryMSS: $('#group-altimetry-mss'),
		altimetryMDOT: $('#group-altimetry-mdot'),
		altimetryGRA: $('#group-altimetry-gra'),
	};

	const productCheckboxes = {
		altimetryMSS: { group: productGroups.altimetryMSS, name: 'mss' },
		altimetryMDOT: { group: productGroups.altimetryMDOT, name: 'mdot' },
		altimetryGRA: { group: productGroups.altimetryGRA, name: 'gra' },
	};

	$(document).on('change', '#altimetryMSS, #altimetryMDOT, #altimetryGRA', function () {
		const checkboxId = $(this).attr('id');
		const config = productCheckboxes[checkboxId];
		if (!config || !config.group || !config.group.length) return;
		
		if ($(this).is(':checked')) {
			visibilityON(config.group);
		} else {
			visibilityOFF(config.group);
		}
	});

	$(document).on('change', '#altimetryBathymetry, #altimetryErrors', function () {
		const checkboxId = $(this).attr('id');
		const isChecked = $(this).is(':checked');
		let fieldName = '';
		
		if (checkboxId === 'altimetryBathymetry') {
			fieldName = 'bathymetry';
		} else if (checkboxId === 'altimetryErrors') {
			fieldName = 'errors';
		}
		
		if (!fieldName) return;
		
		// Enable/disable the field in all visible product groups
		for (const [id, config] of Object.entries(productCheckboxes)) {
			if (!config.group || !config.group.length) continue;
			const inputSelector = `#input-${config.name}-${fieldName}`;
			const $input = config.group.find(inputSelector);
			if ($input.length) {
				$input.prop('disabled', !isChecked);
			}
		}
	});

	toggleAltimetrySpecificGroups();
});