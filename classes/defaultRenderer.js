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
      if (Array.isArray(options) && options.length > 0 && typeof options[0] === 'object') {
          // Options are objects with value and optional shortcut
          filtered = options.filter(option => option.value.toLowerCase().includes(query.toLowerCase()));
      } else {
          // Options are strings
          filtered = options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
      }
      let html = "<ul>";
      filtered.forEach(option => {
          if (typeof option === 'string') {
              html += `<li data-value="${option}">${option}</li>`;
          } else {
              const shortcutAttr = option.shortcut ? ` data-shortcut="${option.shortcut}"` : '';
              html += `<li data-value="${option.value}"${shortcutAttr}>${option.value}</li>`;
          }
      });
      html += "</ul>";
      return html;
    }
  }
  