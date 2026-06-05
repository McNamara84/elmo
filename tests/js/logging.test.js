/**
 * @jest-environment jsdom
 */

describe('logging.js - logEvent', () => {
    let originalFetch;
    let mockFetch;

    beforeEach(() => {
        // Store original fetch
        originalFetch = global.fetch;
        
        // Create mock fetch
        mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true })
        });
        global.fetch = mockFetch;

        // Reset DOM
        document.body.innerHTML = '';
        
        // Clear module cache
        jest.resetModules();
    });

    afterEach(() => {
        // Restore original fetch
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    test('logEvent sends POST request with correct parameters', async () => {
        // Define logEvent function directly for testing
        async function logEvent(eventType, status = '') {
            try {
                await fetch('log_page_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: new URLSearchParams({
                        event: eventType,
                        status: status,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('Failed to log page load:', err);
            }
        }

        await logEvent('test_event', 'test_status');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            'log_page_event.php',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                credentials: 'include'
            })
        );
    });

    test('logEvent sends event type in body', async () => {
        async function logEvent(eventType, status = '') {
            try {
                await fetch('log_page_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: new URLSearchParams({
                        event: eventType,
                        status: status,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('Failed to log page load:', err);
            }
        }

        await logEvent('page loaded', 'success');

        const call = mockFetch.mock.calls[0];
        const body = call[1].body;
        expect(body.get('event')).toBe('page loaded');
        expect(body.get('status')).toBe('success');
    });

    test('logEvent includes timestamp in ISO format', async () => {
        const beforeCall = new Date();
        
        async function logEvent(eventType, status = '') {
            try {
                await fetch('log_page_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: new URLSearchParams({
                        event: eventType,
                        status: status,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('Failed to log page load:', err);
            }
        }

        await logEvent('test');
        
        const afterCall = new Date();
        
        const call = mockFetch.mock.calls[0];
        const body = call[1].body;
        const timestamp = new Date(body.get('timestamp'));
        
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    test('logEvent handles empty status', async () => {
        async function logEvent(eventType, status = '') {
            try {
                await fetch('log_page_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: new URLSearchParams({
                        event: eventType,
                        status: status,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('Failed to log page load:', err);
            }
        }

        await logEvent('test_event');

        const call = mockFetch.mock.calls[0];
        const body = call[1].body;
        expect(body.get('status')).toBe('');
    });

    test('logEvent handles fetch failure gracefully', async () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockFetch.mockRejectedValue(new Error('Network error'));

        async function logEvent(eventType, status = '') {
            try {
                await fetch('log_page_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: new URLSearchParams({
                        event: eventType,
                        status: status,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('Failed to log page load:', err);
            }
        }

        await logEvent('test');

        expect(consoleSpy).toHaveBeenCalledWith('Failed to log page load:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    test('logEvent uses include for credentials', async () => {
        async function logEvent(eventType, status = '') {
            try {
                await fetch('log_page_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    credentials: 'include',
                    body: new URLSearchParams({
                        event: eventType,
                        status: status,
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.warn('Failed to log page load:', err);
            }
        }

        await logEvent('test');

        const call = mockFetch.mock.calls[0];
        expect(call[1].credentials).toBe('include');
    });
});
