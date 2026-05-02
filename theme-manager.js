/**
 * RIVERTECH THEME MANAGER
 * White Label Theming System with Dynamic Customization
 * 
 * Usage:
 *   updateTheme('restaurant');
 *   updateTheme('barbershop', { '--btn-primary-bg': '#custom-color' });
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'default';
        this.customOverrides = {};
        this.themesAvailable = ['clothing', 'restaurant', 'barbershop', 'beverage'];
    }

    /**
     * Apply niche theme and optional custom overrides
     * @param {string} themeName - Theme to apply ('clothing', 'restaurant', 'barbershop', 'beverage')
     * @param {object} overrides - Optional custom CSS variable overrides { '--var-name': 'value' }
     */
    updateTheme(themeName, overrides = {}) {
        const documentElement = document.documentElement;

        // Validate theme name
        if (themeName !== 'default' && !this.themesAvailable.includes(themeName)) {
            console.warn(
                `[ThemeManager] Invalid theme: "${themeName}". Available: ${this.themesAvailable.join(', ')}`
            );
            return false;
        }

        try {
            // Step 1: Reset all theme classes
            this.themesAvailable.forEach(theme => {
                documentElement.classList.remove(`theme-${theme}`);
            });
            documentElement.removeAttribute('data-theme');

            // Step 2: Apply selected theme class (if not default)
            if (themeName !== 'default') {
                documentElement.classList.add(`theme-${themeName}`);
                documentElement.setAttribute('data-theme', themeName);
            }

            // Step 3: Store current theme
            this.currentTheme = themeName;

            // Step 4: Apply custom overrides if provided
            if (overrides && typeof overrides === 'object') {
                this._applyOverrides(overrides);
                this.customOverrides = { ...this.customOverrides, ...overrides };
            }

            // Step 5: Persist to localStorage
            this._persistThemePreference();

            // Step 6: Dispatch custom event for external listeners
            this._dispatchThemeChangeEvent(themeName, overrides);

            console.log(`[ThemeManager] Theme applied: "${themeName}"`, overrides);
            return true;
        } catch (error) {
            console.error('[ThemeManager] Error applying theme:', error);
            return false;
        }
    }

    /**
     * Apply custom CSS variable overrides
     * @private
     */
    _applyOverrides(overrides) {
        const documentElement = document.documentElement;
        
        Object.entries(overrides).forEach(([varName, value]) => {
            // Validate format (should start with --)
            if (!varName.startsWith('--')) {
                console.warn(`[ThemeManager] Invalid variable name: "${varName}". Must start with '--'`);
                return;
            }

            // Validate value (basic sanitization)
            if (typeof value !== 'string' || value.trim() === '') {
                console.warn(`[ThemeManager] Invalid value for "${varName}": must be non-empty string`);
                return;
            }

            // Apply the variable
            documentElement.style.setProperty(varName, value);
        });
    }

    /**
     * Get current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Get custom overrides applied
     */
    getOverrides() {
        return { ...this.customOverrides };
    }

    /**
     * Reset to theme defaults (remove custom overrides)
     */
    resetToThemeDefaults() {
        this.customOverrides = {};
        this._persistThemePreference();
        
        // Reapply theme to clear inline styles
        const currentThème = this.currentTheme;
        this.updateTheme('default');
        this.updateTheme(currentThème);
    }

    /**
     * Load theme preference from localStorage
     * @private
     */
    loadThemePreference() {
        const savedTheme = localStorage.getItem('rivertech-theme');
        const savedOverrides = localStorage.getItem('rivertech-theme-overrides');

        if (savedTheme) {
            const overrides = savedOverrides ? JSON.parse(savedOverrides) : {};
            this.updateTheme(savedTheme, overrides);
        }
    }

    /**
     * Persist current theme and overrides to localStorage
     * @private
     */
    _persistThemePreference() {
        localStorage.setItem('rivertech-theme', this.currentTheme);
        if (Object.keys(this.customOverrides).length > 0) {
            localStorage.setItem('rivertech-theme-overrides', JSON.stringify(this.customOverrides));
        } else {
            localStorage.removeItem('rivertech-theme-overrides');
        }
    }

    /**
     * Dispatch custom event when theme changes
     * Usage: document.addEventListener('themechange', (e) => console.log(e.detail));
     * @private
     */
    _dispatchThemeChangeEvent(themeName, overrides) {
        const event = new CustomEvent('themechange', {
            detail: {
                theme: themeName,
                overrides: overrides,
                timestamp: new Date().toISOString()
            }
        });
        document.dispatchEvent(event);
    }

    /**
     * Get all available CSS variables for current theme
     */
    getThemeVariables() {
        const computedStyle = getComputedStyle(document.documentElement);
        const variables = {};

        // Get all CSS variables that start with --
        for (let i = 0; i < computedStyle.length; i++) {
            const propName = computedStyle[i];
            if (propName.startsWith('--')) {
                variables[propName] = computedStyle.getPropertyValue(propName);
            }
        }

        return variables;
    }

    /**
     * Export current theme configuration (useful for database storage)
     */
    exportThemeConfig() {
        return {
            theme: this.currentTheme,
            overrides: this.customOverrides,
            variables: this.getThemeVariables(),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import theme configuration (useful for loading from database)
     */
    importThemeConfig(config) {
        if (!config || !config.theme) {
            console.warn('[ThemeManager] Invalid config format');
            return false;
        }

        return this.updateTheme(config.theme, config.overrides || {});
    }
}

// Create global instance
window.themeManager = new ThemeManager();

// Load saved theme preference on page load
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager.loadThemePreference();
});

// Convenience function for quick access
window.updateTheme = (themeName, overrides) => {
    return window.themeManager.updateTheme(themeName, overrides);
};

// Export for ES6 modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}
