/** Contact selection and completion shared by Authors and Contributors. */
export function hasContactRole(entry, allowInstitution = false) {
    return Boolean(entry && Array.isArray(entry.roles) &&
        entry.roles.some(role => String(role?.value ?? role).trim() === 'Contact Person') &&
        (entry.type === 'person' || (entry.type === 'institution' && allowInstitution)));
}

export function countSelectedContacts(authors = [], contributors = [], allowInstitution = false) {
    return authors.filter(entry => entry?.type === 'person' && entry.isContact === true).length +
        contributors.filter(entry => hasContactRole(entry, allowInstitution)).length;
}

export function hasCompleteContact(authors = [], contributors = [], allowInstitution = false) {
    const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
    return authors.some(entry => entry?.type === 'person' && entry.isContact === true &&
        String(entry.familyname || '').trim() && validEmail(entry.email)) ||
        contributors.some(entry => hasContactRole(entry, allowInstitution) &&
            String(entry.type === 'person' ? entry.familyname || '' : entry.institutionname || '').trim() &&
            validEmail(entry.email));
}

function readPayload(name) {
    try {
        const parsed = JSON.parse(document.querySelector(`input[name="${name}"]`)?.value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

/** Render the same selected-contact count in both form-group headers. */
export function updateSharedContactStatus() {
    const count = countSelectedContacts(
        readPayload('authorsPayload'), readPayload('contributorsPayload'),
        window.ELMO_FEATURES?.showContactInstitution === true
    );
    const translate = (key, fallback) => window.elmo?.translate?.(key) || fallback;
    const label = count === 1
        ? translate('authors.contactPersonSingular', 'contact person')
        : translate('authors.contactPersonPlural', 'contact persons');
    const text = count > 0
        ? translate('authors.contactsSummary', '{count} {label}').replace('{count}', count).replace('{label}', label)
        : translate('authors.contactRequired', 'at least 1 contact required');
    document.querySelectorAll('[data-author-contact-summary], [data-contributor-contact-summary]').forEach(badge => {
        badge.classList.toggle('text-bg-warning', count === 0);
        badge.classList.toggle('text-bg-success', count > 0);
        badge.textContent = text;
        badge.setAttribute('aria-live', 'polite');
        badge.setAttribute('aria-atomic', 'true');
    });
    return count;
}

if (typeof document !== 'undefined') {
    window.updateSharedContactStatus = updateSharedContactStatus;
    document.addEventListener('authorsPayload:updated', updateSharedContactStatus);
    document.addEventListener('contributorsPayload:updated', updateSharedContactStatus);
    document.addEventListener('translationsLoaded', updateSharedContactStatus);
    document.addEventListener('DOMContentLoaded', updateSharedContactStatus);
}
