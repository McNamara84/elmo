/**
 * @jest-environment jsdom
 * 
 * Tests for logging.js using require() for proper coverage tracking
 */

describe('logging module coverage', () => {
    let loggingModule;

    beforeEach(() => {
        // Mock fetch
        global.fetch = jest.fn(() => Promise.resolve({ ok: true }));

        // Mock console.warn
        jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Set document ready state
        Object.defineProperty(document, 'readyState', {
            value: 'complete',
            writable: true,
            configurable: true
        });

        // Clear module cache
        jest.resetModules();

        // Require the module
        loggingModule = require('../../js/logging.js');
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete global.fetch;
    });

    describe('module exports', () => {
        test('exports logEvent function', () => {
            expect(typeof loggingModule.logEvent).toBe('function');
        });
    });

    describe('logEvent', () => {
        test('sends POST request to log_page_event.php', async () => {
            await loggingModule.logEvent('test event', 'success');

            expect(fetch).toHaveBeenCalledWith('log_page_event.php', expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                credentials: 'include'
            }));
        });

        test('includes event type in request body', async () => {
            await loggingModule.logEvent('button click', 'success');

            const callArgs = fetch.mock.calls[fetch.mock.calls.length - 1];
            const body = callArgs[1].body;
            expect(body.get('event')).toBe('button click');
        });

        test('includes status in request body', async () => {
            await loggingModule.logEvent('form submit', 'error');

            const callArgs = fetch.mock.calls[fetch.mock.calls.length - 1];
            const body = callArgs[1].body;
            expect(body.get('status')).toBe('error');
        });

        test('includes timestamp in request body', async () => {
            await loggingModule.logEvent('test', '');

            const callArgs = fetch.mock.calls[fetch.mock.calls.length - 1];
            const body = callArgs[1].body;
            expect(body.get('timestamp')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        test('handles empty status', async () => {
            await loggingModule.logEvent('test event');

            const callArgs = fetch.mock.calls[fetch.mock.calls.length - 1];
            const body = callArgs[1].body;
            expect(body.get('status')).toBe('');
        });

        test('catches and logs fetch errors', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            await loggingModule.logEvent('test', 'status');

            expect(console.warn).toHaveBeenCalledWith(
                'Failed to log page load:',
                expect.any(Error)
            );
        });

        test('does not throw on fetch failure', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(loggingModule.logEvent('test', 'status')).resolves.not.toThrow();
        });
    });

    describe('automatic page load logging', () => {
        test('logs page loaded event on module load', () => {
            // The module automatically logs 'page loaded' on require
            // Check that fetch was called with 'page loaded' event
            const pageLoadCalls = fetch.mock.calls.filter(call => {
                const body = call[1].body;
                return body.get('event') === 'page loaded';
            });
            expect(pageLoadCalls.length).toBeGreaterThan(0);
        });
    });
});
