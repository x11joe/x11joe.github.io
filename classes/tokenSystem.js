// classes/tokenSystem.js
import { TextConstructor } from './textConstructor.js';
export class TokenSystem {

    /**
     * Initializes the TokenSystem with necessary DOM elements and dependencies.
     * Binds methods to ensure correct 'this' context in callbacks.
     * @param {HTMLElement} tokenContainer - Container for token elements.
     * @param {HTMLInputElement} tokenInput - Input field for token entry.
     * @param {HTMLElement} suggestionsContainer - Container for suggestion dropdown.
     * @param {Array} flowData - Data defining token flow and options.
     * @param {Object} classRegistry - Registry of class modules for rendering.
     * @param {Object} defaultRenderer - Default renderer for suggestions.
     * @param {CommitteeSelector} committeeSelector - Selector for committee data.
     * @param {HistoryManager} historyManager - Manager for history entries.
     */
    constructor(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer, committeeSelector, historyManager) {
        this.tokenContainer = tokenContainer;
        this.tokenInput = tokenInput;
        this.suggestionsContainer = suggestionsContainer;
        this.flowData = flowData;
        this.classRegistry = classRegistry;
        this.defaultRenderer = defaultRenderer;
        this.committeeSelector = committeeSelector;
        this.historyManager = historyManager;
        this.tokens = [];
        this.isEditing = false;
        this.editingEntry = null;
        this.suppressSuggestions = false;
        this.suppressTestimonyModule = false;
        this.startTime = null;
        this.markedTime = null;
        this.highlightedIndex = -1;
        this.enterHandled = false;
        this.techTextField = document.getElementById('tech-text');
        this.procedureTextField = document.getElementById('procedure-text');
        // Bind updateSuggestions to ensure 'this' refers to the TokenSystem instance
        this.updateSuggestions = this.updateSuggestions.bind(this);
    }
  
    /**
     * Bind event listeners to the token input and suggestions container to handle user interactions.
     * Prevents hiding suggestions when a class module is active, ensuring module interfaces remain visible until completed.
     * Handles clicks on the token-input to hide suggestions and suppress re-rendering when a class module is active,
     * focusing the input afterward to allow seamless user interaction. Resets suppressSuggestions on input to allow rendering
     * after meaningful user interaction post-deletion.
     */
    _bindEvents() {
        this.tokenInput.addEventListener("keydown", (e) => this.handleKeyDown(e));
        this.tokenInput.addEventListener("keyup", (e) => this.handleKeyUp(e));
        
        this.tokenInput.addEventListener("focus", () => {
            console.log('Input focused - updating suggestions');
            this.updateSuggestions();
        });
        
        this.tokenInput.addEventListener("click", () => {
            console.log('Input clicked - updating suggestions');
            this.updateSuggestions();
        });
        
        this.tokenInput.addEventListener("input", () => {
            if (this.tokenInput.value.trim() !== "") {
                this.suppressSuggestions = false;
            }
        });
        
        this.suggestionsContainer.addEventListener("click", (e) => {
            if (e.target && e.target.nodeName === "LI") {
                const value = e.target.dataset.value;
                const editingIndex = this.suggestionsContainer.getAttribute('data-editing-index');
                if (editingIndex !== null) {
                    // Editing mode
                    const index = parseInt(editingIndex, 10);
                    this.editToken(index, value);
                    this.suggestionsContainer.removeAttribute('data-editing-index');
                } else {
                    // Normal mode
                    if (e.target.hasAttribute('data-shortcut') && e.target.dataset.shortcut === "member") {
                        this.setTokens(["Member Action", value]);
                    } else {
                        this.addToken(value);
                    }
                }
                this.suppressSuggestions = false; // Reset flag after selecting a suggestion
                e.stopPropagation();
            }
        });
        
        document.addEventListener("click", (e) => {
            const branchData = this.getCurrentBranchData();
            const isClassModuleActive = branchData["Class"] && this.suggestionsContainer.innerHTML !== "";
            const isEditingModule = this.suggestionsContainer.getAttribute('data-editing-index') !== null;
            console.log('Document click - Target:', e.target, 'isClassModuleActive:', isClassModuleActive, 'isEditingModule:', isEditingModule, 'Suggestions content exists:', this.suggestionsContainer.innerHTML !== '');
            
            if (e.target === this.tokenInput && isClassModuleActive) {
                // Clicking token-input while a class module is active: hide suggestions and suppress re-render
                console.log('Clicked token-input while class module active - Hiding suggestions and setting suppressSuggestions to true');
                this.suggestionsContainer.innerHTML = "";
                this.suggestionsContainer.removeAttribute('data-editing-index');
                this.suppressSuggestions = true;
                this.tokenInput.focus();
            } else if (!this.suggestionsContainer.contains(e.target) && e.target !== this.tokenInput) {
                if (!isEditingModule && !isClassModuleActive) {
                    console.log('Clicked outside - Hiding suggestions');
                    this.suggestionsContainer.innerHTML = "";
                    this.suggestionsContainer.removeAttribute('data-editing-index');
                } else {
                    console.log('Editing or class module active - Keeping suggestions visible');
                }
            }
        });
    }

