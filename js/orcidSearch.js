/**
 * ORCID Search functionality for Author and Contributor person rows.
 *
 * Opens a modal where users can search the ORCID registry by first/last name.
 * Selecting a result fetches the full ORCID record and fills the corresponding
 * form row using the shared fillRowFromOrcidRecord() from autocomplete.js.
 *
 * @requires jQuery
 * @requires Bootstrap 5 (Modal)
 * @requires autocomplete.js (fillRowFromOrcidRecord, AUTHOR_FIELD_MAPPING, CONTRIBUTOR_FIELD_MAPPING)
 */

/**
 * Escapes Solr special characters in a search term to prevent query injection.
 *
 * @param {string} term - Raw user input.
 * @returns {string} Escaped term safe for Solr queries.
 */
function escapeSolrQuery(term) {
  return term.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, '\\$&');
}

/**
 * Builds a Solr query string for the ORCID expanded-search endpoint.
 *
 * @param {string} firstName - Given name search term (may be empty).
 * @param {string} lastName  - Family name search term (may be empty).
 * @returns {string} Solr query string, e.g. "given-names:Max+AND+family-name:Mustermann".
 */
function buildOrcidSearchQuery(firstName, lastName) {
  const parts = [];
  if (firstName.trim()) {
    parts.push(`given-names:${escapeSolrQuery(firstName.trim())}`);
  }
  if (lastName.trim()) {
    parts.push(`family-name:${escapeSolrQuery(lastName.trim())}`);
  }
  return parts.join('+AND+');
}

/**
 * Searches the ORCID public API expanded-search endpoint.
 *
 * @param {string} query - Pre-built Solr query.
 * @param {number} [rows=10] - Maximum results to return.
 * @returns {Promise<Array>} Array of expanded-result objects.
 */
async function searchOrcid(query, rows = 10) {
  const url = `https://pub.orcid.org/v3.0/expanded-search/?q=${query}&rows=${rows}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/vnd.orcid+json' }
  });
  if (!response.ok) {
    throw new Error(`ORCID API returned ${response.status}`);
  }
  const data = await response.json();
  return data['expanded-result'] || [];
}

/**
 * Renders ORCID search results into the modal table body.
 *
 * @param {Array} results - Array of expanded-result objects from ORCID API.
 * @returns {void}
 */
function renderOrcidSearchResults(results) {
  const tbody = document.getElementById('orcid-search-results-body');
  const resultsContainer = document.getElementById('orcid-search-results');
  const noResults = document.getElementById('orcid-search-no-results');

  tbody.innerHTML = '';

  if (!results || results.length === 0) {
    resultsContainer.classList.add('d-none');
    noResults.classList.remove('d-none');
    return;
  }

  noResults.classList.add('d-none');
  resultsContainer.classList.remove('d-none');

  results.forEach(result => {
    const orcidId = result['orcid-id'] || '';
    const givenNames = result['given-names'] || '';
    const familyNames = result['family-names'] || '';
    const institutions = result['institution-name'] || [];
    const affiliationText = Array.isArray(institutions) ? institutions.join(', ') : String(institutions);

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><a href="https://orcid.org/${orcidId}" target="_blank" rel="noopener noreferrer">${orcidId}</a></td>` +
      `<td>${familyNames}</td>` +
      `<td>${givenNames}</td>` +
      `<td><small>${affiliationText}</small></td>` +
      `<td><button type="button" class="btn btn-sm btn-outline-primary orcid-search-accept-btn" ` +
      `data-orcid="${orcidId}" data-translate="orcidSearch.accept">Accept</button></td>`;
    tbody.appendChild(tr);
  });
}

/**
 * Resets the ORCID search modal to its initial state.
 */
function resetOrcidSearchModal() {
  document.getElementById('input-orcid-search-firstname').value = '';
  document.getElementById('input-orcid-search-lastname').value = '';
  document.getElementById('orcid-search-results').classList.add('d-none');
  document.getElementById('orcid-search-no-results').classList.add('d-none');
  document.getElementById('orcid-search-spinner').classList.add('d-none');
  const alertEl = document.getElementById('orcid-search-alert');
  alertEl.classList.add('d-none');
  alertEl.textContent = '';
  document.getElementById('orcid-search-results-body').innerHTML = '';
}

/**
 * Determines the row type and jQuery row reference from the stored modal context.
 *
 * @returns {{ row: jQuery, fieldMapping: Object, orcidField: string }|null}
 */
function getModalContext() {
  const groupType = document.getElementById('orcid-search-context-group').value;
  const rowIndex = parseInt(document.getElementById('orcid-search-context-row-index').value, 10);

  if (groupType === 'author') {
    const rows = $('#group-author [data-creator-row]');
    if (rowIndex >= 0 && rowIndex < rows.length) {
      return {
        row: $(rows[rowIndex]),
        fieldMapping: AUTHOR_FIELD_MAPPING,
        orcidField: 'input[name="orcids[]"]'
      };
    }
  } else if (groupType === 'contributor') {
    const rows = $('#group-contributorperson [contributor-person-row]');
    if (rowIndex >= 0 && rowIndex < rows.length) {
      return {
        row: $(rows[rowIndex]),
        fieldMapping: CONTRIBUTOR_FIELD_MAPPING,
        orcidField: 'input[name="cbORCID[]"]'
      };
    }
  }
  return null;
}

