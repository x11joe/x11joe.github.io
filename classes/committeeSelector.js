// classes/committeeSelector.js
export class CommitteeSelector {
    /**
     * @param {HTMLElement} containerElement - The container element where the custom dropdown will be rendered.
     * @param {HTMLElement} legendElement - The container element for the fixed committee legend.
     * @param {Object} committeesData - An object mapping committee names to arrays of member strings.
     * @param {Array} femaleNames - An array of female names to generate the legend.
     */
    constructor(containerElement, legendElement, committeesData, femaleNames) {
      this.containerElement = containerElement;
      this.legendElement = legendElement;
      this.committeesData = committeesData;
      this.femaleNames = femaleNames;
      this.tokenSystem = null;
      this.selectedCommitteeKey = "selectedCommittee";
      this.favoritesKey = "favoriteCommittees";
      this.isDropdownOpen = false;
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

    // Method to set tokenSystem after creation
    setTokenSystem(tokenSystem) {
      this.tokenSystem = tokenSystem;
    }
    
    renderDropdown() {
      const favorites = this.committeeNames.filter(name => this.favoriteCommittees.includes(name));
      const nonFavorites = this.committeeNames.filter(name => !this.favoriteCommittees.includes(name));
      favorites.sort();
      nonFavorites.sort();
      const sorted = favorites.concat(nonFavorites);
      console.log("Sorted committee list:", sorted);
  
      let html = `<div class="dropdown-selected"><span>${this.selectedCommittee}</span><span class="dropdown-arrow">▾</span></div>`;
      html += `<div class="dropdown-list" style="display:${this.isDropdownOpen ? 'block' : 'none'};">`;
      sorted.forEach(committee => {
          html += `<div class="dropdown-item" data-committee="${committee}">`;
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
  
      const nameSpans = this.containerElement.querySelectorAll(".committee-name");
      nameSpans.forEach(span => {
          span.addEventListener("click", (e) => {
              e.stopPropagation();
              const committee = span.textContent;
              console.log("Committee name clicked. Setting selected committee to:", committee);
              this.selectedCommittee = committee;
              localStorage.setItem(this.selectedCommitteeKey, committee);
              this.isDropdownOpen = false;
              this.renderDropdown();
              this.renderLegend();
          });
      });
  
      const checkboxes = this.containerElement.querySelectorAll(".fav-checkbox");
      checkboxes.forEach(checkbox => {
          checkbox.addEventListener("click", (e) => {
              console.log("Checkbox event triggered. Target:", e.target);
              e.stopPropagation();
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
  
      document.addEventListener("click", (e) => {
          if (!this.containerElement.contains(e.target)) {
              this.isDropdownOpen = false;
              listDiv.style.display = "none";
              console.log("Clicked outside dropdown. Hiding dropdown list.");
          }
      });
    }
    
    /**
     * Renders the committee legend with clickable member items. On Ctrl+click, copies the member's number to the clipboard in the format "member-no:<number>;Mic:" and applies a green glow effect for visual feedback.
     */
    renderLegend() {
        const members = this.committeesData[this.selectedCommittee] || [];
        const isSenate = this.selectedCommittee.toLowerCase().startsWith('senate');
        const header = isSenate ? 'Senators' : 'Representatives';

        const parseMember = (memberObj) => {
            const memberStr = memberObj.name;
            if (memberStr.includes(" - ")) {
                const [name, title] = memberStr.split(" - ");
                const isFemale = this.femaleNames.includes(name);
                const adjustedTitle = isFemale
                    ? title.replace("Chairman", "Chairwoman").replace("Vice Chairman", "Vice Chairwoman")
                    : title;
                return { name, title: adjustedTitle, memberNo: memberObj.memberNo };
            } else {
                return { name: memberStr, title: null, memberNo: memberObj.memberNo };
            }
        };

        const parsedMembers = members.map(parseMember);
        const chairman = parsedMembers.find(member => 
            member.title && (member.title.includes("Chairman") || member.title.includes("Chairwoman"))
        );
        const viceChairman = parsedMembers.find(member => 
            member.title && (member.title.includes("Vice Chairman") || member.title.includes("Vice Chairwoman"))
        );
        const others = parsedMembers.filter(member => member !== chairman && member !== viceChairman);

        let html = `<h3>${header}</h3><ul>`;
        if (chairman) {
            html += `<li class="member-item" data-member="${chairman.name}" data-member-no="${chairman.memberNo}">${chairman.title} ${chairman.name}</li>`;
        }
        if (viceChairman) {
            html += `<li class="member-item" data-member="${viceChairman.name}" data-member-no="${viceChairman.memberNo}">${viceChairman.title} ${viceChairman.name}</li>`;
        }
        if (chairman || viceChairman) {
            html += `<hr class="member-separator">`;
        }
        others.forEach(member => {
            html += `<li class="member-item" data-member="${member.name}" data-member-no="${member.memberNo}">${member.name}</li>`;
        });
        html += "</ul>";
        this.legendElement.innerHTML = html;

        this.legendElement.addEventListener('click', (e) => {
            e.stopPropagation();
            const memberItem = e.target.closest('.member-item');
            if (memberItem) {
                const memberName = memberItem.dataset.member;
                const memberNo = memberItem.dataset.memberNo;
                if (e.ctrlKey && memberNo) {
                    const clipboardText = `member-no:${memberNo};Mic:`;
                    navigator.clipboard.writeText(clipboardText).then(() => {
                        console.log(`Copied to clipboard: ${clipboardText}`);
                        // Apply green glow effect
                        memberItem.classList.add('glow');
                        setTimeout(() => {
                            memberItem.classList.remove('glow');
                        }, 1000); // Remove glow after 1 second
                    }).catch(err => {
                        console.error('Failed to copy to clipboard:', err);
                    });
                } else if (this.tokenSystem) {
                    this.tokenSystem.setTokens(["Member Action", memberName]);
                }
            }
        });
    }
    
    getSelectedCommittee() {
      return this.selectedCommittee;
    }

    getSelectedCommitteeMembers() {
      return this.committeesData[this.selectedCommittee] || [];
    }

    /**
     * Check if a given token is a member name in the currently selected committee.
     * Extracts the name part before " - " from the member's name property.
     * @param {string} token - The token to check against member names.
     * @returns {boolean} - True if the token matches a member's name, false otherwise.
     */
    isMemberName(token) {
        const currentMembers = this.getSelectedCommitteeMembers();
        return currentMembers.some(member => {
            const name = member.name.split(" - ")[0];
            return name === token;
        });
    }
    
    getMemberTitle() {
        return this.selectedCommittee.toLowerCase().startsWith('senate') ? "Senator" : "Representative";
    }
    
    getLastName(fullName) {
        const nameParts = fullName.split(" ");
        return nameParts[nameParts.length - 1];
    }
    
    shortenCommitteeName(committee) {
        return committee.replace(/^(Senate|House)\s+/i, '').replace(/\s+Committee$/i, '');
    }

    
  }
  