    /**
     * Get the current branch of the flow data based on the current selected tokens.
     * @returns {Object} The current branch data.
     */
    getCurrentBranchData() {
        return this.getCurrentBranchDataForTokens(this.tokens);
    }

    /**
     * Get the branch data for a given token sequence.
     * @param {Array} tokens - The token sequence to navigate with.
     * @returns {Object} The branch data for that sequence.
     */
    getCurrentBranchDataForTokens(tokens) {
        if (tokens.length === 0) {
            const startingModules = this.flowData.map(moduleObj => Object.keys(moduleObj)[0]);
            return { Options: startingModules };
        }

        const moduleName = tokens[0];
        let currentData = null;
        for (let i = 0; i < this.flowData.length; i++) {
            if (this.flowData[i][moduleName]) {
                currentData = this.flowData[i][moduleName];
                break;
            }
        }
        if (!currentData) return {};

        if (tokens.length === 1) {
            return currentData;
        }

        const isSecondTokenMember = tokens.length >= 2 && this.committeeSelector.isMemberName(tokens[1]);
        let navigationTokens = isSecondTokenMember ? tokens.slice(2) : tokens.slice(1);

        for (const token of navigationTokens) {
            if (currentData[token]) {
                currentData = currentData[token];
            } else {
                currentData = {};
                break;
            }
        }

        if (tokens.length === 2 && isSecondTokenMember) {
            const { Class, ...rest } = currentData;
            return rest;
        }

        return currentData;
    }

    /**
     * Updates the suggestions dropdown based on the current tokens and input value.
     * Manages the rendering of class modules or default suggestions, ensuring proper event binding.
     * Includes detailed logging to track renderer selection and execution.
     */
    updateSuggestions() {
        if (this.suppressSuggestions) {
            console.log('Suggestions suppressed');
            this.suppressSuggestions = false;
            return;
        }
        console.log('updateSuggestions called - Tokens:', this.tokens, 'Input value:', this.tokenInput.value, 'suppressSuggestions:', this.suppressSuggestions);
        const currentData = this.getCurrentBranchDataForTokens(this.tokens);
        console.log('Current branch data:', currentData);

        if (currentData["Class"] && this.classRegistry[currentData["Class"]]) {
            const renderer = this.classRegistry[currentData["Class"]];
            console.log('Renderer selected:', currentData["Class"]);
            const context = {
                members: this.committeeSelector.getSelectedCommitteeMembers(),
                allCommittees: Object.keys(this.committeeSelector.committeesData),
                selectedCommittee: this.committeeSelector.getSelectedCommittee()
            };
            const html = renderer.render(this.getOptions(), this.tokenInput.value, context);
            console.log('Renderer HTML output:', html);
            this.suggestionsContainer.innerHTML = html;
            if (typeof renderer.postRender === 'function') {
                console.log('Calling renderer.postRender for', currentData["Class"]);
                renderer.postRender(this.suggestionsContainer, this);
            } else {
                console.log('No postRender function for', currentData["Class"]);
            }
            if (typeof renderer.bindEvents === 'function') {
                console.log('Binding events for', currentData["Class"]);
                renderer.bindEvents(this.suggestionsContainer, this);
            }
        } else {
            const options = this.getOptions();
            const html = this.defaultRenderer.render(options, this.tokenInput.value);
            console.log('Default renderer HTML output:', html);
            this.suggestionsContainer.innerHTML = html;

            const suggestions = this.suggestionsContainer.querySelectorAll("li");
            suggestions.forEach((suggestion, index) => {
                suggestion.addEventListener("click", () => {
                    const value = suggestion.dataset.value;
                    if (suggestion.hasAttribute('data-shortcut') && suggestion.dataset.shortcut === "member") {
                        this.setTokens(["Member Action", value]);
                    } else {
                        this.addToken(value);
                    }
                });
                suggestion.addEventListener("mouseover", () => {
                    this.highlightedIndex = index;
                    this.updateHighlighted();
                });
            });
            this.updateHighlighted();
        }
    }
    
    
    updateHighlighted() {
        const suggestions = this.suggestionsContainer.querySelectorAll("li");
        suggestions.forEach((sug, index) => {
        if (index === this.highlightedIndex) {
            sug.classList.add("highlighted");
            sug.scrollIntoView({ block: "nearest" });
        } else {
            sug.classList.remove("highlighted");
        }
        });
    }

