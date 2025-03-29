// classes/shortcutLegend.js
export class ShortcutLegend {
    /**
     * @param {HTMLElement} containerElement - The container for the shortcut legend.
     * @param {TokenSystem} tokenSystem - The TokenSystem instance to manipulate tokens.
     * @param {Object} shortcuts - Mapping of categories to options and their token sequences.
     */
    constructor(containerElement, tokenSystem, shortcuts) {
      this.containerElement = containerElement;
      this.tokenSystem = tokenSystem;
      this.shortcuts = shortcuts;
      this.render();
      this.addEventListeners();
    }
  
    render() {
      let html = '';
      for (const category in this.shortcuts) {
        html += `<h3>${category}</h3>`;
        html += '<ul>';
        for (const option in this.shortcuts[category]) {
          // Store token sequence as a data attribute
          html += `<li data-tokens='${JSON.stringify(this.shortcuts[category][option])}'>${option}</li>`;
        }
        html += '</ul>';
      }
      this.containerElement.innerHTML = html;
    }
  
    addEventListeners() {
      const items = this.containerElement.querySelectorAll('li');
      items.forEach(item => {
        item.addEventListener('click', (e) => {
          const tokens = JSON.parse(e.target.dataset.tokens);
          this.tokenSystem.setTokens(tokens);
        });
      });
    }
}