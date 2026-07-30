/**
 * Logs an event to the server by sending a POST request.
 * @async
 * @function logEvent
 * @param {string} eventType - The type of event to log (e.g., 'page loaded')
 * @param {string} [status=''] - Optional status information (e.g., 'success', 'failure')
 * @param {number|string} [timeSpent=''] - Optional time spent on the page in seconds
 * @returns {Promise<void>} 
 * @throws {Error} Logs a warning to console if the fetch request fails
 * @description Sends an event log to 'endpoints/log_page_event.php' with the event type, status, and current timestamp.
 */
async function logEvent(eventType, status = '', timeSpent = '') {
    try {
        const params = {
            event: eventType,
            status: status,
            timestamp: new Date().toISOString()
        };

        if (timeSpent !== '' && timeSpent != null) {
            params.time_spent = String(timeSpent);
        }

        await fetch('endpoints/log_page_event.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: new URLSearchParams(params)
        });
    } catch (err) {
        console.warn('Failed to log page load:', err);
    }
}

// Log when page loads
if (document.readyState === 'loading') {
// DOM still loading, wait for it
document.addEventListener('DOMContentLoaded', () => logEvent('page loaded'));
} else {
// DOM already loaded, fire immediately
logEvent('page loaded');
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { logEvent };
}