    /**
     * Add a new token to the container and tokens array, updating suggestions and managing focus dynamically.
     * If the current branch has a "Class" (e.g., LC_Module), it immediately renders the class module's interface.
     * @param {string} value - The selected option to add as a token.
     */
    addToken(value) {
        if (!this.isEditing && this.tokens.length === 0) {
            this.startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        }
        const tokenSpan = this.createTokenElement(value);
        const inputWrapper = this.tokenContainer.querySelector('.input-wrapper');
        this.tokenContainer.insertBefore(tokenSpan, inputWrapper);
        this.tokens.push(value);
        this.tokenInput.value = "";
        this.updateConstructedText();

        // Get the current branch data after adding the token
        const branchData = this.getCurrentBranchData();

        // If the branch has a "Class" (e.g., LC_Module), render the class module's interface immediately
        if (branchData["Class"]) {
            const renderer = this.classRegistry[branchData["Class"]] || this.defaultRenderer;
            const context = {
                members: this.committeeSelector.getSelectedCommitteeMembers(),
                allCommittees: Object.keys(this.committeeSelector.committeesData),
                selectedCommittee: this.committeeSelector.getSelectedCommittee()
            };
            const html = renderer.render([], '', context);
            this.suggestionsContainer.innerHTML = html;
            if (typeof renderer.bindEvents === 'function') {
                renderer.bindEvents(this.suggestionsContainer, this);
            }
            if (typeof renderer.postRender === 'function') {
                renderer.postRender(this.suggestionsContainer, this);
            }
            // Ensure focus is set to the input field of the class module (e.g., LC# input)
            const inputElement = this.suggestionsContainer.querySelector('.lc-input');
            if (inputElement) {
                inputElement.focus();
            }
        } else {
            // Otherwise, update suggestions as usual and focus the main token input
            this.updateSuggestions();
            this.tokenInput.focus();
        }
    }

    /**
     * Creates a token element for display in the token container with a click listener to edit it.
     * Customizes display for testimony tokens to show 'Firstname Lastname - Position'.
     * @param {string} value - The token value (string or JSON string for testimony).
     * @returns {HTMLElement} - The created token span element.
     */
    createTokenElement(value) {
        const tokenSpan = document.createElement('span');
        tokenSpan.className = 'token';
        if (value.startsWith('{')) {
            try {
                const data = JSON.parse(value);
                tokenSpan.textContent = `${data.firstName} ${data.lastName} - ${data.position}`;
            } catch (e) {
                tokenSpan.textContent = value; // Fallback to raw value if parsing fails
            }
        } else {
            tokenSpan.textContent = value;
        }
        tokenSpan.addEventListener('click', () => this.editToken(this.tokens.indexOf(value)));
        return tokenSpan;
    }



