// classes/committeeSelector.js
export class CommitteeSelector {
    /**
     * @param {HTMLElement} containerElement - The container element that will hold the custom dropdown.
     * @param {HTMLElement} legendElement - The container element for the committee legend.
     * @param {Object} committeesData - An object mapping committee names to arrays of member strings.
     */
    constructor(containerElement, legendElement, committeesData) {
      this.containerElement = containerElement;
      this.legendElement = legendElement;
      this.committeesData = committeesData;
      this.selectedCommitteeKey = "selectedCommittee";
      this.favoritesKey = "favoriteCommittees";
      this.init();
    }
    
    init() {
      this.committeeNames = Object.keys(this.committeesData);
      // Get saved selected committee
      const savedCommittee = localStorage.getItem(this.selectedCommitteeKey);
      if (savedCommittee && this.committeeNames.includes(savedCommittee)) {
        this.selectedCommittee = savedCommittee;
      } else {
        this.selectedCommittee = this.committeeNames[0];
      }
      // Get favorites from localStorage (as an array)
      const favStr = localStorage.getItem(this.favoritesKey);
      if (favStr) {
        try {
          this.favoriteCommittees = JSON.parse(favStr);
        } catch(e) {
          this.favoriteCommittees = [];
        }
      } else {
        this.favoriteCommittees = [];
      }
      this.renderDropdown();
      this.renderLegend();
    }
    
    renderDropdown() {
      // Separate favorites and non-favorites.
      const favorites = this.committeeNames.filter(name => this.favoriteCommittees.includes(name));
      const nonFavorites = this.committeeNames.filter(name => !this.favoriteCommittees.includes(name));
      // Sort each group alphabetically.
      favorites.sort();
      nonFavorites.sort();
      const sorted = favorites.concat(nonFavorites);
      
      // Build custom dropdown HTML.
      // We'll build a div with a "selected" header and a hidden list.
      let html = `<div class="dropdown-selected">${this.selectedCommittee} &#9662;</div>`;
      html += `<div class="dropdown-list" style="display:none;">`;
      sorted.forEach(committee => {
        html += `<div class="dropdown-item" data-committee="${committee}">`;
        html += `<input type="checkbox" class="fav-checkbox" data-committee="${committee}" ${this.favoriteCommittees.includes(committee) ? "checked" : ""}>`;
        html += `<span>${committee}</span>`;
        html += `</div>`;
      });
      html += `</div>`;
      this.containerElement.innerHTML = html;
      
      const selectedDiv = this.containerElement.querySelector(".dropdown-selected");
      const listDiv = this.containerElement.querySelector(".dropdown-list");
      
      selectedDiv.addEventListener("click", () => {
        listDiv.style.display = listDiv.style.display === "none" ? "block" : "none";
      });
      
      // Add click event for each dropdown item.
      const items = this.containerElement.querySelectorAll(".dropdown-item");
      items.forEach(item => {
        item.addEventListener("click", (e) => {
          // If click is on checkbox, don't change the selected committee.
          if(e.target.classList.contains("fav-checkbox")) return;
          const committee = item.getAttribute("data-committee");
          this.selectedCommittee = committee;
          localStorage.setItem(this.selectedCommitteeKey, committee);
          listDiv.style.display = "none";
          this.renderDropdown();
          this.renderLegend();
        });
      });
      
      // Add event for checkboxes.
      const checkboxes = this.containerElement.querySelectorAll(".fav-checkbox");
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation();
          const committee = checkbox.getAttribute("data-committee");
          if(checkbox.checked) {
            if(!this.favoriteCommittees.includes(committee)) {
              this.favoriteCommittees.push(committee);
            }
          } else {
            this.favoriteCommittees = this.favoriteCommittees.filter(name => name !== committee);
          }
          localStorage.setItem(this.favoritesKey, JSON.stringify(this.favoriteCommittees));
          this.renderDropdown();
        });
      });
      
      // Hide dropdown when clicking outside.
      document.addEventListener("click", (e) => {
        if(!this.containerElement.contains(e.target)) {
           listDiv.style.display = "none";
        }
      });
    }
    
    renderLegend() {
      // Render the committee members in a fixed legend.
      const members = this.committeesData[this.selectedCommittee] || [];
      let html = "<ul>";
      members.forEach(member => {
        // Later we can check FEMALE_NAMES to change titles.
        html += `<li>${member}</li>`;
      });
      html += "</ul>";
      this.legendElement.innerHTML = html;
    }
    
    getSelectedCommittee() {
      return this.selectedCommittee;
    }
  }
  