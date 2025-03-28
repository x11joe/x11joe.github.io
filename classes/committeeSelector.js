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
      console.log("CommitteeSelector constructor called");
      this.init();
    }
    
    init() {
      this.committeeNames = Object.keys(this.committeesData);
      console.log("Available committees:", this.committeeNames);
      // Get saved selected committee
      const savedCommittee = localStorage.getItem(this.selectedCommitteeKey);
      if (savedCommittee && this.committeeNames.includes(savedCommittee)) {
        this.selectedCommittee = savedCommittee;
        console.log("Loaded saved selected committee:", savedCommittee);
      } else {
        this.selectedCommittee = this.committeeNames[0];
        console.log("Default selected committee set to:", this.selectedCommittee);
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
      let html = `<div class="dropdown-selected">${this.selectedCommittee} &#9662;</div>`;
      html += `<div class="dropdown-list" style="display:none;">`;
      sorted.forEach(committee => {
        html += `<div class="dropdown-item" data-committee="${committee}">`;
        // Committee name is in its own span.
        html += `<span class="committee-name">${committee}</span>`;
        // Checkbox is placed separately.
        html += `<input type="checkbox" class="fav-checkbox" data-committee="${committee}" ${this.favoriteCommittees.includes(committee) ? "checked" : ""}>`;
        html += `</div>`;
      });
      html += `</div>`;
      this.containerElement.innerHTML = html;
      
      const selectedDiv = this.containerElement.querySelector(".dropdown-selected");
      const listDiv = this.containerElement.querySelector(".dropdown-list");
      
      selectedDiv.addEventListener("click", (e) => {
        e.stopPropagation();
        listDiv.style.display = listDiv.style.display === "none" ? "block" : "none";
        console.log("Dropdown selected clicked. List display:", listDiv.style.display);
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
          listDiv.style.display = "none";
          this.renderDropdown();
          this.renderLegend();
        });
      });
      
      // Attach click event for checkboxes.
      const checkboxes = this.containerElement.querySelectorAll(".fav-checkbox");
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener("click", (e) => {
          console.log("Checkbox event triggered. Target:", e.target);
          // Prevent the checkbox click from bubbling up.
          e.stopPropagation();
          e.preventDefault();
          // Toggle the checkbox manually.
          checkbox.checked = !checkbox.checked;
          console.log("Checkbox new state:", checkbox.checked);
          const committee = checkbox.getAttribute("data-committee");
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
          // Re-render the dropdown and legend.
          this.renderDropdown();
          this.renderLegend();
        });
      });
      
      // Hide dropdown when clicking outside.
      document.addEventListener("click", (e) => {
        // Only close if the click is outside the container.
        if (!this.containerElement.contains(e.target)) {
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
  }
  