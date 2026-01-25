/**
 * @jest-environment jsdom
 */

const { requireFresh } = require('./utils');

describe('darkmode.module', () => {
    let darkmode;
    let mockDropdownItems;
    
    beforeEach(() => {
        // Reset DOM
        document.documentElement.removeAttribute('data-bs-theme');
        localStorage.clear();
        
        // Create mock dropdown items
        mockDropdownItems = [];
        for (let i = 0; i < 3; i++) {
            const item = document.createElement('button');
            item.classList.add('dropdown-item');
            item.setAttribute('data-bs-theme-value', ['light', 'dark', 'auto'][i]);
            mockDropdownItems.push(item);
        }
        
        darkmode = requireFresh('../../js/darkmode.js');
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('updateActiveTheme', () => {
        it('should set active class on matching theme item', () => {
            darkmode.updateActiveTheme(mockDropdownItems, 'dark');
            
            expect(mockDropdownItems[0].classList.contains('active')).toBe(false); // light
            expect(mockDropdownItems[1].classList.contains('active')).toBe(true);  // dark
            expect(mockDropdownItems[2].classList.contains('active')).toBe(false); // auto
        });

        it('should set active class on light theme item', () => {
            darkmode.updateActiveTheme(mockDropdownItems, 'light');
            
            expect(mockDropdownItems[0].classList.contains('active')).toBe(true);  // light
            expect(mockDropdownItems[1].classList.contains('active')).toBe(false); // dark
            expect(mockDropdownItems[2].classList.contains('active')).toBe(false); // auto
        });

        it('should set active class on auto theme item', () => {
            darkmode.updateActiveTheme(mockDropdownItems, 'auto');
            
            expect(mockDropdownItems[0].classList.contains('active')).toBe(false); // light
            expect(mockDropdownItems[1].classList.contains('active')).toBe(false); // dark
            expect(mockDropdownItems[2].classList.contains('active')).toBe(true);  // auto
        });

        it('should remove all active classes when theme not found', () => {
            // First set one active
            mockDropdownItems[0].classList.add('active');
            
            darkmode.updateActiveTheme(mockDropdownItems, 'nonexistent');
            
            expect(mockDropdownItems[0].classList.contains('active')).toBe(false);
            expect(mockDropdownItems[1].classList.contains('active')).toBe(false);
            expect(mockDropdownItems[2].classList.contains('active')).toBe(false);
        });
    });

    describe('applyTheme', () => {
        it('should set data-bs-theme attribute on documentElement', () => {
            darkmode.applyTheme(mockDropdownItems, 'dark');
            
            expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
        });

        it('should store theme in localStorage', () => {
            darkmode.applyTheme(mockDropdownItems, 'light');
            
            expect(localStorage.getItem('theme')).toBe('light');
        });

        it('should update active theme on dropdown items', () => {
            darkmode.applyTheme(mockDropdownItems, 'dark');
            
            expect(mockDropdownItems[1].classList.contains('active')).toBe(true);
        });
    });

    describe('getPreferredTheme', () => {
        const originalMatchMedia = window.matchMedia;
        
        afterEach(() => {
            window.matchMedia = originalMatchMedia;
        });

        it('should return dark when system prefers dark scheme', () => {
            window.matchMedia = jest.fn().mockReturnValue({
                matches: true
            });
            
            expect(darkmode.getPreferredTheme()).toBe('dark');
        });

        it('should return light when system prefers light scheme', () => {
            window.matchMedia = jest.fn().mockReturnValue({
                matches: false
            });
            
            expect(darkmode.getPreferredTheme()).toBe('light');
        });

        it('should return light when matchMedia is not available', () => {
            window.matchMedia = undefined;
            
            expect(darkmode.getPreferredTheme()).toBe('light');
        });
    });

    describe('getStoredTheme', () => {
        it('should return stored theme from localStorage', () => {
            localStorage.setItem('theme', 'dark');
            
            expect(darkmode.getStoredTheme()).toBe('dark');
        });

        it('should return null when no theme is stored', () => {
            expect(darkmode.getStoredTheme()).toBeNull();
        });
    });
});