    /**
     * Clear existing tokens and set new ones from an array, ensuring dropdowns for editing and immediate module rendering.
     * Triggers module interfaces when a class is defined in the flow, maintaining focus on the token input afterward.
     * @param {Array<string>} tokenArray - Array of token values to set.
     */
    setTokens(tokenArray) {
        console.log('setTokens called - New tokens:', tokenArray);
        const tokenElements = this.tokenContainer.querySelectorAll('.token');
        tokenElements.forEach(el => el.remove());
        this.tokens = [];

        const inputWrapper = this.tokenContainer.querySelector('.input-wrapper');

        tokenArray.forEach(value => {
            const tokenSpan = this.createTokenElement(value);
            this.tokenContainer.insertBefore(tokenSpan, inputWrapper);
            this.tokens.push(value);
        });

        if (!this.isEditing && this.tokens.length > 0) {
            this.startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        }

        this.tokenInput.value = '';
        this.updateConstructedText();

        // Immediately update suggestions to render class module interfaces if applicable
        const branchData = this.getCurrentBranchData();
        if (branchData["Class"]) {
            const renderer = this.classRegistry[branchData["Class"]] || this.defaultRenderer;
            const context = {
                members: this.committeeSelector.getSelectedCommitteeMembers(),
                allCommittees: Object.keys(this.committeeSelector.committeesData),
                selectedCommittee: this.committeeSelector.getSelectedCommittee()
            };
            const html = renderer.render([], '', context);
            this.suggestionsContainer.innerHTML = html;
            if (typeof renderer.bindEvents === 'function') {
                renderer.bindEvents(this.suggestionsContainer, this);
            }
            if (typeof renderer.postRender === 'function') {
                renderer.postRender(this.suggestionsContainer, this);
            }
            const inputElement = this.suggestionsContainer.querySelector('.lc-input');
            if (inputElement) {
                inputElement.focus();
            }
        } else {
            this.updateSuggestions();
        }
        this.tokenInput.focus();
    }


