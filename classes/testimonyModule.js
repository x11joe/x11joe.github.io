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
     * Opens the testimony modal after rendering and prefills it with data if available from the Chrome extension or manual input.
     * Ensures form fields have correct 'name' attributes for FormData collection and applies prefill data accurately.
     * @param {HTMLElement} container - The container element where the modal is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to interact with tokens.
     */
    postRender(container, tokenSystem) {
        this.tokenSystem = tokenSystem;
        const suggestionsContainer = tokenSystem.suggestionsContainer;

        // Create modal HTML with explicit 'name' attributes for FormData
        const modalHtml = `
            <div class="testimony-modal">
                <div class="modal-content">
                    <h2>Add Testimony</h2>
                    <form id="testimony-form">
                        <label>First Name: <input type="text" name="firstName" required></label>
                        <label>Last Name: <input type="text" name="lastName" required></label>
                        <label>Role: <input type="text" name="role"></label>
                        <label>Organization: <input type="text" name="organization"></label>
                        <label>Format:
                            <select name="format">
                                <option value="In Person">In Person</option>
                                <option value="Online">Online</option>
                                <option value="Written">Written</option>
                            </select>
                        </label>
                        <label>Link: <input type="text" name="link"></label>
                        <button type="submit">Add Testimony</button>
                        <button type="button" class="cancel-btn">Cancel</button>
                    </form>
                </div>
            </div>
        `;
        suggestionsContainer.innerHTML = modalHtml;
        this.modal = suggestionsContainer.querySelector(".testimony-modal");

        const form = this.modal.querySelector("#testimony-form");

        // Prefill form with prefillData if available (e.g., from HEARING_STATEMENT event)
        if (this.prefillData) {
            const fields = ["firstName", "lastName", "role", "organization", "format", "link"];
            fields.forEach(field => {
                const input = form.querySelector(`[name="${field}"]`);
                if (input && this.prefillData[field]) {
                    input.value = this.prefillData[field];
                }
            });
            this.prefillData = null; // Clear after prefill to prevent reuse
        }

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            this.submitForm();
        });

        const cancelBtn = this.modal.querySelector(".cancel-btn");
        cancelBtn.addEventListener("click", () => {
            this.closeModal();
        });

        document.addEventListener("click", (e) => {
            if (this.modal && !this.modal.querySelector(".modal-content").contains(e.target)) {
                this.closeModal();
            }
        });
    }
  

    /**
     * Opens a modal for adding or editing testimony, pre‐filling data if provided.
     * If the testimony data’s role contains “Senator” or “Representative” (case-insensitive),
     * this method will first ask:
     *  1. "Is this person a Senator or Representative? (yes or no)"
     * If the user confirms, it then asks:
     *  2. "Are they introducing a bill? (yes or no)"
     * The testimonyData is augmented with an "introducingBill" property accordingly.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance for adding/editing tokens.
     * @param {Object|null} prefillData - Data to prefill the form (null if adding new without prefill).
     */
    async openModal(tokenSystem, prefillData = null) {
        if (this.modal) {
        this.modal.remove();
        }
        this.tokenSystem = tokenSystem;
        // Set editing mode if suggestions container has a data-editing-index attribute
        if (tokenSystem.suggestionsContainer.hasAttribute('data-editing-index')) {
        this.editingIndex = parseInt(tokenSystem.suggestionsContainer.getAttribute('data-editing-index'), 10);
        } else {
        this.editingIndex = null;
        }
        
        // Process prefillData: if no firstName/lastName but a name exists, split it.
        if (prefillData && !prefillData.firstName && !prefillData.lastName && prefillData.name) {
        const parts = prefillData.name.split(',');
        if (parts.length === 2) {
            prefillData.lastName = parts[0].trim();
            prefillData.firstName = parts[1].trim();
        } else {
            prefillData.firstName = '';
            prefillData.lastName = prefillData.name;
        }
        console.log("Pre-fill data processed:", prefillData);
        }
        // Deduplicate role and organization if they are identical
        if (prefillData && prefillData.role === prefillData.organization) {
        prefillData.role = '';
        console.log("Role deduplicated, new role:", prefillData.role);
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
        console.log("Testimony form submitted, data:", testimonyData);
        const roleLower = testimonyData.role.toLowerCase();
        if (roleLower.includes("senator") || roleLower.includes("representative")) {
            console.log("Role contains senator or representative, prompting confirmation");
            const isSpecial = await this.showConfirmationModal("Is this person a Senator or Representative? (yes or no)");
            console.log("First confirmation result:", isSpecial);
            if (isSpecial) {
            const introducing = await this.showConfirmationModal("Are they introducing a bill? (yes or no)");
            console.log("Second confirmation result:", introducing);
            testimonyData.introducingBill = introducing;
            }
        } else {
            console.log("Role does not contain senator or representative, no confirmation prompted");
        }
        const jsonString = JSON.stringify(testimonyData);
        console.log("Final testimony token JSON:", jsonString);
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
        console.log("Testimony modal cancelled");
        this.modal.remove();
        this.modal = null;
        });
    }
    
    closeModal() {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
            this.tokenSystem.suggestionsContainer.innerHTML = "";
            this.tokenSystem.tokenInput.focus();
        }
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

    /**
     * Submits the testimony form data as a JSON token to the TokenSystem.
     * Explicitly constructs the testimony object from form inputs to ensure all values are captured, avoiding blank JSON.
     * Handles both adding new tokens and editing existing ones based on the editing context.
     */
    submitForm() {
        const form = this.modal.querySelector("#testimony-form");
        const formData = new FormData(form);
        
        // Explicitly build the testimony object from form inputs
        const testimonyData = {
            firstName: formData.get("firstName") || "",
            lastName: formData.get("lastName") || "",
            role: formData.get("role") || "",
            organization: formData.get("organization") || "",
            format: formData.get("format") || "In Person",
            link: formData.get("link") || ""
        };

        // Validate required fields to prevent empty submissions
        if (!testimonyData.firstName || !testimonyData.lastName) {
            console.error("First Name and Last Name are required for testimony submission");
            return;
        }

        const jsonToken = JSON.stringify(testimonyData);
        console.log("Submitting testimony token:", jsonToken); // Debug log to verify token content

        if (this.editingIndex !== null) {
            this.tokenSystem.editToken(this.editingIndex, jsonToken);
            this.editingIndex = null;
        } else {
            this.tokenSystem.addToken(jsonToken);
        }

        this.closeModal();
    }
 
}