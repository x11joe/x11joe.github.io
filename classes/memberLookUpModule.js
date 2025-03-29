// classes/memberLookUpModule.js
export class MemberLookUpModule {
    constructor() {}
  
    render(options, query, context = {}) {
      const members = context.members || [];
      const filtered = members.filter(member => member.toLowerCase().includes(query.toLowerCase()));
      let html = "<ul>";
      filtered.forEach(member => {
        html += `<li data-value="${member}">${member}</li>`;
      });
      html += "</ul>";
      return html;
    }
}