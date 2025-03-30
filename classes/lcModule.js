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
     * Manages input formatting, tracks cursor position dynamically, adjusts cursor to valid digit positions,
     * submits on Enter/Tab or button click, and cancels on Escape with focus returned to token-input.
     * Ensures Backspace focuses token-input after deleting a token for continued deletion.
     * @param {HTMLElement} container - The container element where the input is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add or manage tokens.
     */
    bindEvents(container, tokenSystem) {
        this.inputElement = container.querySelector('.lc-input');
        this.submitButton = container.querySelector('.submit-btn');
        let currentCursorPos = 3; // Initial position after the year (e.g., "25.|0000.00000")

        this.inputElement.addEventListener('input', (e) => {
            const oldValue = e.target.value;
            const oldCursorPos = currentCursorPos; // Use tracked position before input
            let digits = oldValue.replace(/[^0-9]/g, ''); // Remove non-numeric characters
            const formatted = this.formatLCNumber(digits);
            e.target.value = formatted;

            // Calculate new cursor position based on input type
            let newCursorPos = oldCursorPos;

            if (e.inputType === 'insertText') {
                newCursorPos++; // Move forward one position
                // Skip over periods
                if (newCursorPos === 2) newCursorPos = 3;
                else if (newCursorPos === 7) newCursorPos = 8;
            } else if (e.inputType === 'deleteContentBackward') {
                newCursorPos--; // Move back one position
                // Skip over periods
                if (newCursorPos === 2) newCursorPos = 1;
                else if (newCursorPos === 7) newCursorPos = 6;
            }

            // Ensure cursor stays within valid digit positions
            const digitPositions = [0, 1, 3, 4, 5, 6, 8, 9, 10, 11, 12];
            if (!digitPositions.includes(newCursorPos)) {
                // Snap to nearest valid position if out of bounds
                const distances = digitPositions.map(pos => Math.abs(pos - newCursorPos));
                const minDistance = Math.min(...distances);
                newCursorPos = digitPositions.find(pos => Math.abs(pos - newCursorPos) === minDistance);
            }

            // Update tracked cursor position
            currentCursorPos = newCursorPos;

            // Detailed debug logs
            console.log(`LCModule input - Input type: ${e.inputType}, Old value: ${oldValue}, New value: ${formatted}, Digits: ${digits}, Old cursor: ${oldCursorPos}, New cursor: ${newCursorPos}`);

            e.target.setSelectionRange(newCursorPos, newCursorPos);
        });

        this.inputElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling to document
            const pos = e.target.selectionStart;
            const digitPositions = [0, 1, 3, 4, 5, 6, 8, 9, 10, 11, 12];
            if (!digitPositions.includes(pos)) {
                // Snap to nearest digit position
                const distances = digitPositions.map(p => Math.abs(p - pos));
                const minDistance = Math.min(...distances);
                const nearestPos = digitPositions.find(p => Math.abs(p - pos) === minDistance);
                currentCursorPos = nearestPos;
                this.inputElement.setSelectionRange(nearestPos, nearestPos);
            } else {
                currentCursorPos = pos; // Update tracked position on click
            }
            console.log(`LCModule click - Clicked position: ${pos}, Adjusted cursor: ${currentCursorPos}`);
        });

        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                console.log('Keydown Enter/Tab - Submitting LC number');
                this.submitLCNumber(tokenSystem);
            } else if (e.key === 'Escape') {
                // Cancel LCModule interface, hide suggestions, and return focus to token-input
                tokenSystem.suggestionsContainer.innerHTML = '';
                tokenSystem.tokenInput.focus();
                console.log('LCModule Escape - Interface cancelled, focus returned to token-input');
            } else if (e.key === 'Backspace' && e.target.value.replace(/[^0-9]/g, '').length === 0) {
                e.preventDefault();
                if (tokenSystem.tokens.length > 0) {
                    const lastTokenEl = tokenSystem.tokenContainer.querySelector('.token:last-of-type');
                    if (lastTokenEl) lastTokenEl.remove();
                    tokenSystem.tokens.pop();
                    tokenSystem.updateSuggestions();
                    tokenSystem.updateConstructedText();
                    console.log('LCModule Backspace - Last token removed, tokens:', tokenSystem.tokens);
                }
                // After deleting, focus the token-input to allow further deletions
                tokenSystem.tokenInput.focus();
            }
        });

        this.submitButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling to document
            console.log('Submit button clicked - Submitting LC number');
            this.submitLCNumber(tokenSystem);
        });

        // Allow clicking outside to focus token-input without closing suggestions (handled in TokenSystem)
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
     * Submit the LC number to the token system, either adding a new token or editing an existing one based on the editing context.
     * Checks the 'data-editing-index' attribute on the suggestions container to determine the action, logging the process for debugging.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to add or edit tokens.
     */
    submitLCNumber(tokenSystem) {
        const lcNumber = this.inputElement.value;
        const suggestionsContainer = tokenSystem.suggestionsContainer;
        const editingIndex = suggestionsContainer.getAttribute('data-editing-index');
        console.log('submitLCNumber called - editingIndex:', editingIndex, 'lcNumber:', lcNumber);
        if (editingIndex !== null) {
            const index = parseInt(editingIndex, 10);
            console.log('Editing token at index:', index, 'with value:', lcNumber);
            tokenSystem.editToken(index, lcNumber);
            suggestionsContainer.removeAttribute('data-editing-index');
        } else {
            console.log('Adding new token:', lcNumber);
            tokenSystem.addToken(lcNumber);
        }
        suggestionsContainer.innerHTML = ''; // Clear suggestions
    }
}