export class TestimonyModule {
    /**
     * Initializes the TestimonyModule with properties to manage modal state, token system integration, and editing context.
     */
    constructor() {
        this.modal = null;              // Reference to the main testimony modal
        this.tokenSystem = null;        // Reference to the TokenSystem instance
        this.editingIndex = null;       // Index of the token being edited, null if adding new
        this.editingToken = null;       // Original token being edited, for restoration on cancel
        this.prefillData = null;        // Data to prefill the form, from hearing_event or editing
    }

    /**
     * Renders an empty string since suggestions are not used; the modal is handled in postRender.
     * @param {Array} options - List of possible options (unused).
     * @param {string} query - Current user input (unused).
     * @param {Object} context - Optional context object (unused).
     * @returns {string} - Empty string to indicate no suggestions.
     */
    render(options, query, context = {}) {
        return '';
    }

    /**
     * Renders the testimony modal and sets up event listeners. Opens automatically when 'Testimony' is the last token,
     * when editing a testimony token, or when prefill data is provided (e.g., from a hearing event).
     * Includes logging to debug rendering conditions and execution flow.
     * @param {HTMLElement} container - The container element (suggestionsContainer) where the modal is rendered.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance for token management.
     */
    postRender(container, tokenSystem) {
        console.log('TestimonyModule.postRender called');
        this.tokenSystem = tokenSystem;
        const suggestionsContainer = tokenSystem.suggestionsContainer;
        console.log('postRender - Tokens:', this.tokenSystem.tokens, 'editingIndex:', this.editingIndex, 'prefillData:', this.prefillData);

        // Render modal if editing, last token is 'Testimony', or prefillData exists
        if (this.editingIndex === null && this.tokenSystem.tokens[this.tokenSystem.tokens.length - 1] !== 'Testimony' && !this.prefillData) {
            console.log('Condition not met: not editing, last token is not "Testimony", and no prefillData - skipping modal render');
            return;
        }
        console.log('Condition met: rendering modal');

        // Modal HTML structure
        const modalHtml = `
            <div class="testimony-modal">
                <div class="modal-content">
                    <h2>${this.editingIndex !== null ? 'Edit Testimony' : 'Add Testimony'}</h2>
                    <form id="testimony-form">
                        <label>First Name: <input type="text" name="firstName" required></label>
                        <label>Last Name: <input type="text" name="lastName"></label>
                        <label>Role: <input type="text" name="role"></label>
                        <label>Organization: <input type="text" name="organization"></label>
                        <label>Position: 
                            <select name="position">
                                <option value="In Favor">In Favor</option>
                                <option value="Opposed">Opposed</option>
                                <option value="Neutral">Neutral</option>
                            </select>
                        </label>
                        <label>Testimony Number: <input type="text" name="testimonyNo"></label>
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
        console.log('Modal HTML set to suggestionsContainer');

        this.modal = suggestionsContainer.querySelector('.testimony-modal');
        const form = this.modal.querySelector('#testimony-form');
        const cancelBtn = this.modal.querySelector('.cancel-btn');

        // Prefill form if data exists
        if (this.prefillData) {
            console.log('Prefilling form with data:', this.prefillData);
            form.elements.firstName.value = this.prefillData.name ? this.prefillData.name.split(', ')[1] || '' : '';
            form.elements.lastName.value = this.prefillData.name ? this.prefillData.name.split(', ')[0] || '' : '';
            form.elements.role.value = this.prefillData.role || '';
            form.elements.organization.value = this.prefillData.org || '';
            form.elements.position.value = this.prefillData.position || 'Neutral';
            form.elements.testimonyNo.value = this.prefillData.testimonyNo || '';
            form.elements.format.value = this.prefillData.format || 'Written';
            form.elements.link.value = this.prefillData.link || '';
        }

        // Event listeners
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Form submit event triggered');
            this.submitForm();
        });

        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Cancel button clicked');
            this.handleCancel();
        });
    }

    /**
     * Fills the form with prefill data, handling special cases like name parsing from hearing_event data.
     * @param {HTMLFormElement} form - The testimony form element.
     * @param {Object} data - The data object to prefill the form with.
     */
    fillForm(form, data) {
        let firstName = data.firstName || '';
        let lastName = data.lastName || '';
        if (data.name && !firstName && !lastName) {
            // Parse "Lastname, Firstname" format from hearing_event
            const [parsedLastName, parsedFirstName] = data.name.split(', ').map(s => s.trim());
            firstName = parsedFirstName || '';
            lastName = parsedLastName || '';
        }
        form.firstName.value = firstName;
        form.lastName.value = lastName;

        // Handle role deduplication with organization
        form.role.value = (data.role === data.organization) ? '' : (data.role || '');
        form.organization.value = data.organization || '';
        if (data.position) form.position.value = data.position;
        form.testimonyNo.value = data.testimonyNo || '';
        form.link.value = data.link || '';

        // Set format based on hearing_event data or default to 'In Person'
        if (data.format) {
            if (data.format.toLowerCase().includes('in-person')) {
                form.format.value = 'In Person';
            } else if (data.format.toLowerCase().includes('online')) {
                form.format.value = 'Online';
            } else {
                form.format.value = 'Written';
            }
        }
    }

    /**
     * Handles form submission by collecting testimony data, prompting for metadata if special,
     * adding or updating the token in the token system, and closing the modal.
     * Includes logging to track submission and token addition.
     */
    async submitForm() {
        console.log('submitForm called');
        const form = this.modal.querySelector('#testimony-form');
        const testimonyData = {
            firstName: form.elements.firstName.value.trim(),
            lastName: form.elements.lastName.value.trim(),
            role: form.elements.role.value.trim(),
            organization: form.elements.organization.value.trim(),
            position: form.elements.position.value,
            testimonyNo: form.elements.testimonyNo.value.trim(),
            format: form.elements.format.value,
            link: form.elements.link.value.trim()
        };
        console.log('Collected testimony data:', testimonyData);

        const isSpecial = this.tokenSystem.committeeSelector.isMemberName(`${testimonyData.firstName} ${testimonyData.lastName}`);
        let metadata = {};
        if (isSpecial) {
            metadata = await this.promptForMetadata(testimonyData);
            console.log('Metadata from prompt:', metadata);
        }

        const jsonToken = JSON.stringify({ ...testimonyData, ...metadata });
        console.log('Created JSON token:', jsonToken);

        if (this.editingIndex !== null) {
            this.tokenSystem.tokens.splice(this.editingIndex, 0, jsonToken);
            console.log('Inserted token at editingIndex:', this.editingIndex);
        } else {
            const testimonyIndex = this.tokenSystem.tokens.indexOf('Testimony');
            if (testimonyIndex !== -1) {
                this.tokenSystem.tokens.splice(testimonyIndex + 1, 0, jsonToken);
                console.log('Inserted token after Testimony at index:', testimonyIndex + 1);
            } else {
                this.tokenSystem.tokens.push(jsonToken);
                console.log('Pushed token to end of tokens');
            }
        }
        console.log('Tokens after adding:', this.tokenSystem.tokens);

        this.tokenSystem.updateSuggestions();
        this.tokenSystem.updateConstructedText();
        this.closeModal();
        console.log('Modal closed, suggestions container:', this.tokenSystem.suggestionsContainer.innerHTML);

        // Reset prefill data and form
        this.prefillData = null;
        form.reset();
    }

    /**
     * Prompts the user to confirm if the person is a Senator or Representative and collects metadata.
     * @param {Object} testimonyData - The testimony data to use for member lookup.
     * @returns {Promise<Object>} - Metadata including isMember, title, memberNo, and introducedBill.
     */
    promptForMetadata(testimonyData) {
        return new Promise((resolve) => {
            const modalHtml = `
                <div class="confirmation-modal">
                    <div class="modal-content">
                        <h3>Confirm Member Status</h3>
                        <p>Are they a Senator or Representative?</p>
                        <button class="senator-btn">Senator</button>
                        <button class="representative-btn">Representative</button>
                        <button class="no-btn">No</button>
                    </div>
                </div>
            `;
            document.body.appendChild(document.createRange().createContextualFragment(modalHtml));
            const modal = document.querySelector('.confirmation-modal');

            const handleSelection = (choice) => {
                modal.remove();
                if (choice === 'No') {
                    resolve({ isMember: false });
                } else {
                    const metadata = {
                        isMember: true,
                        title: choice,
                        memberNo: this.findMemberNo(testimonyData.firstName, testimonyData.lastName)
                    };
                    this.promptForIntroducedBill().then((introducedBill) => {
                        metadata.introducedBill = introducedBill;
                        resolve(metadata);
                    });
                }
            };

            modal.querySelector('.senator-btn').addEventListener('click', () => handleSelection('Senator'));
            modal.querySelector('.representative-btn').addEventListener('click', () => handleSelection('Representative'));
            modal.querySelector('.no-btn').addEventListener('click', () => handleSelection('No'));
        });
    }

    /**
     * Prompts the user to confirm if the member is introducing a bill.
     * @returns {Promise<boolean>} - True if introducing a bill, false otherwise.
     */
    promptForIntroducedBill() {
        return new Promise((resolve) => {
            const modalHtml = `
                <div class="confirmation-modal">
                    <div class="modal-content">
                        <h3>Introducing Bill</h3>
                        <p>Are they introducing a bill?</p>
                        <button class="yes-btn">Yes</button>
                        <button class="no-btn">No</button>
                    </div>
                </div>
            `;
            document.body.appendChild(document.createRange().createContextualFragment(modalHtml));
            const modal = document.querySelector('.confirmation-modal');

            modal.querySelector('.yes-btn').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            modal.querySelector('.no-btn').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
        });
    }

    /**
     * Finds the member number from DEFAULT_COMMITTEES based on first and last name.
     * @param {string} firstName - The first name of the person.
     * @param {string} lastName - The last name of the person.
     * @returns {string|null} - The memberNo if found, null otherwise.
     */
    findMemberNo(firstName, lastName) {
        const allMembers = Object.values(this.tokenSystem.committeeSelector.committeesData).flat();
        const fullName = `${firstName} ${lastName}`;
        const member = allMembers.find(m => m.name.split(' - ')[0] === fullName);
        return member ? member.memberNo : null;
    }

    /**
     * Handles canceling the modal, restoring tokens if editing or removing 'Testimony' if adding new.
     */
    handleCancel() {
        if (this.editingIndex !== null && this.editingToken) {
            // Restore original token if editing
            this.tokenSystem.tokens.splice(this.editingIndex, 0, this.editingToken);
            this.editingIndex = null;
            this.editingToken = null;
        } else {
            // Remove 'Testimony' token if adding new and present
            const testimonyIndex = this.tokenSystem.tokens.indexOf('Testimony');
            if (testimonyIndex !== -1) {
                this.tokenSystem.tokens.splice(testimonyIndex, 1);
            }
        }
        this.closeModal();
        this.tokenSystem.updateSuggestions();
    }

    /**
     * Closes the testimony modal by nullifying the modal reference.
     * Relies on updateSuggestions to clear the suggestionsContainer, avoiding redundant DOM removal.
     */
    closeModal() {
        console.log('closeModal called');
        this.modal = null; // suggestionsContainer is already cleared by updateSuggestions
    }

    /**
     * Handles editing an existing testimony token by setting up the modal with prefilled data.
     * @param {string} token - The JSON string token to edit.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance.
     */
    editToken(token, tokenSystem) {
        this.tokenSystem = tokenSystem;
        const index = tokenSystem.tokens.indexOf(token);
        if (index === -1) return;

        this.editingToken = token;
        this.editingIndex = index;
        this.prefillData = JSON.parse(token);
        tokenSystem.tokens.splice(index, 1); // Temporarily remove token
        tokenSystem.updateSuggestions();     // Triggers postRender to show modal
    }
}