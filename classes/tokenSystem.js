// classes/tokenSystem.js
import { TextConstructor } from './textConstructor.js';
export class TokenSystem {

  /**
   * Initialize the TokenSystem with necessary elements and configurations.
   * @param {HTMLElement} tokenContainer - The container for token elements.
   * @param {HTMLInputElement} tokenInput - The input element for token entry.
   * @param {HTMLElement} suggestionsContainer - The container for suggestions.
   * @param {Array} flowData - The full flow definition (an array of module objects).
   * @param {Object} classRegistry - Registry mapping class names to renderers.
   * @param {Object} defaultRenderer - The default renderer instance.
   * @param {Object} committeeSelector - The CommitteeSelector instance for managing committee members.
   * @param {Object} historyManager - History manager instance for managing history of token selections.
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
    this.highlightedIndex = -1;
    this.techTextField = document.getElementById("tech-text");
    this.procedureTextField = document.getElementById("procedure-text");
    this.isEditing = false;
    this.editingEntry = null;
    this.startTime = null;
    this.markedTime = null;
    this._bindEvents();
    // Bind focus event to show suggestions only when input is clicked
    this.tokenInput.addEventListener("focus", () => this.updateSuggestions());
    // Removed initial updateSuggestions() call to prevent suggestions on start
  }
  
  /**
   * Bind event listeners to the token input and suggestions container.
   */
  _bindEvents() {
    // Bind key events on the token input.
    this.tokenInput.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.tokenInput.addEventListener("keyup", (e) => this.handleKeyUp(e));
    
    // Bind focus event to show suggestions only when input is explicitly focused by user
    this.tokenInput.addEventListener("focus", () => {
      console.log('Input focused - updating suggestions');
      this.updateSuggestions();
    });
    
    // Bind click event for suggestions.
    this.suggestionsContainer.addEventListener("click", (e) => {
      if (e.target && e.target.nodeName === "LI") {
        const value = e.target.dataset.value;
        if (e.target.hasAttribute('data-shortcut') && e.target.dataset.shortcut === "member") {
          this.setTokens(["Member Action", value]);
        } else {
          this.addToken(value);
        }
      }
    });
    
    // Hide suggestions when clicking outside (if the input isn't focused).
    document.addEventListener("click", (e) => {
      if (!this.suggestionsContainer.contains(e.target) && e.target !== this.tokenInput) {
        if (document.activeElement !== this.tokenInput) {
          console.log('Clicked outside - hiding suggestions');
          this.suggestionsContainer.innerHTML = "";
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
   * Update the suggestions based on the current branch and input, relying on CSS for positioning.
   */
  updateSuggestions() {
    console.log('updateSuggestions called - Tokens:', this.tokens, 'Input value:', this.tokenInput.value);
    const query = this.tokenInput.value.trim();
    const branchData = this.getCurrentBranchData();
    let options = branchData["Options"] || [];
    if (this.tokens.length === 0) {
      const startingModules = options.map(module => ({ value: module }));
      const memberNames = this.committeeSelector.getSelectedCommitteeMembers().map(member => {
        const name = member.split(" - ")[0];
        return { value: name, shortcut: "member" };
      });
      options = startingModules.concat(memberNames);
    }
    let renderer;
    if (branchData["Class"]) {
      renderer = this.classRegistry[branchData["Class"]] || this.defaultRenderer;
    } else {
      renderer = this.defaultRenderer;
    }
    const currentMembers = this.committeeSelector.getSelectedCommitteeMembers();
    const allCommittees = Object.keys(this.committeeSelector.committeesData);
    const selectedCommittee = this.committeeSelector.getSelectedCommittee();
    const context = {
      members: currentMembers,
      allCommittees: allCommittees,
      selectedCommittee: selectedCommittee
    };
    const html = renderer.render(options, query, context);
    this.suggestionsContainer.innerHTML = html;

    // Highlight the appropriate suggestion
    const suggestions = this.suggestionsContainer.querySelectorAll("li");
    if (suggestions.length > 0) {
      if (this.highlightedIndex < 0 || this.highlightedIndex >= suggestions.length) {
        this.highlightedIndex = 0;
      }
      this.updateHighlighted();
    } else {
      this.highlightedIndex = -1;
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
   * Add a token element to the container with a dropdown for editing.
   * @param {string} value - The selected option to add as a token.
   */
  addToken(value) {
    if (!this.isEditing && this.tokens.length === 0) {
        this.startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    }
    const tokenSpan = document.createElement("span");
    tokenSpan.className = "token";
    tokenSpan.innerHTML = `${value} <span class="dropdown-arrow">▾</span>`;
    tokenSpan.dataset.value = value;
    tokenSpan.addEventListener("click", (e) => this.tokenClickHandler(e));
    
    const inputWrapper = this.tokenContainer.querySelector('.input-wrapper');
    this.tokenContainer.insertBefore(tokenSpan, inputWrapper);
    
    this.tokens.push(value);
    this.tokenInput.value = "";
    this.updateSuggestions();
    this.updateConstructedText();
    this.tokenInput.focus();
  }

  /**
   * Clear existing tokens and set new ones from an array, ensuring dropdowns for editing.
   * @param {Array<string>} tokenArray - Array of token values to set.
   */
  setTokens(tokenArray) {
    console.log('setTokens called - New tokens:', tokenArray);
    const tokenElements = this.tokenContainer.querySelectorAll('.token');
    tokenElements.forEach(el => el.remove());
    this.tokens = [];

    const inputWrapper = this.tokenContainer.querySelector('.input-wrapper');

    tokenArray.forEach(value => {
      const tokenSpan = document.createElement('span');
      tokenSpan.className = 'token';
      tokenSpan.innerHTML = `${value} <span class="dropdown-arrow">▾</span>`;
      tokenSpan.dataset.value = value;
      tokenSpan.addEventListener('click', (e) => this.tokenClickHandler(e));
      this.tokenContainer.insertBefore(tokenSpan, inputWrapper);
      this.tokens.push(value);
    });

    if (!this.isEditing && this.tokens.length > 0) {
      this.startTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    }

    this.tokenInput.value = '';
    this.updateSuggestions();
    this.updateConstructedText();
    this.tokenInput.focus();
  }

  showTokenOptions(index, tokenElement) {
    const existingDropdown = document.querySelector('.token-dropdown');
    if (existingDropdown) existingDropdown.remove();

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

  markTime() {
    this.markedTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
    document.body.classList.add('marking-time');
  }
  
  updateConstructedText() {
    const techText = TextConstructor.getTechText(this.tokens, this.committeeSelector);
    const procedureText = TextConstructor.getProcedureText(this.tokens, this.committeeSelector);
    this.techTextField.value = techText;
    this.procedureTextField.value = procedureText;
  }

  /**
   * Handle clicks on tokens, triggering edit options only when the dropdown arrow is clicked.
   * @param {Event} e - The click event.
   */
  tokenClickHandler(e) {
    if (e.target.className === 'dropdown-arrow') {
        const tokenSpan = e.target.parentElement;
        const tokenElements = Array.from(this.tokenContainer.querySelectorAll(".token"));
        const index = tokenElements.indexOf(tokenSpan);
        if (index !== -1) {
            this.showTokenOptions(index, tokenSpan);
        }
    }
    // Clicking the token body does nothing, preventing deletion
  }
  
  /**
   * Handle keydown events for token input, managing token addition, deletion, and history storage.
   * @param {Event} e - The keydown event.
   */
  handleKeyDown(e) {
    const suggestions = this.suggestionsContainer.querySelectorAll("li");
    if (e.key === "Enter") {
      if (this.isEditing) {
        const {key, id} = this.editingEntry;
        this.historyManager.updateEntry(key, id, this.tokens);
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
          const time = this.markedTime || this.startTime || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
          this.historyManager.addRawEntry(inputText, bill, billType, time);
          this.tokenInput.value = '';
        } else if (this.tokens.length > 0) {
          const bill = document.getElementById('bill').value.trim() || "Unnamed Bill";
          const billType = document.getElementById('bill-type').value;
          const time = this.markedTime || this.startTime || new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
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
        const value = selectedSuggestion.dataset.value;
        if (selectedSuggestion.hasAttribute('data-shortcut') && selectedSuggestion.dataset.shortcut === "member") {
          this.setTokens(["Member Action", value]);
        } else {
          this.addToken(value);
        }
      }
    } else if (e.key === "Backspace" && this.tokenInput.value === "") {
      const tokenElements = Array.from(this.tokenContainer.querySelectorAll(".token"));
      if (tokenElements.length > 0) {
        const lastTokenEl = tokenElements[tokenElements.length - 1];
        lastTokenEl.remove();
        this.tokens.pop(); // Ensure this.tokens is updated
        console.log('After Backspace - Tokens:', this.tokens);
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
    
  handleKeyUp(e) {
    if (e.key === "Enter") {
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
   * Edit a token at the specified index and update subsequent tokens and suggestions.
   * @param {number} index - The index of the token to edit.
   * @param {string} newValue - The new value to set for the token.
   */
  editToken(index, newValue) {
    console.log('editToken called - Index:', index, 'New value:', newValue, 'Tokens before:', this.tokens);
    const oldValue = this.tokens[index];
    this.tokens[index] = newValue;

    // Check if subsequent tokens are still valid
    let currentData = this.getCurrentBranchDataForTokens(this.tokens.slice(0, index + 1));
    const subsequentTokens = this.tokens.slice(index + 1);
    let valid = true;
    let tempTokens = this.tokens.slice(0, index + 1);

    for (let i = 0; i < subsequentTokens.length && valid; i++) {
      if (currentData.Options && currentData.Options.includes(subsequentTokens[i])) {
        tempTokens.push(subsequentTokens[i]);
        currentData = currentData[subsequentTokens[i]] || {};
      } else {
        valid = false;
      }
    }

    if (!valid) {
      this.tokens = tempTokens;
    }

    console.log('Tokens after validation:', this.tokens);

    // Re-render tokens
    const tokenElements = this.tokenContainer.querySelectorAll('.token');
    tokenElements.forEach(el => el.remove());
    this.tokens.forEach(value => this.addToken(value));

    console.log('Token elements after re-render:', this.tokenContainer.querySelectorAll('.token').length);

    // Show suggestions if further options exist, otherwise clear them
    const branchData = this.getCurrentBranchData();
    if (branchData["Options"] && branchData["Options"].length > 0) {
      this.updateSuggestions();
    } else {
      this.suggestionsContainer.innerHTML = "";
    }
    this.updateConstructedText();
  }

  startEdit(key, id, tokens) {
    this.isEditing = true;
    this.editingEntry = {key, id};
    this.setTokens(tokens);
    this.historyManager.render();
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingEntry = null;
    this.setTokens([]);
    this.historyManager.render();
  }
}
  