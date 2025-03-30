// classes/defaultRenderer.js
export class DefaultRenderer {
    constructor() {}
  
    /**
     * Render suggestions by filtering the available options based on the query.
     * Adds numbers (1-9) before the first 9 suggestions for shortcut reminders.
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
        filtered.forEach((option, index) => {
            const displayText = index < 9 ? `${index + 1}. ${typeof option === 'string' ? option : option.value}` : (typeof option === 'string' ? option : option.value);
            if (typeof option === 'string') {
                html += `<li data-value="${option}">${displayText}</li>`;
            } else {
                const shortcutAttr = option.shortcut ? ` data-shortcut="${option.shortcut}"` : '';
                html += `<li data-value="${option.value}"${shortcutAttr}>${displayText}</li>`;
            }
        });
        html += "</ul>";
        return html;
    }
  }
  