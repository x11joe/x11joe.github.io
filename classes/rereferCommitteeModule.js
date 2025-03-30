// classes/rereferCommitteeModule.js
export class RereferCommitteeModule {
  constructor() {}

  /**
     * Get the list of committee options based on the query and context, filtered by chamber type.
     * @param {string} query - The current user input for filtering (empty when editing to show all options).
     * @param {Object} context - Context object containing all committees and selected committee.
     * @returns {Array<string>} The list of filtered committee names.
     */
    getOptions(query, context = {}) {
        const allCommittees = context.allCommittees || [];
        const selectedCommittee = context.selectedCommittee || '';
        const isSenate = selectedCommittee.toLowerCase().startsWith('senate');
        const committeeType = isSenate ? 'Senate' : 'House';
        const filteredCommittees = allCommittees.filter(committee =>
            committee.toLowerCase().startsWith(committeeType.toLowerCase())
        );
        return filteredCommittees.filter(committee =>
            committee.toLowerCase().includes(query.toLowerCase())
        );
    }

    /**
     * Render suggestions by filtering the available committee options based on the query.
     * Adds numbers (1-9) before the first 9 suggestions for shortcut reminders.
     * @param {Array} options - List of possible options (ignored here as committees come from context).
     * @param {string} query - The current user input.
     * @param {Object} context - Context object containing all committees and selected committee.
     * @returns {string} - HTML string for the suggestion list.
     */
    render(options, query, context = {}) {
        const suggestions = this.getOptions(query, context);
        let html = "<ul>";
        suggestions.forEach((committee, index) => {
            const displayText = index < 9 ? `${index + 1}. ${committee}` : committee;
            html += `<li data-value="${committee}">${displayText}</li>`;
        });
        html += "</ul>";
        return html;
    }
}