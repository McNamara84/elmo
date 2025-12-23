// 
async function logEvent(eventType) {
    try {
        await fetch('log_page_event.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        credentials: 'include',
        body: new URLSearchParams({
            event: eventType,
            timestamp: new Date().toISOString()
        })
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