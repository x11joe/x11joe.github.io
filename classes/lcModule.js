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
     * Manages input formatting and cursor positioning for a masked LC number (##.####.#####).
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add the token.
     */
    bindEvents(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        this.submitButton = container.querySelector('.submit-btn');

        this.inputElement.addEventListener('input', (e) => {
            const oldValue = e.target.value;
            const oldCursorPos = e.target.selectionStart;
            let value = oldValue.replace(/[^0-9.]/g, '');
            value = this.formatLCNumber(value);
            e.target.value = value;

            let newCursorPos = oldCursorPos;
            if (oldValue.length < value.length) {
                newCursorPos += value.length - oldValue.length;
            } else if (oldValue.length > value.length) {
                newCursorPos -= oldValue.length - value.length;
            }
            newCursorPos = Math.min(newCursorPos, value.length);

            if (newCursorPos === 2) newCursorPos = 3; // Skip over first period
            else if (newCursorPos === 7) newCursorPos = 8; // Skip over second period

            e.target.setSelectionRange(newCursorPos, newCursorPos);
        });

        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                this.submitLCNumber(tokenSystem);
            }
        });

        this.submitButton.addEventListener('click', () => {
            this.submitLCNumber(tokenSystem);
        });
    }

    /**
     * Format the LC number to maintain the mask ##.####.#####, padding or truncating parts as needed.
     * Allows for partial input by preserving existing digits and padding with zeros.
     * @param {string} value - The current input value.
     * @returns {string} - The formatted LC number.
     */
    formatLCNumber(value) {
        const currentYear = new Date().getFullYear().toString().slice(-2);
        const parts = value.split('.');
        let year = (parts[0] || '').padEnd(2, '0').slice(0, 2);
        let middle = (parts[1] || '').padEnd(4, '0').slice(0, 4);
        let end = (parts[2] || '').padEnd(5, '0').slice(0, 5);

        if (!year) year = currentYear;

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