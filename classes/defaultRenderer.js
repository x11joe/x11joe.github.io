// A generic default renderer that provides suggestions from an options array.
// It filters the options based on the user's query.
class DefaultRenderer {
    constructor() {}
    
    /**
     * Render suggestions based on available options and current input.
     * @param {Array} options - List of possible options.
     * @param {string} query - The current user input.
     * @returns {Array} - Filtered list of suggestions.
     */
    render(options, query) {
      if (!query) {
        return options;
      }
      return options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
    }
  }
  
  // Expose the class globally.
  window.DefaultRenderer = DefaultRenderer;
  