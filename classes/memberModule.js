// classes/memberModule.js
export class MemberModule {
  constructor() {}

  render(options, query, context = {}) {
    const filtered = options.filter(opt => opt.toLowerCase().includes(query.toLowerCase()));
    let html = "<ul>";
    filtered.forEach(option => {
      html += `<li data-value="${option}">${option}</li>`;
    });
    html += "</ul>";
    return html;
  }
}
  