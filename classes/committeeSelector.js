// classes/committeeSelector.js
export class CommitteeSelector {
    /**
     * @param {HTMLElement} containerElement - The container element where the custom dropdown will be rendered.
     * @param {HTMLElement} legendElement - The container element for the fixed committee legend.
     * @param {Object} committeesData - An object mapping committee names to arrays of member strings.
     */
    constructor(containerElement, legendElement, committeesData) {
      this.containerElement = containerElement;
      this.legendElement = legendElement;
      this.committeesData = committeesData;
      this.selectedCommitteeKey = "selectedCommittee";
      this.favoritesKey = "favoriteCommittees";
      this.isDropdownOpen = false; // Track dropdown visibility
      console.log("CommitteeSelector constructor called");
      this.init();
    }
    
    init() {
      this.committeeNames = Object.keys(this.committeesData);
      console.log("Available committees:", this.committeeNames);
      const savedCommittee = localStorage.getItem(this.selectedCommitteeKey);
      if (savedCommittee && this.committeeNames.includes(savedCommittee)) {
        this.selectedCommittee = savedCommittee;
        console.log("Loaded saved selected committee:", savedCommittee);
      } else {
        this.selectedCommittee = this.committeeNames[0];
        console.log("Default selected committee set to:", this.selectedCommittee);
      }
      const favStr = localStorage.getItem(this.favoritesKey);
      this.favoriteCommittees = favStr ? JSON.parse(favStr) || [] : [];
      console.log("Favorite committees:", this.favoriteCommittees);
      this.renderDropdown();
      this.renderLegend();
    }
    
    renderDropdown() {
      // Separate favorites and non-favorites.
      const favorites = this.committeeNames.filter(name => this.favoriteCommittees.includes(name));
      const nonFavorites = this.committeeNames.filter(name => !this.favoriteCommittees.includes(name));
      favorites.sort();
      nonFavorites.sort();
      const sorted = favorites.concat(nonFavorites);
      console.log("Sorted committee list:", sorted);
      
      // Build custom dropdown HTML.
      let html = `<div class="dropdown-selected">${this.selectedCommittee} ▾</div>`;
      html += `<div class="dropdown-list" style="display:${this.isDropdownOpen ? 'block' : 'none'};">`;
      sorted.forEach(committee => {
        html += `<div class="dropdown-item" data-committee="${committee}">`;
        // Checkbox is now rendered first.
        html += `<input type="checkbox" class="fav-checkbox" data-committee="${committee}" ${this.favoriteCommittees.includes(committee) ? "checked" : ""}>`;
        html += `<span class="committee-name">${committee}</span>`;
        html += `</div>`;
      });
      html += `</div>`;
      this.containerElement.innerHTML = html;
      
      const selectedDiv = this.containerElement.querySelector(".dropdown-selected");
      const listDiv = this.containerElement.querySelector(".dropdown-list");
      
      selectedDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        this.isDropdownOpen = !this.isDropdownOpen;
        listDiv.style.display = this.isDropdownOpen ? "block" : "none";
        console.log("Dropdown selected clicked. isDropdownOpen:", this.isDropdownOpen);
      });
      
      // Attach click event ONLY to the committee name spans.
      const nameSpans = this.containerElement.querySelectorAll(".committee-name");
      nameSpans.forEach(span => {
        span.addEventListener("click", (e) => {
          e.stopPropagation();
          const committee = span.textContent;
          console.log("Committee name clicked. Setting selected committee to:", committee);
          this.selectedCommittee = committee;
          localStorage.setItem(this.selectedCommitteeKey, committee);
          this.isDropdownOpen = false; // Close dropdown on selection
          this.renderDropdown();
          this.renderLegend();
        });
      });
      
      // Attach click event for checkboxes.
      const checkboxes = this.containerElement.querySelectorAll(".fav-checkbox");
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener("click", (e) => {
          console.log("Checkbox event triggered. Target:", e.target);
          e.stopPropagation();
          // Do not call e.preventDefault() so that the default checkbox toggle occurs.
          const committee = checkbox.getAttribute("data-committee");
          console.log("Checkbox state before update:", checkbox.checked);
          if (checkbox.checked) {
            if (!this.favoriteCommittees.includes(committee)) {
              this.favoriteCommittees.push(committee);
              console.log("Added", committee, "to favorites");
            }
          } else {
            this.favoriteCommittees = this.favoriteCommittees.filter(name => name !== committee);
            console.log("Removed", committee, "from favorites");
          }
          localStorage.setItem(this.favoritesKey, JSON.stringify(this.favoriteCommittees));
          this.renderDropdown();
          this.renderLegend();
        });
      });
      
      // Hide dropdown when clicking outside.
      document.addEventListener("click", (e) => {
        if (!this.containerElement.contains(e.target)) {
          this.isDropdownOpen = false;
          listDiv.style.display = "none";
          console.log("Clicked outside dropdown. Hiding dropdown list.");
        }
      });
    }
    
    renderLegend() {
      console.log("Rendering legend for committee:", this.selectedCommittee);
      const members = this.committeesData[this.selectedCommittee] || [];
      let html = "<ul>";
      members.forEach(member => {
        html += `<li>${member}</li>`;
      });
      html += "</ul>";
      this.legendElement.innerHTML = html;
    }
    
    getSelectedCommittee() {
      return this.selectedCommittee;
    }

    getSelectedCommitteeMembers() {
      return this.committeesData[this.selectedCommittee] || [];
    }
  }
  