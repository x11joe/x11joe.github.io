// classes/memberModule.js
export class MemberModule {
  constructor() {}

  /**
   * Get the list of member name options based on the query and context.
   * @param {string} query - The current user input for filtering (empty when editing to show all options).
   * @param {Object} context - Context object containing the members list.
   * @returns {Array<string>} The list of filtered member names.
   */
  getOptions(query, context = {}) {
    const members = context.members || [];
    return members.filter(member => member.toLowerCase().includes(query.toLowerCase())).map(member => member.split(" - ")[0]);
  }

  /**
   * Render suggestions by filtering the available member options based on the query.
   * @param {Array} options - List of possible options (ignored here as members come from context).
   * @param {string} query - The current user input.
   * @param {Object} context - Context object containing the members list.
   * @returns {string} - HTML string for the suggestion list.
   */
  render(options, query, context = {}) {
    const filtered = this.getOptions(query, context);
    let html = "<ul>";
    filtered.forEach(name => {
        html += `<li data-value="${name}">${name}</li>`;
    });
    html += "</ul>";
    return html;
  }
}
  