// classes/memberModule.js
export class MemberModule {
  constructor() {}

  render(options, query, context = {}) {
      const members = context.members || [];
      const filtered = members.filter(member => member.toLowerCase().includes(query.toLowerCase()));
      let html = "<ul>";
      filtered.forEach(member => {
          const name = member.includes(" - ") ? member.split(" - ")[0] : member;
          html += `<li data-value="${name}">${name}</li>`;
      });
      html += "</ul>";
      return html;
  }
}
  