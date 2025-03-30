export class LCModule {
    constructor() {
        this.inputElement = null;
        this.submitButton = null;
    }

    /**
     * Render the LC number input interface with a masked input field pre-filled with the current year.
     * @param {Array} options - List of possible options (not used in this module).
     * @param {string} query - The current user input (not used in this module).
     * @param {Object} context - Optional context object (not used here).
     * @returns {string} - HTML string for the input interface.
     */
    render(options, query, context = {}) {
        const currentYear = new Date().getFullYear().toString().slice(-2);
        const html = `
            <div class="lc-input-container">
                <input type="text" class="lc-input" value="${currentYear}.0000.00000" maxlength="14" />
                <button class="submit-btn">Submit</button>
            </div>
        `;
        return html;
    }

    /**
     * Perform actions after rendering the LCModule interface, such as focusing the input and setting cursor position.
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance.
     */
    postRender(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        if (this.inputElement) {
            this.inputElement.focus();
            const value = this.inputElement.value;
            const cursorPos = value.length > 2 ? 3 : value.length;
            this.inputElement.setSelectionRange(cursorPos, cursorPos);
        }
    }

    /**
     * Bind events to the LCModule input field and submit button to handle user interactions.
     * Manages input formatting, cursor positioning, and allows token deletion when input is empty.
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add or manage tokens.
     */
    bindEvents(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        this.submitButton = container.querySelector('.submit-btn');

        this.inputElement.addEventListener('input', (e) => {
            const oldValue = e.target.value;
            const oldCursorPos = e.target.selectionStart;
            let digits = oldValue.replace(/[^0-9]/g, '');
            const formatted = this.formatLCNumber(digits);
            e.target.value = formatted;

            // Adjust cursor position based on digits entered
            let newCursorPos;
            if (digits.length <= 2) {
                newCursorPos = digits.length;
            } else if (digits.length <= 6) {
                newCursorPos = 3 + (digits.length - 2); // After period
            } else {
                newCursorPos = 8 + (digits.length - 6); // After second period
            }

            // Skip over periods
            if (newCursorPos === 2) newCursorPos = 3;
            else if (newCursorPos === 7) newCursorPos = 8;

            newCursorPos = Math.min(newCursorPos, formatted.length);
            e.target.setSelectionRange(newCursorPos, newCursorPos);
        });

        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.submitLCNumber(tokenSystem);
            } else if (e.key === 'Backspace' && e.target.value === '') {
                e.preventDefault();
                tokenSystem.handleKeyDown(e);
                tokenSystem.tokenInput.focus();
            }
        });

        this.submitButton.addEventListener('click', () => {
            this.submitLCNumber(tokenSystem);
        });
    }

    /**
     * Format the LC number to maintain the mask ##.####.##### as the user types.
     * Preserves digits in the order they are entered, padding with zeros where incomplete.
     * @param {string} value - The current input value with only numbers and periods.
     * @returns {string} - The formatted LC number (e.g., "25.1234.56789").
     */
    formatLCNumber(value) {
        const currentYear = new Date().getFullYear().toString().slice(-2);
        let digits = value.replace(/[^0-9]/g, ''); // Remove all non-digits
        if (digits.length === 0) return `${currentYear}.0000.00000`;

        // Extract parts based on digit count
        let year = digits.slice(0, 2).padEnd(2, '0');
        let middle = digits.slice(2, 6).padEnd(4, '0');
        let end = digits.slice(6, 11).padEnd(5, '0');

        if (digits.length <= 2) {
            year = digits.padEnd(2, '0');
            middle = '0000';
            end = '00000';
        } else if (digits.length <= 6) {
            middle = digits.slice(2).padEnd(4, '0');
            end = '00000';
        }

        // Default to current year if no year digits provided
        if (!digits) year = currentYear;

        return `${year}.${middle}.${end}`;
    }

    /**
     * Move the cursor to the next appropriate position after typing.
     * @param {HTMLInputElement} input - The input element to adjust the cursor for.
     */
    moveCursor(input) {
        const value = input.value;
        const cursorPos = input.selectionStart;
        if (cursorPos === 2) {
            input.setSelectionRange(3, 3); // Move past first period
        } else if (cursorPos === 7) {
            input.setSelectionRange(8, 8); // Move past second period
        }
    }

    /**
     * Submit the LC number and add it as a token to the token system.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add the token.
     */
    submitLCNumber(tokenSystem) {
        const lcNumber = this.inputElement.value;
        tokenSystem.addToken(lcNumber);
        tokenSystem.suggestionsContainer.innerHTML = ''; // Clear suggestions
    }
}