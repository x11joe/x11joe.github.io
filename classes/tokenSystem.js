// classes/tokenSystem.js
export class TokenSystem {
  /**
   * @param {HTMLElement} tokenContainer - The container for token elements.
   * @param {HTMLInputElement} tokenInput - The input element for token entry.
   * @param {HTMLElement} suggestionsContainer - The container for suggestions.
   * @param {Array} flowData - The full flow definition (an array of module objects).
   * @param {Object} classRegistry - Registry mapping class names to renderers.
   * @param {Object} defaultRenderer - The default renderer instance.
   */
  constructor(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer, committeeSelector) {
    this.tokenContainer = tokenContainer;
    this.tokenInput = tokenInput;
    this.suggestionsContainer = suggestionsContainer;
    this.flowData = flowData;
    this.classRegistry = classRegistry;
    this.defaultRenderer = defaultRenderer;
    this.committeeSelector = committeeSelector;
    this.tokens = [];
    this.highlightedIndex = -1;
    this.techTextField = document.getElementById("tech-text");
    this.procedureTextField = document.getElementById("procedure-text");
    this._bindEvents();
    this.tokenInput.addEventListener("focus", () => this.updateSuggestions());
    this.updateSuggestions();
  }
  
  _bindEvents() {
    // Bind key events on the token input.
    this.tokenInput.addEventListener("keydown", (e) => this.handleKeyDown(e));
    this.tokenInput.addEventListener("keyup", (e) => this.handleKeyUp(e));
    
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
          this.suggestionsContainer.innerHTML = "";
        }
      }
    });
  }

  isMemberName(token) {
    const currentMembers = this.committeeSelector.getSelectedCommitteeMembers();
    return currentMembers.some(member => {
        const name = member.split(" - ")[0];
        return name === token;
    });
  }

  getMemberTitle() {
    const selectedCommittee = this.committeeSelector.getSelectedCommittee();
    return selectedCommittee.toLowerCase().startsWith('senate') ? "Senator" : "Representative";
  }

  getLastName(fullName) {
    const nameParts = fullName.split(" ");
    return nameParts[nameParts.length - 1];
  }
  
  shortenCommitteeName(committee) {
    return committee.replace(/^(Senate|House)\s+/i, '').replace(/\s+Committee$/i, '');
  }
  
  /**
   * Get the current branch of the flow data based on the selected tokens.
   * If no token is selected, return an object whose Options property is an array
   * of all starting module names.
   * @returns {Object} The current branch data.
   */
  getCurrentBranchData() {
    if (this.tokens.length === 0) {
        const startingModules = this.flowData.map(moduleObj => Object.keys(moduleObj)[0]);
        return { Options: startingModules };
    }

    const moduleName = this.tokens[0];
    let currentData = null;
    for (let i = 0; i < this.flowData.length; i++) {
        if (this.flowData[i][moduleName]) {
            currentData = this.flowData[i][moduleName];
            break;
        }
    }
    if (!currentData) return {};

    if (this.tokens.length === 1) {
        return currentData;
    }

    // Determine if the second token is a member name
    const isSecondTokenMember = this.tokens.length >= 2 && this.isMemberName(this.tokens[1]);

    // If second token is a member name, start navigation from tokens[2]
    let navigationTokens = isSecondTokenMember ? this.tokens.slice(2) : this.tokens.slice(1);

    for (const token of navigationTokens) {
        if (currentData[token]) {
            currentData = currentData[token];
        } else {
            currentData = {};
            break;
        }
    }

    // Special case: if we have exactly two tokens and the second is a member name,
    // return the options under the module
    if (this.tokens.length === 2 && isSecondTokenMember) {
        const { Class, ...rest } = currentData;
        return rest;
    }

    return currentData;
  } 

  /**
   * Update the suggestions based on the current branch and input.
   */
  updateSuggestions() {
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
   * Add a token element for a confirmed choice.
   * @param {string} value - The selected option.
   */
  addToken(value) {
    const tokenSpan = document.createElement("span");
    tokenSpan.className = "token";
    tokenSpan.textContent = value;
    tokenSpan.dataset.value = value;
    tokenSpan.addEventListener("click", (e) => this.tokenClickHandler(e));
    this.tokenContainer.insertBefore(tokenSpan, this.tokenInput);
    this.tokens.push(value);
    this.tokenInput.value = "";
    this.updateSuggestions();
    this.updateConstructedText();
    this.tokenInput.focus();
  }

  /**
   * Method that clears existing tokens and sets new ones
   */
  setTokens(tokenArray) {
    // Clear existing tokens
    const tokenElements = this.tokenContainer.querySelectorAll('.token');
    tokenElements.forEach(el => el.remove());
    this.tokens = [];
  
    // Add new tokens
    tokenArray.forEach(value => {
      const tokenSpan = document.createElement('span');
      tokenSpan.className = 'token';
      tokenSpan.textContent = value;
      tokenSpan.dataset.value = value;
      tokenSpan.addEventListener('click', (e) => this.tokenClickHandler(e));
      this.tokenContainer.insertBefore(tokenSpan, this.tokenInput);
      this.tokens.push(value);
    });
  
    // Clear input and update suggestions
    this.tokenInput.value = '';
    this.updateSuggestions();
    this.updateConstructedText();
    this.tokenInput.focus();
  }
  
  updateConstructedText() {
    if (this.tokens.length < 4 || this.tokens[0] !== "Member Action" || !this.isMemberName(this.tokens[1])) {
      this.techTextField.value = "";
      this.procedureTextField.value = "";
      return;
    }
  
    const memberTitle = this.getMemberTitle();
    const lastName = this.getLastName(this.tokens[1]);
    const action = this.tokens[2].toLowerCase();
    const motion = this.tokens[3];
  
    let techText = `${memberTitle} ${lastName} ${action} ${motion}`;
    let procedureText = `${memberTitle} ${lastName} ${action} a ${motion.toLowerCase()}`;
  
    for (let i = 4; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      if (token === "As Amended") {
        techText += " as Amended";
        procedureText += " as amended";
      } else if (token === "and Rereferred" && i + 1 < this.tokens.length) {
        const committee = this.tokens[i + 1];
        const shortenedCommittee = this.shortenCommitteeName(committee);
        techText += ` and Rereferred to ${shortenedCommittee}`;
        procedureText += ` and rereferred to ${shortenedCommittee.toLowerCase()}`;
        i++; // Skip the next token since it's the committee
      }
    }
  
    this.techTextField.value = techText;
    this.procedureTextField.value = procedureText;
  }

  /**
   * Handle clicking on a token: remove it and any tokens after it, then load its value into the input.
   */
  tokenClickHandler(e) {
    const tokenElements = Array.from(this.tokenContainer.querySelectorAll(".token"));
    const index = tokenElements.indexOf(e.currentTarget);
    if (index === -1) return;
    for (let i = tokenElements.length - 1; i >= index; i--) {
      tokenElements[i].remove();
      this.tokens.pop();
    }
    this.tokenInput.value = e.currentTarget.dataset.value;
    this.updateSuggestions();
    this.updateConstructedText();
    this.tokenInput.focus();
  }
  
  handleKeyDown(e) {
    const suggestions = this.suggestionsContainer.querySelectorAll("li");
    if (e.key === "ArrowDown") {
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
        this.tokens.pop();
        this.updateSuggestions();
        this.updateConstructedText();
      }
      e.preventDefault();
    }
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
}
  