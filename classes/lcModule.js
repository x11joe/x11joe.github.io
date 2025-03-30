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
     * Perform actions after rendering the LCModule interface, such as focusing the input and setting the initial cursor position.
     * Sets the cursor to position 3 (after the year) for intuitive user entry.
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance.
     */
    postRender(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        if (this.inputElement) {
            this.inputElement.focus();
            const cursorPos = 3; // Start after the year (e.g., "25.|0000.00000")
            this.inputElement.setSelectionRange(cursorPos, cursorPos);
        }
    }

    /**
     * Bind events to the LCModule input field and submit button to handle user interactions.
     * Manages input formatting, ensures cursor positioning reflects user actions (typing/deleting),
     * allows focus to return to token-input when clicking outside, and cancels the interface on Escape.
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add or manage tokens.
     */
    bindEvents(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        this.submitButton = container.querySelector('.submit-btn');

        this.inputElement.addEventListener('input', (e) => {
            const oldValue = e.target.value;
            const oldCursorPos = e.target.selectionStart;
            let digits = oldValue.replace(/[^0-9]/g, ''); // Remove non-numeric characters
            const formatted = this.formatLCNumber(digits);
            e.target.value = formatted;

            // Determine if a digit was added or removed
            const oldDigitCount = oldValue.replace(/[^0-9]/g, '').length;
            const newDigitCount = digits.length;
            let newCursorPos;

            // Set initial cursor position based on digit count if starting fresh
            if (newDigitCount <= 2) {
                newCursorPos = newDigitCount; // Year section (positions 0-1)
            } else if (newDigitCount <= 6) {
                newCursorPos = 3 + (newDigitCount - 2); // Middle section (positions 3-6)
            } else {
                newCursorPos = 8 + (newDigitCount - 6); // End section (positions 8-12)
            }

            // Adjust cursor based on action (typing or deleting)
            if (newDigitCount > oldDigitCount) {
                // Typing: Move cursor forward, but start at position 3 after year
                newCursorPos = oldCursorPos === 2 ? 3 : newCursorPos + 1;
            } else if (newDigitCount < oldDigitCount) {
                // Deleting: Move cursor back, respecting section boundaries
                newCursorPos = oldCursorPos > 8 ? oldCursorPos - 1 : 
                            oldCursorPos > 3 ? Math.max(3, oldCursorPos - 1) : 
                            Math.max(0, oldCursorPos - 1);
            }

            // Skip over periods
            if (newCursorPos === 2) newCursorPos = 3;
            else if (newCursorPos === 7) newCursorPos = 8;

            // Ensure cursor position stays within bounds
            newCursorPos = Math.min(newCursorPos, formatted.length);
            console.log(`LCModule input - Digits: ${digits}, Old cursor: ${oldCursorPos}, New cursor: ${newCursorPos}`);
            e.target.setSelectionRange(newCursorPos, newCursorPos);
        });

        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.submitLCNumber(tokenSystem);
            } else if (e.key === 'Escape') {
                // Cancel LCModule interface and return focus to token-input
                tokenSystem.suggestionsContainer.innerHTML = '';
                tokenSystem.tokenInput.focus();
            } else if (e.key === 'Backspace' && e.target.value.replace(/[^0-9]/g, '').length === 0) {
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

        // Allow clicking outside to focus token-input without closing suggestions
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && e.target === tokenSystem.tokenInput) {
                tokenSystem.tokenInput.focus();
                console.log('Clicked token-input while LCModule active - focus returned, suggestions kept');
            }
        }, { once: false });
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