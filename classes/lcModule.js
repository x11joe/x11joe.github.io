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
     * Manages input formatting, ensures sequential cursor positioning based on digit count, and allows token deletion when input is empty.
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add or manage tokens.
     */
    bindEvents(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        this.submitButton = container.querySelector('.submit-btn');

        this.inputElement.addEventListener('input', (e) => {
            const oldValue = e.target.value;
            let digits = oldValue.replace(/[^0-9]/g, ''); // Remove non-numeric characters
            const formatted = this.formatLCNumber(digits);
            e.target.value = formatted;

            // Calculate cursor position based on the number of digits entered
            const digitCount = digits.length;
            let cursorPos = 0;
            if (digitCount <= 2) {
                cursorPos = digitCount; // Before first period (year section)
            } else if (digitCount <= 6) {
                cursorPos = 3 + (digitCount - 2); // After first period (middle section)
            } else {
                cursorPos = 8 + (digitCount - 6); // After second period (end section)
            }

            // Adjust cursor position to skip over periods
            if (cursorPos === 2) cursorPos = 3; // Move past first period
            else if (cursorPos === 7) cursorPos = 8; // Move past second period

            // Ensure cursor position doesn't exceed the formatted string length
            cursorPos = Math.min(cursorPos, formatted.length);
            console.log(`LCModule input - Digits: ${digits}, Digit count: ${digitCount}, Cursor position: ${cursorPos}`);
            e.target.setSelectionRange(cursorPos, cursorPos);
        });

        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.submitLCNumber(tokenSystem);
            } else if (e.key === 'Backspace' && e.target.value === '') {
                e.preventDefault();
                if (tokenSystem.tokens.length > 0) {
                    const lastTokenEl = tokenSystem.tokenContainer.querySelector('.token:last-of-type');
                    if (lastTokenEl) lastTokenEl.remove();
                    tokenSystem.tokens.pop();
                    tokenSystem.updateSuggestions();
                    tokenSystem.updateConstructedText();
                }
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
     * @param {string} value - The current input value containing only numbers (non-digits removed).
     * @returns {string} - The formatted LC number (e.g., "25.1234.56789").
     */
    formatLCNumber(value) {
        const currentYear = new Date().getFullYear().toString().slice(-2);
        let digits = value.replace(/[^0-9]/g, ''); // Remove all non-digits
        if (digits.length === 0) return `${currentYear}.0000.00000`;

        // Pad digits to full length (11 digits: 2 for year, 4 for middle, 5 for end)
        digits = digits.padEnd(11, '0');

        // Extract parts
        const year = digits.slice(0, 2);
        const middle = digits.slice(2, 6);
        const end = digits.slice(6, 11);

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