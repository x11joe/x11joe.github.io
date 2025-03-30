// classes/memberLookUpModule.js
export class MemberLookUpModule {
    constructor() {}
  
    /**
   * Render suggestions by filtering the available member options based on the query.
   * Adds numbers (1-9) before the first 9 suggestions for shortcut reminders.
   * @param {Array} options - List of possible options (ignored here as members come from context).
   * @param {string} query - The current user input.
   * @param {Object} context - Context object containing the members list.
   * @returns {string} - HTML string for the suggestion list.
   */
  render(options, query, context = {}) {
    const members = context.members || [];
    const filtered = members.filter(member => member.toLowerCase().includes(query.toLowerCase()));
    let html = "<ul>";
    filtered.forEach((member, index) => {
        const displayText = index < 9 ? `${index + 1}. ${member}` : member;
        html += `<li data-value="${member}">${displayText}</li>`;
    });
    html += "</ul>";
    return html;
  }
}