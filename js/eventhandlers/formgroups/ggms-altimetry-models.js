import { visibilityOFF, visibilityON } from '../functions.js';

$(document).ready(function () {
	const modelTypeSelect = $('#input-model-type');
	if (!modelTypeSelect.length) {
		return;
	}

	const altimetryCard = $('#group-ggmsaltimetrymodels').closest('.card');
	const modelSpecificCard = $('#model-specific-card');
	const characteristicsCard = $('#input-degree').closest('.card');
	const datasourceGroup = $('#group-datasources');
	const fileFormatSelect = $('#input-file-format');

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
			visibilityON(modelSpecificCard);
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

	$(document).on('change', '#altimetryMSS, #altimetryMDOT, #altimetryGRA', function () {
		const group = productGroups[$(this).attr('id')];
		if (!group) return;
		if ($(this).is(':checked')) {
			visibilityON(group);
		} else {
			visibilityOFF(group);
		}
	});

	toggleAltimetrySpecificGroups();
});