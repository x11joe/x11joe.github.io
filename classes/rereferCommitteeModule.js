// classes/rereferCommitteeModule.js
export class RereferCommitteeModule {
  constructor() {}

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