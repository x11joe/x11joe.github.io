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
     * Handles post-rendering logic to open the testimony modal for adding/editing testimony.
     * If the token system’s suppressTestimonyModule flag is set, the modal will not be opened.
     * @param {HTMLElement} container - The container element (suggestions container).
     * @param {TokenSystem} tokenSystem - The TokenSystem instance for adding/editing tokens.
     */
    postRender(container, tokenSystem) {
        this.tokenSystem = tokenSystem;
        // If the testimony module suppression flag is set, clear it and do not open the modal.
        if (this.tokenSystem.suppressTestimonyModule) {
            this.tokenSystem.suppressTestimonyModule = false;
            return;
        }
        let editingData = null;
        const editingIndex = container.getAttribute('data-editing-index');
        if (editingIndex !== null) {
            this.editingIndex = parseInt(editingIndex, 10);
            const tokenValue = this.tokenSystem.tokens[this.editingIndex];
            if (tokenValue && tokenValue !== "undefined") {
                try {
                    editingData = JSON.parse(tokenValue);
                } catch (error) {
                    console.error("Error parsing testimony token:", tokenValue, error);
                    editingData = null;
                }
            }
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
     * Opens a modal for adding or editing testimony, pre‐filling data if provided.
     * If the testimony data’s role contains “Senator” or “Representative”, a custom confirmation
     * modal will ask two questions before finalizing the save.
     * In the first question, if the user confirms the person is a Senator or Representative,
     * a second question is asked: “Are they introducing a bill?”
     * The testimonyData object is then augmented with an "introducingBill" property.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance for adding/editing tokens.
     * @param {Object|null} prefillData - Data to prefill the form (null if adding new without prefill).
     */
    async openModal(tokenSystem, prefillData = null) {
        if (this.modal) {
        this.modal.remove();
        }
        this.tokenSystem = tokenSystem;
        // Set editing mode if the suggestions container has a data-editing-index attribute.
        if (tokenSystem.suggestionsContainer.hasAttribute('data-editing-index')) {
        this.editingIndex = parseInt(tokenSystem.suggestionsContainer.getAttribute('data-editing-index'), 10);
        } else {
        this.editingIndex = null;
        }
    
        // Process prefillData: split 'name' into firstName and lastName if not provided.
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
        // Deduplicate role and organization.
        if (prefillData && prefillData.role === prefillData.organization) {
        prefillData.role = '';
        }
    
        this.modal = document.createElement('div');
        this.modal.className = 'testimony-modal';
        const title = this.editingIndex !== null ? 'Save Testimony' : 'Add Testimony';
        const roleClass = prefillData && prefillData.role === '' ? 'class="highlight-red"' : '';
        this.modal.innerHTML = `
        <div class="modal-content">
            <h2>${title}</h2>
            <form id="testimony-form">
            <label>First Name: <input type="text" name="firstName" value="${prefillData && prefillData.firstName ? prefillData.firstName : ''}"></label>
            <label>Last Name: <input type="text" name="lastName" value="${prefillData && prefillData.lastName ? prefillData.lastName : ''}"></label>
            <label>Role: <input type="text" name="role" value="${prefillData && prefillData.role ? prefillData.role : ''}" ${roleClass}></label>
            <label>Organization: <input type="text" name="organization" value="${prefillData && prefillData.organization ? prefillData.organization : ''}"></label>
            <label>Position:
                <select name="position">
                <option value="In Favor" ${prefillData && prefillData.position === 'In Favor' ? 'selected' : ''}>In Favor</option>
                <option value="In Opposition" ${prefillData && prefillData.position === 'In Opposition' ? 'selected' : ''}>In Opposition</option>
                <option value="Neutral" ${prefillData && prefillData.position === 'Neutral' ? 'selected' : ''}>Neutral</option>
                </select>
            </label>
            <label>Testimony Number: <input type="text" name="testimonyNo" value="${prefillData && prefillData.testimonyNo ? prefillData.testimonyNo : ''}"></label>
            <label>Link: <input type="text" name="link" value="${prefillData && prefillData.link ? prefillData.link : ''}"></label>
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
        form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const testimonyData = {
            firstName: formData.get('firstName') || '',
            lastName: formData.get('lastName') || '',
            role: formData.get('role') || '',
            organization: formData.get('organization') || '',
            position: formData.get('position') || '',
            testimonyNo: formData.get('testimonyNo') || '',
            link: formData.get('link') || '',
            format: formData.get('format') || ''
        };
        // If role contains "senator" or "representative" (case insensitive), ask additional questions.
        const roleLower = testimonyData.role.toLowerCase();
        if (roleLower.includes("senator") || roleLower.includes("representative")) {
            const isSpecial = await this.showConfirmationModal("Is this person a Senator or Representative? (yes or no)");
            if (isSpecial) {
            const introducing = await this.showConfirmationModal("Are they introducing a bill? (yes or no)");
            testimonyData.introducingBill = introducing;
            }
        }
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
        });
    }

    /**
     * Displays a custom confirmation modal with the provided question.
     * Resolves with true for “Yes” and false for “No.”
     * @param {string} question - The question to display.
     * @returns {Promise<boolean>}
     */
    async showConfirmationModal(question) {
        return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'confirmation-modal';
        modal.innerHTML = `
            <div class="modal-content">
            <p>${question}</p>
            <button class="yes-btn">Yes</button>
            <button class="no-btn">No</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.yes-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(true);
        });
        modal.querySelector('.no-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        });
    }
    
    /**
     * Shows a special prompt modal asking:
     * 1. "Is this person a Senator or Representative? (yes/no)"
     * If yes, then asks:
     * 2. "Are they introducing a bill? (yes/no)"
     * Resolves with an object { special: boolean, introducingBill: boolean }.
     * @returns {Promise<Object>} Promise that resolves with the prompt answers.
     */
    showSpecialPrompt() {
        return new Promise((resolve) => {
        // Create the modal container for the special prompt
        const promptModal = document.createElement('div');
        promptModal.className = 'special-prompt-modal';
        promptModal.innerHTML = `
            <div class="special-prompt-content">
            <h2>Additional Confirmation</h2>
            <p>Is this person a Senator or Representative? (yes/no)</p>
            <button id="special-yes">Yes</button>
            <button id="special-no">No</button>
            </div>
        `;
        document.body.appendChild(promptModal);
        // First question event handlers
        promptModal.querySelector('#special-yes').addEventListener('click', () => {
            // Remove first prompt content and show second question
            promptModal.innerHTML = `
            <div class="special-prompt-content">
                <h2>Additional Confirmation</h2>
                <p>Are they introducing a bill? (yes/no)</p>
                <button id="introducing-yes">Yes</button>
                <button id="introducing-no">No</button>
            </div>
            `;
            promptModal.querySelector('#introducing-yes').addEventListener('click', () => {
            document.body.removeChild(promptModal);
            resolve({ special: true, introducingBill: true });
            });
            promptModal.querySelector('#introducing-no').addEventListener('click', () => {
            document.body.removeChild(promptModal);
            resolve({ special: true, introducingBill: false });
            });
        });
        promptModal.querySelector('#special-no').addEventListener('click', () => {
            document.body.removeChild(promptModal);
            resolve({ special: false });
        });
        });
    }

 
}