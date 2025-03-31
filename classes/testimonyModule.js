// classes/testimonyModule.js
export class TestimonyModule {
    /**
     * Initializes the TestimonyModule with properties for managing the modal and token system interactions.
     */
    constructor() {
        this.modal = null;
        this.tokenSystem = null;
        this.editingIndex = null;
        this.prefillData = null;
    }

    /**
     * Renders an empty string as no suggestions are displayed; the modal is handled in postRender.
     * @param {Array} options - List of possible options (not used here).
     * @param {string} query - The current user input (not used here).
     * @param {Object} context - Optional context object (not used here).
     * @returns {string} - Empty string to indicate no suggestions.
     */
    render(options, query, context = {}) {
        return '';
    }

    /**
     * Handles post-rendering logic to open the testimony modal, either for adding new testimony or editing existing testimony.
     * Checks for an editing index or prefill data to determine the mode and data to use.
     * @param {HTMLElement} container - The container element (suggestions container).
     * @param {TokenSystem} tokenSystem - The TokenSystem instance for adding/editing tokens.
     */
    postRender(container, tokenSystem) {
        this.tokenSystem = tokenSystem;
        let editingData = null;
        const editingIndex = container.getAttribute('data-editing-index');
        if (editingIndex !== null) {
            this.editingIndex = parseInt(editingIndex, 10);
            editingData = JSON.parse(this.tokenSystem.tokens[this.editingIndex]);
        } else {
            this.editingIndex = null;
            if (this.prefillData) {
                editingData = this.prefillData;
                this.prefillData = null;
            }
        }
        this.openModal(tokenSystem, editingData);
    }

    /**
     * Opens a modal for adding or editing testimony, prefilling data if provided, and binding form events.
     * The modal includes fields for first name, last name, role, organization, position, testimony number, link, and format.
     * Highlights the role field in red if it’s empty (i.e., after deduplication).
     * If editing an existing testimony, canceling will simply close the modal without deleting the token.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance for adding/editing tokens.
     * @param {Object|null} prefillData - Data to prefill the form (null if adding new without prefill).
     */
    openModal(tokenSystem, prefillData = null) {
        if (this.modal) {
            this.modal.remove();
        }
        this.tokenSystem = tokenSystem;

        // Process prefillData to split 'name' into firstName and lastName if not already provided
        if (prefillData && !prefillData.firstName && !prefillData.lastName && prefillData.name) {
            const parts = prefillData.name.split(',');
            if (parts.length === 2) {
                prefillData.lastName = parts[0].trim();
                prefillData.firstName = parts[1].trim();
            } else {
                prefillData.firstName = '';
                prefillData.lastName = prefillData.name;
            }
        }

        // Deduplicate role and organization: if they are the same, leave role blank
        if (prefillData && prefillData.role === prefillData.organization) {
            prefillData.role = '';
        }

        this.modal = document.createElement('div');
        this.modal.className = 'testimony-modal';
        const title = this.editingIndex !== null ? 'Edit Testimony' : 'Add Testimony';
        const roleClass = prefillData && prefillData.role === '' ? 'class="highlight-red"' : '';
        this.modal.innerHTML = `
            <div class="modal-content">
                <h2>${title}</h2>
                <form id="testimony-form">
                    <label>First Name: <input type="text" name="firstName" value="${prefillData ? prefillData.firstName : ''}"></label>
                    <label>Last Name: <input type="text" name="lastName" value="${prefillData ? prefillData.lastName : ''}"></label>
                    <label>Role: <input type="text" name="role" value="${prefillData ? prefillData.role : ''}" ${roleClass}></label>
                    <label>Organization: <input type="text" name="organization" value="${prefillData ? prefillData.organization : ''}"></label>
                    <label>Position:
                        <select name="position">
                            <option value="In Favor" ${prefillData && prefillData.position === 'In Favor' ? 'selected' : ''}>In Favor</option>
                            <option value="In Opposition" ${prefillData && prefillData.position === 'In Opposition' ? 'selected' : ''}>In Opposition</option>
                            <option value="Neutral" ${prefillData && prefillData.position === 'Neutral' ? 'selected' : ''}>Neutral</option>
                        </select>
                    </label>
                    <label>Testimony Number: <input type="text" name="testimonyNo" value="${prefillData ? prefillData.testimonyNo : ''}"></label>
                    <label>Link: <input type="text" name="link" value="${prefillData ? prefillData.link : ''}"></label>
                    <label>Format:
                        <select name="format">
                            <option value="In Person" ${prefillData && prefillData.format === 'In Person' ? 'selected' : ''}>In Person</option>
                            <option value="Online" ${prefillData && prefillData.format === 'Online' ? 'selected' : ''}>Online</option>
                            <option value="Written" ${prefillData && prefillData.format === 'Written' ? 'selected' : ''}>Written</option>
                        </select>
                    </label>
                    <button type="submit">${title}</button>
                    <button type="button" class="cancel-btn">Cancel</button>
                </form>
            </div>
        `;
        document.body.appendChild(this.modal);

        const form = this.modal.querySelector('#testimony-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const testimonyData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                role: formData.get('role'),
                organization: formData.get('organization'),
                position: formData.get('position'),
                testimonyNo: formData.get('testimonyNo'),
                link: formData.get('link'),
                format: formData.get('format')
            };
            const jsonString = JSON.stringify(testimonyData);
            if (this.editingIndex !== null) {
                this.tokenSystem.editToken(this.editingIndex, jsonString);
                this.tokenSystem.suggestionsContainer.removeAttribute('data-editing-index');
            } else {
                this.tokenSystem.addToken(jsonString);
            }
            this.modal.remove();
            this.modal = null;
        });

        const cancelBtn = this.modal.querySelector('.cancel-btn');
        cancelBtn.addEventListener('click', () => {
            this.modal.remove();
            this.modal = null;
            // In add mode, remove the "Testimony" token if the user cancels.
            // In editing mode, do not remove the token.
            if (this.editingIndex === null) {
                const testimonyIndex = this.tokenSystem.tokens.indexOf("Testimony");
                if (testimonyIndex !== -1) {
                    this.tokenSystem.tokens.splice(testimonyIndex, 1);
                    const tokenElements = this.tokenSystem.tokenContainer.querySelectorAll('.token');
                    tokenElements[testimonyIndex].remove();
                    this.tokenSystem.updateSuggestions();
                    this.tokenSystem.updateConstructedText();
                }
            }
        });
    }

    
}