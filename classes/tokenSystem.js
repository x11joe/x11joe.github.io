// classes/tokenSystem.js

export class TokenSystem {
    /**
     * @param {HTMLElement} tokenContainer - The container for token elements.
     * @param {HTMLInputElement} tokenInput - The input element for token entry.
     * @param {HTMLElement} suggestionsContainer - The container for suggestions.
     * @param {Object} flowData - The flow definition data.
     * @param {Object} classRegistry - Registry mapping class names to renderers.
     * @param {Object} defaultRenderer - The default renderer instance.
     */
    constructor(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer) {
      this.tokenContainer = tokenContainer;
      this.tokenInput = tokenInput;
      this.suggestionsContainer = suggestionsContainer;
      this.flowData = flowData;
      this.classRegistry = classRegistry;
      this.defaultRenderer = defaultRenderer;
      this.tokens = [];
      this._bindEvents();
      this.updateSuggestions();
    }
    
    _bindEvents() {
      // Bind key events on the token input.
      this.tokenInput.addEventListener("keydown", (e) => this.handleKeyDown(e));
      this.tokenInput.addEventListener("keyup", (e) => this.handleKeyUp(e));
      
      // Bind click event for suggestions.
      this.suggestionsContainer.addEventListener("click", (e) => {
        if (e.target && e.target.nodeName === "LI") {
          this.addToken(e.target.dataset.value);
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
    
    /**
     * Traverse the flowData based on the current tokens.
     * @returns {Object} The current branch of the flow data.
     */
    getCurrentBranchData() {
      if (!this.flowData) return {};
      let currentData = this.flowData;
      this.tokens.forEach(token => {
        if (currentData[token]) {
          currentData = currentData[token];
        } else {
          currentData = {};
        }
      });
      return currentData;
    }
    
    /**
     * Update the suggestions container based on the current branch and input.
     */
    updateSuggestions() {
      const query = this.tokenInput.value.trim();
      const branchData = this.getCurrentBranchData();
      const options = branchData["Options"] || [];
      let renderer;
      if (branchData["Class"]) {
        renderer = this.classRegistry[branchData["Class"]] || this.defaultRenderer;
      } else {
        renderer = this.defaultRenderer;
      }
      const html = renderer.render(options, query);
      this.suggestionsContainer.innerHTML = html;
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
      this.tokenInput.focus();
    }
    
    /**
     * Handle clicking on a token: remove it and tokens after it, then load its value into the input.
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
      this.tokenInput.focus();
    }
    
    handleKeyDown(e) {
      if (e.key === "Backspace" && this.tokenInput.value === "") {
        const tokenElements = Array.from(this.tokenContainer.querySelectorAll(".token"));
        if (tokenElements.length > 0) {
          const lastTokenEl = tokenElements[tokenElements.length - 1];
          lastTokenEl.remove();
          this.tokens.pop();
          this.updateSuggestions();
        }
        e.preventDefault();
      }
    }
    
    handleKeyUp(e) {
      if (e.key === "Enter") {
        const firstSuggestion = this.suggestionsContainer.querySelector("li");
        if (firstSuggestion) {
          this.addToken(firstSuggestion.dataset.value);
        }
        e.preventDefault();
        return;
      }
      this.updateSuggestions();
    }
  }
  