/**
 * Shows an alert message in the ORCID search modal.
 *
 * @param {string} message - The message to display.
 * @param {string} [type='warning'] - Bootstrap alert type.
 */
function showOrcidSearchAlert(message, type = 'warning') {
  const alertEl = document.getElementById('orcid-search-alert');
  alertEl.className = `alert alert-${type}`;
  alertEl.textContent = message;
}

// Initialize event handlers when DOM is ready
$(document).ready(function () {
  const modal = document.getElementById('modal-orcid-search');
  if (!modal) return;

  // Store context when search button is clicked (before modal opens)
  $(document).on('click', '.orcid-search-btn', function () {
    const btn = $(this);
    const authorRow = btn.closest('[data-creator-row]');
    const contributorRow = btn.closest('[contributor-person-row]');

    if (authorRow.length) {
      const index = authorRow.index();
      document.getElementById('orcid-search-context-group').value = 'author';
      document.getElementById('orcid-search-context-row-index').value = index;
    } else if (contributorRow.length) {
      const index = contributorRow.index();
      document.getElementById('orcid-search-context-group').value = 'contributor';
      document.getElementById('orcid-search-context-row-index').value = index;
    }
  });

  // Reset modal on open
  modal.addEventListener('show.bs.modal', function () {
    resetOrcidSearchModal();
  });

  // Focus first name field when modal is shown
  modal.addEventListener('shown.bs.modal', function () {
    document.getElementById('input-orcid-search-firstname').focus();
  });

  // Execute search on button click
  $('#button-orcid-search-execute').on('click', function () {
    executeOrcidSearch();
  });

  // Execute search on Enter key in input fields
  $('#input-orcid-search-firstname, #input-orcid-search-lastname').on('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeOrcidSearch();
    }
  });

  // Handle result selection via event delegation
  $('#orcid-search-results-body').on('click', '.orcid-search-accept-btn', function () {
    const orcid = $(this).data('orcid');
    handleOrcidResultSelection(orcid);
  });

  /**
   * Executes the ORCID search based on the modal input fields.
   */
  async function executeOrcidSearch() {
    const firstName = document.getElementById('input-orcid-search-firstname').value;
    const lastName = document.getElementById('input-orcid-search-lastname').value;

    if (!firstName.trim() && !lastName.trim()) {
      showOrcidSearchAlert(
        document.querySelector('[data-translate="orcidSearch.inputRequired"]')?.textContent
        || 'Please enter at least a first or last name.'
      );
      return;
    }

    const alertEl = document.getElementById('orcid-search-alert');
    alertEl.classList.add('d-none');
    document.getElementById('orcid-search-results').classList.add('d-none');
    document.getElementById('orcid-search-no-results').classList.add('d-none');
    document.getElementById('orcid-search-spinner').classList.remove('d-none');

    try {
      const query = buildOrcidSearchQuery(firstName, lastName);
      const results = await searchOrcid(query);
      renderOrcidSearchResults(results);
    } catch (error) {
      console.error('ORCID search error:', error);
      showOrcidSearchAlert(
        document.querySelector('[data-translate="orcidSearch.error"]')?.textContent
        || 'Error fetching results. Please try again.',
        'danger'
      );
    } finally {
      document.getElementById('orcid-search-spinner').classList.add('d-none');
    }
  }

  /**
   * Handles selection of an ORCID search result.
   * Fetches the full record, fills the row, and closes the modal.
   *
   * @param {string} orcid - The selected ORCID identifier.
   */
  async function handleOrcidResultSelection(orcid) {
    const context = getModalContext();
    if (!context) return;

    try {
      const response = await fetch(`https://pub.orcid.org/v3.0/${orcid}/record`, {
        headers: { 'Accept': 'application/vnd.orcid+json' }
      });
      const data = await response.json();

      // Fill ORCID field
      context.row.find(context.orcidField).val(orcid);

      // Fill remaining fields using shared logic from autocomplete.js
      fillRowFromOrcidRecord(context.row, data, context.fieldMapping);

      // Close the modal
      const bsModal = bootstrap.Modal.getInstance(modal);
      if (bsModal) {
        bsModal.hide();
      }
    } catch (error) {
      console.error('Error fetching ORCID record:', error);
      showOrcidSearchAlert(
        document.querySelector('[data-translate="orcidSearch.error"]')?.textContent
        || 'Error fetching results. Please try again.',
        'danger'
      );
    }
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeSolrQuery,
    buildOrcidSearchQuery,
    searchOrcid,
    renderOrcidSearchResults,
    resetOrcidSearchModal,
    getModalContext,
    showOrcidSearchAlert
  };
}
