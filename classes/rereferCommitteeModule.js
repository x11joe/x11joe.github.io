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
    render(options, query, context = {}) {
        const allCommittees = context.allCommittees || [];
        const selectedCommittee = context.selectedCommittee || '';

        // Determine the type of the selected committee
        const isSenate = selectedCommittee.toLowerCase().startsWith('senate');
        const committeeType = isSenate ? 'Senate' : 'House';

        // Filter committees of the same type
        const filteredCommittees = allCommittees.filter(committee =>
            committee.toLowerCase().startsWith(committeeType.toLowerCase())
        );

        // Further filter based on the query
        const suggestions = filteredCommittees.filter(committee =>
            committee.toLowerCase().includes(query.toLowerCase())
        );

        // Render the suggestions as an HTML list
        let html = "<ul>";
        suggestions.forEach(committee => {
            html += `<li data-value="${committee}">${committee}</li>`;
        });
        html += "</ul>";
        return html;
    }
}