    /**
     * Display editing options for a token at the specified index. If the token represents testimony
     * (i.e. its value is a JSON string or is exactly "Testimony"), then directly open the TestimonyModule modal
     * with the prefilled data as a new entry (clearing any editing state).
     * @param {number} index - The index of the token to edit.
     * @param {HTMLElement} tokenElement - The DOM element of the token being edited.
     */
    showTokenOptions(index, tokenElement) {
        console.log('showTokenOptions called - Index:', index, 'Token:', this.tokens[index]);
        const currentValue = this.tokens[index] || "";
        if (!currentValue) {
        console.warn("No token value found at index", index);
        return;
        }
        if (currentValue === "Testimony" || currentValue.startsWith('{')) {
        let prefillData = null;
        try {
            prefillData = currentValue.startsWith('{') ? JSON.parse(currentValue) : {};
        } catch (e) {
            console.error("Error parsing testimony token JSON in showTokenOptions:", e);
            prefillData = {};
        }
        console.log("showTokenOptions: Opening testimony modal with prefillData:", prefillData);
        // Clear any editing state so we force a new testimony entry.
        this.suggestionsContainer.removeAttribute('data-editing-index');
        this.classRegistry["Testimony_Module"].prefillData = prefillData;
        this.classRegistry["Testimony_Module"].openModal(this, prefillData);
        return;
        }
        // For non-testimony tokens, proceed with the normal editing interface.
        const tempTokens = this.tokens.slice(0, index);
        const branchData = this.getCurrentBranchDataForTokens(tempTokens);
        if (branchData["Class"]) {
        const renderer = this.classRegistry[branchData["Class"]] || this.defaultRenderer;
        const context = {
            members: this.committeeSelector.getSelectedCommitteeMembers(),
            allCommittees: Object.keys(this.committeeSelector.committeesData),
            selectedCommittee: this.committeeSelector.getSelectedCommittee()
        };
        const html = renderer.render([], '', context);
        this.suggestionsContainer.innerHTML = html;
        this.suggestionsContainer.setAttribute('data-editing-index', index);
        console.log('Set data-editing-index to:', index);
        if (typeof renderer.bindEvents === 'function') {
            renderer.bindEvents(this.suggestionsContainer, this);
            const inputElement = this.suggestionsContainer.querySelector('.lc-input') || renderer.inputElement;
            if (inputElement) {
            inputElement.value = currentValue;
            inputElement.focus();
            if (typeof renderer.postRender === 'function') {
                renderer.postRender(this.suggestionsContainer, this);
            }
            }
        }
        } else {
        // Fallback: show a simple dropdown with static options.
        const options = this.getOptionsForToken(index);
        const dropdown = document.createElement('div');
        dropdown.className = 'token-dropdown';
        let html = '<ul>';
        options.forEach(option => {
            html += `<li data-value="${option}">${option}</li>`;
        });
        html += '</ul>';
        dropdown.innerHTML = html;
        document.body.appendChild(dropdown);
        const rect = tokenElement.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        dropdown.addEventListener('click', (e) => {
            if (e.target.tagName === 'LI') {
            const newValue = e.target.dataset.value;
            if (this.tokens[index] === "LC#" && newValue === "LC#") {
                this.suppressSuggestions = false;
                console.log('Reset suppressSuggestions to false because "LC#" was reselected');
            }
            this.editToken(index, newValue);
            dropdown.remove();
            }
        });
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== tokenElement.querySelector('.dropdown-arrow')) {
            dropdown.remove();
            }
        }, { once: true });
        }
    }
  

    /**
     * Get the possible options for editing a token at a specific index, using class module options where applicable.
     * @param {number} index - The index of the token to edit.
     * @returns {Array<string>} The list of possible options for that token.
     */
    getOptionsForToken(index) {
        if (index === 0) {
            // Starting modules
            return this.flowData.map(moduleObj => Object.keys(moduleObj)[0]);
        } else if (this.tokens[0] === "Member Action" && index === 1) {
            // Member names for "Member Action"
            const renderer = this.classRegistry["Member_Module"];
            const context = { members: this.committeeSelector.getSelectedCommitteeMembers() };
            return renderer.getOptions("", context);
        } else {
            const tempTokens = this.tokens.slice(0, index);
            let currentData = this.getCurrentBranchDataForTokens(tempTokens);
            if (currentData["Class"] && this.classRegistry[currentData["Class"]] && typeof this.classRegistry[currentData["Class"]].getOptions === 'function') {
                const context = {
                    members: this.committeeSelector.getSelectedCommitteeMembers(),
                    allCommittees: Object.keys(this.committeeSelector.committeesData),
                    selectedCommittee: this.committeeSelector.getSelectedCommittee()
                };
                return this.classRegistry[currentData["Class"]].getOptions("", context);
            } else {
                return currentData["Options"] || [];
            }
        }
    }

    getOptions() {
        const currentData = this.getCurrentBranchDataForTokens(this.tokens);
        if (currentData["Options"]) {
            return currentData["Options"];
        } else if (currentData["Class"] && this.classRegistry[currentData["Class"]] && typeof this.classRegistry[currentData["Class"]].getOptions === 'function') {
            const context = {
                members: this.committeeSelector.getSelectedCommitteeMembers(),
                allCommittees: Object.keys(this.committeeSelector.committeesData),
                selectedCommittee: this.committeeSelector.getSelectedCommittee()
            };
            return this.classRegistry[currentData["Class"]].getOptions(this.tokenInput.value, context);
        } else {
            return []; // Default to no options when currentData is empty
        }
    }

    /**
     * Toggle the mark time feature on or off when the '`' key is pressed, updating the UI accordingly.
     */
    markTime() {
        if (this.markedTime) {
            this.markedTime = null;
            document.body.classList.remove('marking-time');
        } else {
            this.markedTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
            document.body.classList.add('marking-time');
        }
    }
    
    updateConstructedText() {
        const techText = TextConstructor.getTechText(this.tokens, this.committeeSelector);
        const procedureText = TextConstructor.getProcedureText(this.tokens, this.committeeSelector);
        this.techTextField.value = techText;
        this.procedureTextField.value = procedureText;
    }

    /**
     * Handle clicks on tokens, triggering the testimony modal if the token represents testimony.
     * For testimony tokens (i.e. ones whose value is JSON), this method will immediately call showTokenOptions.
     * Otherwise, if the click target is the dropdown arrow, it will trigger the normal editing interface.
     * @param {Event} e - The click event.
     */
    tokenClickHandler(e) {
        e.stopPropagation();
        // Use the token element on which this event is bound.
        const tokenSpan = e.currentTarget;
        // Get the token value
        const tokenValue = tokenSpan.dataset.value;
        if (!tokenValue) {
            console.warn("Token value is undefined or empty.");
            return;
        }
        // If the token's value starts with '{', assume it's a testimony token.
        if (tokenValue.startsWith('{')) {
            const tokenElements = Array.from(this.tokenContainer.querySelectorAll(".token"));
            const index = tokenElements.indexOf(tokenSpan);
            if (index !== -1) {
                this.showTokenOptions(index, tokenSpan);
            }
        }
        // Else, if the clicked element is the dropdown arrow, trigger normal editing.
        else if (e.target.className === 'dropdown-arrow') {
            const tokenElements = Array.from(this.tokenContainer.querySelectorAll(".token"));
            const index = tokenElements.indexOf(tokenSpan);
            if (index !== -1) {
                this.showTokenOptions(index, tokenSpan);
            }
        }
    }
  
    /**
     * Handle keydown events for token input, managing token addition, deletion, and history storage.
     * Safely handles Tab and Backspace to prevent errors and ensures smooth navigation through suggestions.
     * Sets suppressSuggestions to true when deleting a token to prevent immediate re-rendering of class modules.
     * @param {Event} e - The keydown event.
     */
    handleKeyDown(e) {
        const suggestions = this.suggestionsContainer.querySelectorAll("li");
        const inputValue = this.tokenInput.value.trim();
        const startsWithNumber = /^\d/.test(inputValue); // Check if input starts with a digit

        // Handle number key shortcuts (1-9) if input does not start with a number and suggestions are available
        if (/[1-9]/.test(e.key) && !startsWithNumber && suggestions.length > 0) {
            const index = parseInt(e.key) - 1;
            if (index < suggestions.length) {
                const selectedSuggestion = suggestions[index];
                const value = selectedSuggestion.dataset.value;
                if (selectedSuggestion.hasAttribute('data-shortcut') && selectedSuggestion.dataset.shortcut === "member") {
                    this.setTokens(["Member Action", value]);
                } else {
                    this.addToken(value);
                }
                e.preventDefault();
                return; // Exit after handling the number key
            }
        }

        if (e.key === "Enter") {
            this.enterHandled = true; // Indicate that Enter has been handled
            if (this.isEditing) {
                const { key, id } = this.editingEntry;
                this.historyManager.updateEntry(key, id, this.tokens);
                this.setTokens([]); // Clear tokens after updating an edited entry
                this.cancelEdit();
            } else {
                const inputText = this.tokenInput.value.trim();
                let parsedTokens = [];
                if (inputText) {
                    parsedTokens = this.parseTextToTokens(inputText);
                }
                if (parsedTokens.length > 0) {
                    this.setTokens(parsedTokens);
                    this.tokenInput.value = '';
                } else if (inputText) {
                    // Store raw input in history
                    const bill = document.getElementById('bill').value.trim() || "Unnamed Bill";
                    const billType = document.getElementById('bill-type').value;
                    const time = this.markedTime || this.startTime || new Date().toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });
                    this.historyManager.addRawEntry(inputText, bill, billType, time);
                    this.tokenInput.value = '';
                } else if (this.tokens.length > 0) {
                    const bill = document.getElementById('bill').value.trim() || "Unnamed Bill";
                    const billType = document.getElementById('bill-type').value;
                    const time = this.markedTime || this.startTime || new Date().toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                    });
                    this.historyManager.addEntry(this.tokens, bill, billType, time);
                    this.setTokens([]); // Clear tokens after adding to history
                    this.suggestionsContainer.innerHTML = ""; // Clear suggestions
                    this.markedTime = null;
                    this.startTime = null;
                    document.body.classList.remove('marking-time');
                }
            }
            e.preventDefault();
        } else if (e.key === "Escape" && this.isEditing) {
            this.cancelEdit();
            e.preventDefault();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (suggestions.length > 0) {
                this.highlightedIndex = Math.min(this.highlightedIndex + 1, suggestions.length - 1);
                this.updateHighlighted();
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (suggestions.length > 0) {
                this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
                this.updateHighlighted();
            }
        } else if (e.key === "Tab") {
            if (suggestions.length > 0) {
                e.preventDefault();
                const selectedSuggestion = suggestions[this.highlightedIndex];
                if (selectedSuggestion) {
                    const value = selectedSuggestion.dataset.value;
                    if (selectedSuggestion.hasAttribute('data-shortcut') && selectedSuggestion.dataset.shortcut === "member") {
                        this.setTokens(["Member Action", value]);
                    } else {
                        this.addToken(value);
                    }
                }
            }
        } else if (e.key === "Backspace" && this.tokenInput.value === "") {
            const tokenElements = Array.from(this.tokenContainer.querySelectorAll(".token"));
            if (tokenElements.length > 0) {
                // Check if the last two tokens form a testimony pair:
                if (this.tokens.length >= 2 && this.tokens[this.tokens.length - 2] === "Testimony") {
                    // Remove both the "Testimony" token and its associated JSON token
                    tokenElements[tokenElements.length - 1].remove();
                    tokenElements[tokenElements.length - 2].remove();
                    this.tokens.pop();
                    this.tokens.pop();
                    // Set suppression flag so the Testimony modal does not pop up
                    this.suppressTestimonyModule = true;
                } else {
                    const lastTokenEl = tokenElements[tokenElements.length - 1];
                    const lastTokenValue = lastTokenEl.dataset.value;
                    if (lastTokenValue === "Testimony") {
                        this.suppressTestimonyModule = true;
                    }
                    lastTokenEl.remove();
                    this.tokens.pop();
                }
                console.log('After Backspace - Tokens:', this.tokens);
                this.suppressSuggestions = true; // Suppress suggestions for class modules like LC_Module
                this.updateSuggestions();
                this.updateConstructedText();
            }
            e.preventDefault();
        }
    }

    parseTextToTokens(text) {
        const words = text.toLowerCase().split(/\s+/);
        const members = this.committeeSelector.getSelectedCommitteeMembers().map(m => m.split(' - ')[0]);
        const memberNames = members.map(name => name.toLowerCase().split(' '));
        const actions = ['moved', 'seconded', 'withdrew', 'introduced', 'proposed'];
        let tokens = [];
        let i = 0;

        // Check for "Senator" or "Representative"
        if (words[i] === 'senator' || words[i] === 'representative') i++;

        // Find member name
        let memberName = '';
        let memberFound = false;
        for (; i < words.length; i++) {
            let potentialName = words.slice(0, i + 1).join(' ');
            for (const member of members) {
                if (member.toLowerCase().startsWith(potentialName)) {
                    memberName = member;
                    memberFound = true;
                    break;
                }
            }
            if (memberFound) break;
        }

        if (memberFound && i < words.length) {
            tokens.push("Member Action");
            tokens.push(memberName);
            i++;

            // Find action
            if (i < words.length && actions.includes(words[i])) {
                tokens.push(words[i].charAt(0).toUpperCase() + words[i].slice(1));
                i++;

                // Handle motion or subsequent tokens
                if (i < words.length) {
                    if (words[i] === 'do' && i + 1 < words.length) {
                        if (words[i + 1] === 'pass') {
                            tokens.push("Do Pass");
                            i += 2;
                        } else if (words[i + 1] === 'not' && i + 2 < words.length && words[i + 2] === 'pass') {
                            tokens.push("Do Not Pass");
                            i += 3;
                        }
                    }

                    // Check for "as amended"
                    if (i < words.length && words[i] === 'as' && i + 1 < words.length && words[i + 1] === 'amended') {
                        tokens.push("As Amended");
                        i += 2;
                    }

                    // Check for "and rereferred"
                    if (i < words.length && words[i] === 'and' && i + 1 < words.length && words[i + 1] === 'rereferred') {
                        tokens.push("and Rereferred");
                        i += 2;
                        if (i < words.length) {
                            const committeeWords = words.slice(i).join(' ');
                            const committees = Object.keys(this.committeeSelector.committeesData);
                            const matchedCommittee = committees.find(c => c.toLowerCase().includes(committeeWords));
                            if (matchedCommittee) tokens.push(matchedCommittee);
                        }
                    }
                }
            }
        }

        return tokens;
    }
    
    /**
     * Handle keyup events for token input, managing suggestion selection.
     * Skips token addition if Enter was already handled in handleKeyDown to prevent duplication.
     * @param {Event} e - The keyup event.
     */
    handleKeyUp(e) {
        if (e.key === "Enter") {
            if (this.enterHandled) {
                this.enterHandled = false; // Reset the flag
                return; // Skip token addition if handled in keydown
            }
            const suggestions = this.suggestionsContainer.querySelectorAll("li");
            if (suggestions.length > 0) {
                const selectedSuggestion = suggestions[this.highlightedIndex];
                const value = selectedSuggestion.dataset.value;
                if (selectedSuggestion.hasAttribute('data-shortcut') && selectedSuggestion.dataset.shortcut === "member") {
                    this.setTokens(["Member Action", value]);
                } else {
                    this.addToken(value);
                }
                e.preventDefault();
                return;
            }
        }
        this.updateSuggestions();
    }

    /**
     * Edit a token at the specified index, validate subsequent tokens appropriately, and update suggestions immediately.
     * Ensures class module tokens (e.g., committee names) are correctly validated and preserved by checking class options when static options are empty or absent.
     * @param {number} index - The index of the token to edit.
     * @param {string} newValue - The new value to set for the token.
     */
    editToken(index, newValue) {
        console.log('editToken called - Index:', index, 'New value:', newValue, 'Tokens before:', this.tokens);
        this.tokens[index] = newValue;

        // Special handling for editing member name in "Member Action" to preserve subsequent tokens
        if (!(this.tokens[0] === "Member Action" && index === 1)) {
            // Validate subsequent tokens for other cases
            let currentData = this.getCurrentBranchDataForTokens(this.tokens.slice(0, index + 1));
            const subsequentTokens = this.tokens.slice(index + 1);
            let tempTokens = this.tokens.slice(0, index + 1);
            console.log('Starting validation - currentData:', currentData, 'subsequentTokens:', subsequentTokens);

            for (let i = 0; i < subsequentTokens.length; i++) {
                console.log('Validating token:', subsequentTokens[i], 'at position', i);
                console.log('Current currentData:', currentData);
                if (currentData.Options && currentData.Options.length > 0) {
                    console.log('Checking static Options:', currentData.Options);
                    if (currentData.Options.includes(subsequentTokens[i])) {
                        tempTokens.push(subsequentTokens[i]);
                        currentData = currentData[subsequentTokens[i]] || {};
                        console.log('Token included from static Options, new currentData:', currentData);
                    } else {
                        console.log('Token not in static Options, breaking');
                        break;
                    }
                } else if (currentData.Class && this.classRegistry[currentData.Class]) {
                    const context = {
                        members: this.committeeSelector.getSelectedCommitteeMembers(),
                        allCommittees: Object.keys(this.committeeSelector.committeesData),
                        selectedCommittee: this.committeeSelector.getSelectedCommittee()
                    };
                    console.log('No valid static Options, checking class module. Context:', context);
                    const classOptions = this.classRegistry[currentData.Class].getOptions ? 
                        this.classRegistry[currentData.Class].getOptions("", context) : [];
                    console.log('Class module options retrieved:', classOptions);
                    if (classOptions.includes(subsequentTokens[i])) {
                        tempTokens.push(subsequentTokens[i]);
                        currentData = {}; // Reset as class modules provide dynamic options with no further static structure
                        console.log('Class module token included:', subsequentTokens[i], 'New tempTokens:', tempTokens);
                    } else {
                        console.log('Token not in classOptions:', subsequentTokens[i], 'Breaking');
                        break;
                    }
                } else {
                    console.log('No valid Options or Class for token:', subsequentTokens[i], 'Breaking');
                    break;
                }
            }
            this.tokens = tempTokens;
        }
        console.log('Tokens after validation:', this.tokens);

        // Re-render tokens
        const tokenElements = this.tokenContainer.querySelectorAll('.token');
        tokenElements.forEach(el => el.remove());
        const inputWrapper = this.tokenContainer.querySelector('.input-wrapper');
        this.tokens.forEach(value => {
            const tokenSpan = this.createTokenElement(value);
            this.tokenContainer.insertBefore(tokenSpan, inputWrapper);
        });

        // Update suggestions immediately and focus input
        this.updateConstructedText();
        this.tokenInput.focus();
        this.updateSuggestions();
        console.log('Token elements after re-render:', this.tokenContainer.querySelectorAll('.token').length);
    }

    startEdit(key, id, tokens) {
        this.isEditing = true;
        this.editingEntry = {key, id};
        this.setTokens(tokens);
        this.historyManager.render();
    }

    /**
     * Cancel the current editing session, clear the editing state, and refresh the history display.
     * This method does not remove tokens if you are editing an existing entry.
     */
    cancelEdit() {
        this.isEditing = false;
        this.editingEntry = null;
        // Do not clear tokens when canceling an edit.
        this.suggestionsContainer.innerHTML = ""; // Clear suggestions to prevent immediate display
        this.historyManager.render();
    }

}
  