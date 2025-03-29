// classes/defaultRenderer.js
export class DefaultRenderer {
    constructor() {}
  
    /**
     * Render suggestions by filtering the available options based on the query.
     * This implementation returns HTML for the suggestion list.
     * @param {Array} options - List of possible options.
     * @param {string} query - The current user input.
     * @param {Object} context - Optional context object.
     * @returns {string} - HTML string for the suggestion list.
     */
    render(options, query, context = {}) {
      let filtered;
      if (!query) {
        filtered = options;
      } else {
        filtered = options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
      }
      let html = "<ul>";
      filtered.forEach(option => {
        html += `<li data-value="${option}">${option}</li>`;
      });
      html += "</ul>";
      return html;
    }
  }
  