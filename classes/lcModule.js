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
     * Bind events to the LCModule input field and submit button to handle user interactions.
     * Manages input formatting and cursor positioning for a masked LC number (##.####.#####).
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add the token.
     */
    bindEvents(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        this.submitButton = container.querySelector('.submit-btn');

        // Initial focus and cursor position after the year
        this.inputElement.focus();
        this.inputElement.setSelectionRange(3, 3);

        // Handle input to enforce mask and preserve cursor position
        this.inputElement.addEventListener('input', (e) => {
            const oldValue = e.target.value;
            const oldCursorPos = e.target.selectionStart;
            let value = oldValue.replace(/[^0-9.]/g, '');
            value = this.formatLCNumber(value);
            e.target.value = value;

            // Determine which part the cursor was in and adjust position
            const beforeFirstPeriod = oldValue.indexOf('.');
            const beforeSecondPeriod = oldValue.indexOf('.', beforeFirstPeriod + 1);
            let newCursorPos;
            if (oldCursorPos <= beforeFirstPeriod) {
                // Year part (positions 0-2)
                newCursorPos = Math.min(oldCursorPos, 2);
            } else if (oldCursorPos <= beforeSecondPeriod) {
                // Middle part (positions 3-7)
                newCursorPos = 3 + (oldCursorPos - beforeFirstPeriod - 1);
                newCursorPos = Math.min(newCursorPos, 7);
            } else {
                // End part (positions 8-14)
                newCursorPos = 8 + (oldCursorPos - beforeSecondPeriod - 1);
                newCursorPos = Math.min(newCursorPos, 14);
            }
            e.target.setSelectionRange(newCursorPos, newCursorPos);
        });

        // Handle keydown for Enter and Tab to submit
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.submitLCNumber(tokenSystem);
            }
        });

        // Handle submit button click
        this.submitButton.addEventListener('click', () => {
            this.submitLCNumber(tokenSystem);
        });
    }

    /**
     * Format the LC number to maintain the mask ##.####.#####, padding or truncating parts as needed.
     * Preserves existing digits while allowing partial input during editing.
     * @param {string} value - The current input value.
     * @returns {string} - The formatted LC number.
     */
    formatLCNumber(value) {
        const currentYear = new Date().getFullYear().toString().slice(-2);
        const parts = value.split('.');
        let year = parts[0] || '';
        let middle = parts[1] || '';
        let end = parts[2] || '';

        // Pad or truncate to correct lengths, defaulting to zeros if empty
        year = year.padEnd(2, '0').slice(0, 2);
        middle = middle.padEnd(4, '0').slice(0, 4);
        end = end.padEnd(5, '0').slice(0, 5);

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