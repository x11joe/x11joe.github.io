// classes/committeeSelector.js
export class CommitteeSelector {
    /**
     * @param {HTMLSelectElement} dropdownElement - The <select> element for committee selection.
     * @param {HTMLElement} legendElement - The container element for the committee legend.
     * @param {Object} committeesData - An object mapping committee names to an array of member strings.
     */
    constructor(dropdownElement, legendElement, committeesData) {
      this.dropdownElement = dropdownElement;
      this.legendElement = legendElement;
      this.committeesData = committeesData;
      this.localStorageKey = "selectedCommittee";
      this.init();
    }
    
    init() {
      // Get the committee names from the data.
      this.committeeNames = Object.keys(this.committeesData);
      // Read saved selection from localStorage.
      const savedCommittee = localStorage.getItem(this.localStorageKey);
      if (savedCommittee && this.committeeNames.includes(savedCommittee)) {
        this.selectedCommittee = savedCommittee;
      } else {
        this.selectedCommittee = this.committeeNames[0];
      }
      this.renderDropdown();
      this.renderLegend();
      // Listen for changes in the dropdown.
      this.dropdownElement.addEventListener("change", (e) => {
        this.selectedCommittee = e.target.value;
        localStorage.setItem(this.localStorageKey, this.selectedCommittee);
        this.renderDropdown();
        this.renderLegend();
      });
    }
    
    renderDropdown() {
      // Reorder committees so that the selected one appears first.
      const committees = [...this.committeeNames].sort((a, b) => {
        if (a === this.selectedCommittee) return -1;
        if (b === this.selectedCommittee) return 1;
        return a.localeCompare(b);
      });
      let html = "";
      committees.forEach(committee => {
        html += `<option value="${committee}" ${committee === this.selectedCommittee ? "selected" : ""}>${committee}</option>`;
      });
      this.dropdownElement.innerHTML = html;
    }
    
    renderLegend() {
      // Get members for the selected committee.
      const members = this.committeesData[this.selectedCommittee] || [];
      let html = "<ul>";
      members.forEach(member => {
        // (For now, we're not modifying titles based on FEMALE_NAMES; we can add that later.)
        html += `<li>${member}</li>`;
      });
      html += "</ul>";
      this.legendElement.innerHTML = html;
    }
    
    getSelectedCommittee() {
      return this.selectedCommittee;
    }
  }
  