/* --------------------------
   Global Variables & Setup
   -------------------------- */
let historyRecords = [];

// Time Mode feature variables and helper function
let timeModeActivated = false;
let timeModeTime = null;

let currentEditIndex = null;
let editingTestimonyIndex = null;

// Global variable for including bill type SB or HB in roll call vote statements:
let includeBillTypeInRollCall = (localStorage.getItem("includeBillTypeInRollCall") === "true");
let includeBillTypeInMoved = (localStorage.getItem("includeBillTypeInMoved") === "true");

// if true, roll call votes will use individual member buttons.
// (When on, the neutral count will default to the total number of members,
// and clicking a member button toggles that member’s vote.)
let rollCallUseMemberNames = (localStorage.getItem("rollCallUseMemberNames") === "true");

// Global Variable, if true, always use "Senator" or "Representative" instead of Chair/ Vice titles.
let forceSenatorTerms = (localStorage.getItem("forceSenatorTerms") === "true");

// Global variable for XML member info mapping:
let memberInfoMapping = {};

let inProgressRecordIndex = null; // track the current record in historyRecords..

// whether to use last names only for senators
let useLastNamesOnly = (localStorage.getItem("useLastNamesOnly") === "true");
let meetingActionsWithoutMember = localStorage.getItem("meetingActionsWithoutMember") === "true";

let selectedMember = "";
let mainAction = "";
let selectedSubAction = "";
let selectedBillType = "";
let selectedCarrier = "";
let constructedStatement = "";
let currentCommittee = "";
let asAmended = false;
let autoCopyEnabled = false;

// For the statement in progress
let forVal = 0;
let againstVal = 0;
let neutralVal = 0;

// In-progress row references
let inProgressRow = null;
let timeCell = null;
let statementCell = null;
let statementStartTime = null; // The moment we first pick the new member

let committees = loadCommitteesFromLocalStorage();

let editMode = false;            // are we editing an existing member?
let editCommitteeName = null;    // store if editing
let editMemberIndex = null;      // which member?

let voiceVoteOutcome = ""; // For voice votes: "Passed" or "Failed"
let selectedRereferCommittee = ""; // e.g. "Senate Appropriations" or "

/* --------------------------
   Utility Functions
   -------------------------- */

   // --- Helper: Update a row’s tooltip based on vote data ---
   function updateRowVoteTooltip(el, votes) {
    let tooltipHTML = "<div>";
    
    // For votes cast "for"
    if (votes && votes.for && votes.for.length > 0) {
      tooltipHTML += votes.for
        .map(member => `<div style="color:green;">✓ ${member}</div>`)
        .join("");
    }
    
    // For votes cast "against"
    if (votes && votes.against && votes.against.length > 0) {
      tooltipHTML += votes.against
        .map(member => `<div style="color:red;">✗ ${member}</div>`)
        .join("");
    }
    
    // Compute neutral votes (optional)
    if (rollCallUseMemberNames && currentCommittee && committees[currentCommittee]) {
      const allMembers = committees[currentCommittee];
      const neutralMembers = allMembers.filter(member => {
        return !(votes.for && votes.for.includes(member)) &&
               !(votes.against && votes.against.includes(member));
      });
      if (neutralMembers.length > 0) {
        tooltipHTML += neutralMembers
          .map(member => `<div style="color:gray;">⚪ ${member}</div>`)
          .join("");
      }
    }
    
    tooltipHTML += "</div>";
    // Save our custom HTML to the element's data attribute
    el.dataset.tooltipHtml = tooltipHTML;
    console.log("updateRowVoteTooltip: Set tooltip HTML to:", tooltipHTML);
  }
  

// --- Custom tooltip helper for a row ---
function attachTooltipToRow(row) {
  console.log("attachTooltipToRow: Attaching tooltip for row:", row);
  
  // Remove any existing tooltip if present
  if (row._tooltip) {
    row._tooltip.remove();
    row._tooltip = null;
  }
  
  // When the mouse enters the row, create the tooltip.
  row.addEventListener("mouseenter", function(e) {
    //console.log("mouseenter event fired on row:", row);
    // Get our custom tooltip HTML if available; fallback to row.title.
    const tooltipHTML = row.dataset.tooltipHtml || row.title || "";
    //console.log("Tooltip HTML found:", tooltipHTML);
    if (!tooltipHTML) return;
    let tooltip = document.createElement("div");
    tooltip.className = "row-tooltip";
    tooltip.innerHTML = tooltipHTML; // use innerHTML for formatting
    document.body.appendChild(tooltip);
    row._tooltip = tooltip;
    positionTooltip(e, tooltip);
    //console.log("Tooltip created and positioned:", tooltip);
  });
  
  // As the mouse moves over the row, update the tooltip position.
  row.addEventListener("mousemove", function(e) {
    if (row._tooltip) {
      positionTooltip(e, row._tooltip);
    }
  });
  
  // When the mouse leaves the row, remove the tooltip.
  row.addEventListener("mouseleave", function(e) {
    //console.log("mouseleave event fired on row:", row);
    if (row._tooltip) {
      //console.log("Removing tooltip:", row._tooltip);
      row._tooltip.remove();
      row._tooltip = null;
    }
  });
}

function attachTooltipToElement(el) {
  // Remove any existing tooltip if present
  if (el._tooltip) {
    el._tooltip.remove();
    el._tooltip = null;
  }
  el.addEventListener("mouseenter", function(e) {
    const tooltipHTML = el.dataset.tooltipHtml || "";
    if (!tooltipHTML) return;
    let tooltip = document.createElement("div");
    tooltip.className = "row-tooltip";
    tooltip.innerHTML = tooltipHTML; // allow custom formatting via innerHTML
    document.body.appendChild(tooltip);
    el._tooltip = tooltip;
    positionTooltip(e, tooltip);
  });
  el.addEventListener("mousemove", function(e) {
    if (el._tooltip) {
      positionTooltip(e, el._tooltip);
    }
  });
  el.addEventListener("mouseleave", function(e) {
    if (el._tooltip) {
      el._tooltip.remove();
      el._tooltip = null;
    }
  });
}


// Helper to position the tooltip near the cursor with logging.
// --- Modified positionTooltip so the tooltip appears above the mouse ---
function positionTooltip(e, tooltip) {
  const offset = 10;
  tooltip.style.position = "absolute";
  tooltip.style.left = (e.pageX + offset) + "px";
  // Place the tooltip above the mouse by subtracting its height:
  tooltip.style.top = (e.pageY - tooltip.offsetHeight - offset) + "px";
  //console.log("positionTooltip: Positioned tooltip at", tooltip.style.left, tooltip.style.top);
}



// Helper to normalize a name (trim and convert to lower case).
function normalizeName(name) {
  return name.trim().toLowerCase();
}

// Helper to compare two names.
// Returns true if they match exactly after normalization or if their last names match.
function namesMatch(name1, name2) {
  let n1 = normalizeName(name1);
  let n2 = normalizeName(name2);
  if (n1 === n2) return true;
  // Otherwise, compare the last words (last names)
  let parts1 = n1.split(" ");
  let parts2 = n2.split(" ");
  return parts1[parts1.length - 1] === parts2[parts2.length - 1];
}

function getPreviousBillType() {
  // Look backwards through historyRecords for a "Moved" statement that includes "on SB" or "on HB"
  for (let i = historyRecords.length - 1; i >= 0; i--) {
    let rec = historyRecords[i];
    if (rec.statement && rec.statement.includes("Moved")) {
      if (rec.statement.includes("on SB")) {
        return "SB";
      } else if (rec.statement.includes("on HB")) {
        return "HB";
      }
    }
  }
  return "";
}

  
function getStartingTime() {
  // If time mode is active, use the stored time; otherwise, use the current time.
  return (timeModeActivated && timeModeTime) ? timeModeTime : getCurrentTimestamp();
}

function resetTimeMode() {
  if (timeModeActivated) {
    timeModeActivated = false;
    timeModeTime = null;
    document.body.classList.remove("time-mode");
    console.log("Time mode reset.");
  }
}

function parseTestimonyString(str) {
  const allowedPositions = ["In Favor", "In Opposition", "Neutral"];
  // Split the string by " - " and trim each part.
  const parts = str.split(" - ").map(p => p.trim());
  let testimonyDetails = {};

  // Extract full name and split into first and last names.
  if (parts.length >= 1) {
    testimonyDetails.fullName = parts[0];
    let nameParts = parts[0].split(" ");
    if (nameParts.length > 1) {
      testimonyDetails.firstName = nameParts.slice(0, -1).join(" ");
      testimonyDetails.lastName = nameParts[nameParts.length - 1];
    } else {
      testimonyDetails.firstName = parts[0];
      testimonyDetails.lastName = "";
    }
  }

  if (parts.length === 5) {
    // Standard format: fullName - role - organization - position - testimony number
    testimonyDetails.role = parts[1];
    testimonyDetails.organization = parts[2];
    testimonyDetails.position = parts[3];
    testimonyDetails.number = parts[4].startsWith("Testimony#")
      ? parts[4].substring("Testimony#".length)
      : parts[4];
  } else if (parts.length === 4) {
    // If the third part is one of the allowed positions,
    // then we assume the role is missing:
    if (allowedPositions.includes(parts[2])) {
      testimonyDetails.role = "";
      testimonyDetails.organization = parts[1];
      testimonyDetails.position = parts[2];
      testimonyDetails.number = parts[3].startsWith("Testimony#")
        ? parts[3].substring("Testimony#".length)
        : parts[3];
    } else {
      // Otherwise, assume organization is missing.
      testimonyDetails.role = parts[1];
      testimonyDetails.organization = "";
      testimonyDetails.position = parts[2];
      testimonyDetails.number = parts[3].startsWith("Testimony#")
        ? parts[3].substring("Testimony#".length)
        : parts[3];
    }
  } else if (parts.length === 3) {
    // Fallback for a very short testimony string.
    testimonyDetails.role = "";
    testimonyDetails.organization = "";
    testimonyDetails.position = parts[1];
    testimonyDetails.number = parts[2].startsWith("Testimony#")
      ? parts[2].substring("Testimony#".length)
      : parts[2];
  } else {
    // If the string doesn't match any expected format, return an object
    // with the entire string as the fullName.
    testimonyDetails.role = "";
    testimonyDetails.organization = "";
    testimonyDetails.position = "";
    testimonyDetails.number = "";
  }
  
  return testimonyDetails;
}


// Returns a modified full name if useLastNamesOnly is enabled and the name starts with "Senator"
function applyUseLastNamesOnly(fullName) {
  if (!useLastNamesOnly) return fullName;
  
  if (forceSenatorTerms) {
    // Force the title to be "Senator" or "Representative" based on the committee.
    let parts = fullName.split(" ");
    let lastName = parts[parts.length - 1];
    if (currentCommittee && currentCommittee.toLowerCase().includes("house")) {
      return "Representative " + lastName;
    } else {
      return "Senator " + lastName;
    }
  }
  
  // Otherwise, use the stored prefix (which may be Chairman, Chairwoman, etc.)
  const prefixes = [
    "Senator",
    "Representative",
    "Chairman",
    "Chairwoman",
    "Vice Chairman",
    "Vice Chairwoman"
  ];
  
  for (let prefix of prefixes) {
    if (fullName.startsWith(prefix + " ")) {
      let parts = fullName.split(" ");
      // Only proceed if there are at least 3 words (prefix + first name + last name)
      if (parts.length >= 3) {
        return prefix + " " + parts[parts.length - 1];
      }
    }
  }
  return fullName;
}


// Attach a control-click event listener to a row.
// When the user clicks with the Control key held down,
// the row is highlighted yellow and a final string is built and copied.
function addCtrlClickHandler(row) {
  row.addEventListener("click", function (e) {
    if (e.ctrlKey) {
      e.stopPropagation();
      e.preventDefault();
      row.style.backgroundColor = "yellow";
      
      let timeStr = (row.cells[0].textContent || "").trim() || " ";
      let annotation = (row.cells[1].textContent || "").trim() || " ";
      let member = row.getAttribute("data-member") || "";
      let comments = getMemberInfoForMember(member).trim() || " ";
      let link = (row.dataset.fileLink || "").trim() || " ";
      
      // If the row has vote details stored (we set it when finalizing the record), append them.
      let voteInfo = "";
      if (row.dataset.votes) {
        try {
          const votes = JSON.parse(row.dataset.votes);
          voteInfo = ` | For: ${votes.for.join(", ")} | Against: ${votes.against.join(", ")}`;
        } catch(e) {
          // ignore parsing errors
        }
      }
      
      let finalString = `${timeStr} | ${annotation} | ${comments} | ${link}${voteInfo}`;
      finalString = finalString.replace(/,/g, "");
      
      navigator.clipboard.writeText(finalString).then(() => {
        setTimeout(() => { row.style.backgroundColor = ""; }, 1000);
      });
      console.log("Ctrl-click copy:", finalString);
    } else if (e.shiftKey) {
      e.stopPropagation();
      e.preventDefault();
      row.style.backgroundColor = "purple";
      let link = (row.dataset.fileLink || "").trim() || " ";
      navigator.clipboard.writeText(link).then(() => {
        setTimeout(() => { row.style.backgroundColor = ""; }, 1000);
      });
      console.log("Shift-click copy (link only):", link);
    }
  }, true);
}


function loadMemberInfoXML() {
  fetch('allMember.xml')
    .then(response => response.text())
    .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
    .then(data => {
      let hotKeys = data.getElementsByTagName("HotKey");
      for (let i = 0; i < hotKeys.length; i++) {
        let hotKey = hotKeys[i];
        let nameElem = hotKey.getElementsByTagName("Name")[0];
        let firstNameElem = hotKey.getElementsByTagName("FirstName")[0];
        if (!nameElem || !firstNameElem) continue;
        let name = nameElem.textContent.trim();
        let firstName = firstNameElem.textContent.trim();
        // Build a full name—for example, "Representative B. Anderson"
        let fullName = (firstName + " " + name).trim();
        // Only add records where fullName starts with "Senator" or "Representative"
        if (!fullName.match(/^(Senator|Representative)\b/i)) {
          continue;
        }
        let fieldsElement = hotKey.getElementsByTagName("Fields")[0];
        let fields = fieldsElement.getElementsByTagName("Field");
        let memberInfoStr = "";
        for (let j = 0; j < fields.length; j++) {
          let field = fields[j];
          let keyElem = field.getElementsByTagName("Key")[0];
          let valueElem = field.getElementsByTagName("Value")[0];
          if (keyElem && valueElem) {
            let key = keyElem.textContent.trim();
            let value = valueElem.textContent.trim();
            memberInfoStr += key + ":" + value + ";";
          }
        }
        // Remove the trailing semicolon, if it exists
        if (memberInfoStr.endsWith(";")) {
          memberInfoStr = memberInfoStr.slice(0, -1);
        }
        memberInfoMapping[fullName] = memberInfoStr;
      }
      console.log("Member info mapping loaded:", memberInfoMapping);
    })
    .catch(err => {
      console.error("Failed to load member info XML:", err);
    });
}



// Helper function to get member info for a given member name.
// It first tries an exact match and then falls back to matching by the last name.
function getMemberInfoForMember(member) {
  if (!member) return "";
  // Remove common prefixes for comparison.
  const normalize = (name) => {
    return name.replace(/^(Senator|Representative|Chairman|Chairwoman|Vice Chairman|Vice Chairwoman)\s+/i, "").trim();
  };

  let normalizedMember = normalize(member).toLowerCase();

  // First, try an exact match (after normalization) against the keys.
  for (let key in memberInfoMapping) {
    let normalizedKey = normalize(key).toLowerCase();
    if (normalizedMember === normalizedKey) {
      return memberInfoMapping[key];
    }
  }

  // If no exact match, try matching by surname (the last word).
  let parts = normalizedMember.split(" ");
  let surname = parts[parts.length - 1];
  for (let key in memberInfoMapping) {
    let normalizedKey = normalize(key).toLowerCase();
    if (normalizedKey.endsWith(surname)) {
      return memberInfoMapping[key];
    }
  }
  return "";
}


function getCurrentTimestamp() {
  // Example: "3:05:07 PM" (12-hour format)
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Helper: Sort committee members so that "Chairman" or "Chairwoman" come first,
// then "Vice Chairman", then the rest.
function sortCommitteeMembers(members) {
  return members.slice().sort((a, b) => {
    const rank = (name) => {
      if (name.includes("Chairman") || name.includes("Chairwoman")) return 0;
      if (name.includes("Vice")) return 1;
      return 2;
    };
    return rank(a) - rank(b);
  });
}

// Group committee members into chairs, vice chairs, and others.
function groupCommitteeMembers(members) {
  const chairs = [];
  const viceChairs = [];
  const others = [];
  members.forEach(member => {
    if (member.includes("Chairman") || member.includes("Chairwoman")) {
      chairs.push(member);
    } else if (member.includes("Vice")) {
      viceChairs.push(member);
    } else {
      others.push(member);
    }
  });
  return { chairs, viceChairs, others };
}

// EDIT FLOW
// Called when the user clicks an "edit" (pencil) button in the history table.
function editHistoryRecord(index) {
  console.log("Editing history record at index:", index);
  let record = historyRecords[index];
  
  // If this is a testimony entry, call the testimony edit function.
  if (record.isTestimony) {
    editTestimonyRecord(index);
    return;
  }
  
  // Otherwise, continue with the standard edit flow.
  selectedMember = record.member || "";
  mainAction = record.mainAction || "";
  selectedSubAction = record.selectedSubAction || "";
  selectedBillType = record.selectedBillType || "";
  selectedCarrier = record.selectedCarrier || "";
  asAmended = record.asAmended || false;
  voiceVoteOutcome = record.voiceVoteOutcome || "";
  forVal = record.forVal || 0;
  againstVal = record.againstVal || 0;
  neutralVal = record.neutralVal || 0;
  selectedRereferCommittee = record.selectedRereferCommittee || "";
  
  constructedStatement = record.statement;
  
  currentEditIndex = index;
  inProgressRecordIndex = index;
  
  console.log("Loaded record for editing:", record);
  
  populateEditUI();
  document.getElementById("log").style.border = "2px dashed #007bff";
}

function editTestimonyRecord(index) {
  console.log("Editing testimony record at index:", index);
  let record = historyRecords[index];
  // Set the global flag so submitTestimonyModal() knows we're editing.
  editingTestimonyIndex = index;
  
  // Pre-fill the testimony modal fields using the stored testimony details.
  if (record.testimony) {
    document.getElementById("testimonyFirstName").value = record.testimony.firstName || "";
    document.getElementById("testimonyLastName").value = record.testimony.lastName || "";
    document.getElementById("testimonyRole").value = record.testimony.role || "";
    document.getElementById("testimonyOrganization").value = record.testimony.organization || "";
    document.getElementById("testimonyPosition").value = record.testimony.position || "";
    document.getElementById("testimonyNumber").value = record.testimony.number || "";
  } else {
    document.getElementById("testimonyFirstName").value = "";
    document.getElementById("testimonyLastName").value = "";
    document.getElementById("testimonyRole").value = "";
    document.getElementById("testimonyOrganization").value = "";
    document.getElementById("testimonyPosition").value = "";
    document.getElementById("testimonyNumber").value = "";
  }
  
  // NEW: Pre-fill the testimony link field using the stored fileLink.
  document.getElementById("testimonyLink").value = record.fileLink || "";
  
  // Open the testimony modal for editing.
  openTestimonyModal();
}



function populateEditUI() {
  // --- Added fix for edit mode ---
  if (mainAction === "Roll Call Vote on Bill" && (selectedBillType === "Amendment" || selectedBillType === "Reconsider")) {
    mainAction = "Roll Call Vote on " + selectedBillType;
  }
  // --- End added fix ---

  console.log("Populating edit UI. Record values:", {
    member: selectedMember,
    mainAction: mainAction,
    subAction: selectedSubAction,
    billType: selectedBillType,
    rerefer: selectedRereferCommittee
  });

  // Highlight member buttons.
  document.querySelectorAll("#members-container button").forEach(btn => {
    let btnText = btn.innerText.trim().toLowerCase();
    let savedMember = selectedMember.toLowerCase();
    if (btnText.includes(savedMember) || savedMember.includes(btnText)) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });

  // Highlight main action buttons.
  document.querySelectorAll("#mainActionsSection button").forEach(btn => {
    let btnText = btn.innerText.trim();
    if (
      (mainAction === "Roll Call Vote on Bill" && btnText === "Roll Call Vote on Bill") ||
      (mainAction === "Roll Call Vote on Amendment" && btnText === "Roll Call Vote on Amendment") ||
      (mainAction === "Roll Call Vote on Reconsider" && btnText === "Roll Call Vote on Reconsider")
    ) {
      btn.classList.add("selected");
      btn.classList.remove("inactive");
    } else {
      btn.classList.remove("selected");
      btn.classList.add("inactive");
    }
  });

  if (mainAction.startsWith("Roll Call Vote on")) {
    document.getElementById("members-container").classList.add("hidden");

    // For SB or HB votes, show the bill type section ONLY if the setting is enabled.
    if ((selectedBillType === "SB" || selectedBillType === "HB") && includeBillTypeInRollCall) {
      showBillTypeSection(true);
      document.querySelectorAll("#bill-type-container button").forEach(btn => {
        if (btn.innerText.trim() === selectedBillType) {
          btn.classList.add("selected");
        } else {
          btn.classList.remove("selected");
        }
      });
    } else {
      document.getElementById("bill-type-section").classList.add("hidden");
    }

    // For vote tally: if rollCallUseMemberNames is enabled, reconstruct vote data.
    if (rollCallUseMemberNames) {
      let existingVotes = null;
      let record = historyRecords[currentEditIndex];
      if (record.votes) {
        existingVotes = record.votes;
      } else {
        // If votes weren't saved, build a dummy votes object from the stored counts.
        existingVotes = { for: [], against: [] };
        const members = committees[currentCommittee] || [];
        // Mark the first record.forVal members as "for", then next record.againstVal as "against"
        for (let i = 0; i < members.length; i++) {
          if (i < record.forVal) {
            existingVotes.for.push(members[i]);
          } else if (i < record.forVal + record.againstVal) {
            existingVotes.against.push(members[i]);
          }
        }
      }
      showRollCallMemberButtons(existingVotes);
    } else {
      showVoteTallySection(true);
      const forCountEl = document.getElementById("forCount");
      if (forCountEl) {
        document.getElementById("forCount").innerText = forVal;
        document.getElementById("againstCount").innerText = againstVal;
        document.getElementById("neutralCount").innerText = neutralVal;
      }
    }
    
    // Always show the bill carrier section for roll call votes on a bill (SB/HB)
    // (Do not show it for amendments or reconsiders.)
    if (mainAction.startsWith("Roll Call Vote on") && (selectedBillType === "SB" || selectedBillType === "HB")) {
      showBillCarrierSection(true);
      // If a carrier was already selected, highlight it.
      if (selectedCarrier) {
        document.querySelectorAll("#bill-carrier-container button").forEach(btn => {
          if (btn.innerText.trim() === selectedCarrier) {
            btn.classList.add("selected");
          } else {
            btn.classList.remove("selected");
          }
        });
      }
    } else {
      document.getElementById("bill-carrier-section").classList.add("hidden");
    }
    
    // Show the "As Amended" section only for SB votes.
    if (selectedBillType === "SB") {
      document.getElementById("as-amended-section").classList.remove("hidden");
      if (asAmended) {
        document.getElementById("asAmendedBtn").classList.add("selected");
      } else {
        document.getElementById("asAmendedBtn").classList.remove("selected");
      }
    } else {
      document.getElementById("as-amended-section").classList.add("hidden");
    }
  } else if (mainAction === "Moved") {
    if ((selectedBillType === "SB" || selectedBillType === "HB") && includeBillTypeInMoved) {
      showBillTypeSection(true);
      document.querySelectorAll("#bill-type-container button").forEach(btn => {
        if (btn.innerText.trim() === selectedBillType) {
          btn.classList.add("selected");
        } else {
          btn.classList.remove("selected");
        }
      });
    } else {
      document.getElementById("bill-type-section").classList.add("hidden");
    }

    if (selectedBillType === "SB" || selectedBillType === "HB") {
      showMovedSubActions();
      document.querySelectorAll("#sub-actions-container button").forEach(btn => {
        if (btn.innerText.trim() === selectedSubAction) {
          btn.classList.add("selected");
        } else {
          btn.classList.remove("selected");
        }
      });
    } else {
      document.getElementById("sub-actions").classList.add("hidden");
    }

    let isHouse = currentCommittee.toLowerCase().includes("house");
    let possibleCommittees = [];
    for (let cName in committees) {
      let cNameLower = cName.toLowerCase();
      if (isHouse && cNameLower.includes("house")) {
        possibleCommittees.push(cName);
      } else if (!isHouse && cNameLower.includes("senate")) {
        possibleCommittees.push(cName);
      }
    }
    const rereferSelect = document.getElementById("rereferCommitteeSelect");
    rereferSelect.innerHTML = "";
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "(No rerefer)";
    rereferSelect.appendChild(noneOpt);
    possibleCommittees.forEach((cName) => {
      const opt = document.createElement("option");
      opt.value = cName;
      opt.textContent = cName;
      rereferSelect.appendChild(opt);
    });
    if (selectedRereferCommittee) {
      rereferSelect.value = selectedRereferCommittee;
      document.getElementById("rerefer-section").classList.remove("hidden");
      console.log("Rerefer section unhidden with value:", selectedRereferCommittee);
    } else {
      document.getElementById("rerefer-section").classList.add("hidden");
      console.log("No rerefer value set.");
    }
    rereferSelect.onchange = () => {
      selectedRereferCommittee = rereferSelect.value;
      console.log("Rerefer committee selected:", selectedRereferCommittee);
      updateStatement();
    };

  } else if (mainAction.startsWith("Voice Vote on")) {
    document.getElementById("members-container").classList.add("hidden");
    document.getElementById("voice-vote-outcome-section").classList.remove("hidden");
    document.querySelectorAll("#voice-vote-outcome-section button").forEach(btn => {
      if (btn.innerText.includes(voiceVoteOutcome)) {
        btn.classList.add("selected");
      } else {
        btn.classList.remove("selected");
      }
    });
  }

  document.getElementById("log").innerText = constructedStatement;
  console.log("Constructed statement in edit UI:", constructedStatement);
}


// When Enter is pressed and we’re in edit mode, call finalizeEdit() rather than creating a new row.
function finalizeEdit() {
  console.log("Finalizing edit for record index:", currentEditIndex);
  
  if (mainAction.startsWith("Roll Call Vote on") && forVal === 0 && againstVal === 0 && neutralVal === 0) {
    alert("Roll call vote cannot have a 0-0-0 tally.");
    console.log("Edit finalization aborted due to vote tally being 0-0-0.");
    return;
  }
  
  let record = historyRecords[currentEditIndex];
  record.member = selectedMember;
  record.mainAction = mainAction;
  record.selectedSubAction = selectedSubAction;
  record.selectedBillType = selectedBillType;
  record.selectedCarrier = selectedCarrier;
  record.asAmended = asAmended;
  record.voiceVoteOutcome = voiceVoteOutcome;
  record.forVal = forVal;
  record.againstVal = againstVal;
  record.neutralVal = neutralVal;
  record.selectedRereferCommittee = selectedRereferCommittee;
  
  // NEW: If roll call votes are using member names, store the detailed votes.
  if (mainAction.startsWith("Roll Call Vote on") && rollCallUseMemberNames) {
    const container = document.getElementById("rollCallMembersContainer");
    if (container) {
      let votesFor = [];
      let votesAgainst = [];
      container.querySelectorAll("button").forEach(btn => {
        if (btn.dataset.vote === "for") votesFor.push(btn.innerText);
        else if (btn.dataset.vote === "against") votesAgainst.push(btn.innerText);
      });
      record.votes = { for: votesFor, against: votesAgainst };
    }
  }
  
  updateStatement();
  record.statement = constructedStatement;
  
  console.log("Record after edit finalization:", record);
  
  saveHistoryToLocalStorage();
  loadHistoryFromLocalStorage();
  
  currentEditIndex = null;
  inProgressRecordIndex = null;
  document.getElementById("log").style.border = "none";
  resetSelections();
  console.log("Edit finalization completed.");
}

function createNewRowInHistory(fileLink = "") {
  // Capture the current timestamp.
  const recordTime = statementStartTime;
  const tableBody = document.getElementById("historyTableBody");
  inProgressRow = document.createElement("tr");
  
  // If a member is selected, store it as a data attribute on the row.
  if (selectedMember) {
    inProgressRow.setAttribute("data-member", selectedMember);
  }

  // Store the file link as a data attribute if available.
  if (fileLink) {
    inProgressRow.dataset.fileLink = fileLink;
  }

  // Create a new record object that we will push into historyRecords.
  const newRecord = { 
    time: recordTime, 
    statement: constructedStatement, 
    member: selectedMember,
    fileLink: fileLink,
    mainAction: mainAction,
    selectedSubAction: selectedSubAction,
    selectedBillType: selectedBillType,
    selectedCarrier: selectedCarrier,
    forVal: forVal,
    againstVal: againstVal,
    neutralVal: neutralVal,
    asAmended: asAmended,
    voiceVoteOutcome: voiceVoteOutcome,
    selectedRereferCommittee: selectedRereferCommittee
  };

  if (rollCallUseMemberNames && newRecord.votes) {
    inProgressRow.dataset.votes = JSON.stringify(newRecord.votes);
  }

  // Time cell as an editable field:
  const localTimeCell = document.createElement("td");
  localTimeCell.textContent = recordTime;
  localTimeCell.contentEditable = "true";
  localTimeCell.classList.add("clickable");
  localTimeCell.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      localTimeCell.blur();
    }
  });
  localTimeCell.addEventListener("blur", function() {
    let newTime = localTimeCell.textContent.trim();
    let timeRegex = /^(0?[1-9]|1[0-2]):[0-5]\d:[0-5]\d\s+(AM|PM)$/i;
    if (timeRegex.test(newTime)) {
      newRecord.time = newTime;
      saveHistoryToLocalStorage();
    } else {
      alert("Invalid time format. Please enter time in the format H:mm:ss AM/PM (e.g., 5:15:32 PM).");
      localTimeCell.textContent = newRecord.time;
    }
  });
  localTimeCell.addEventListener("click", function () {
    navigator.clipboard.writeText(localTimeCell.textContent.replace(/,/g, "")).then(() => {
      localTimeCell.classList.add("copied-cell");
      setTimeout(() => {
        localTimeCell.classList.remove("copied-cell");
      }, 800);
    });
  });
  inProgressRow.appendChild(localTimeCell);

  // Statement cell (only here we attach the tooltip)
  const localStatementCell = document.createElement("td");
  localStatementCell.textContent = constructedStatement;
  localStatementCell.classList.add("clickable");
  localStatementCell.addEventListener("click", function () {
    navigator.clipboard.writeText(localStatementCell.textContent.replace(/,/g, "")).then(() => {
      localStatementCell.classList.add("copied-cell");
      setTimeout(() => {
        localStatementCell.classList.remove("copied-cell");
      }, 800);
    });
  });
  inProgressRow.appendChild(localStatementCell);

  // If newRecord already has votes, update tooltip on the statement cell
  if (newRecord.votes) {
    updateRowVoteTooltip(localStatementCell, newRecord.votes);
    attachTooltipToElement(localStatementCell);
  }
  
  // Create a cell for the +/- time adjustment buttons.
  const timeAdjustCell = document.createElement("td");
  timeAdjustCell.style.whiteSpace = "nowrap";

  function createTimeAdjustButton(label, secondsToAdjust) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.classList.add("copy-row-button");
    btn.onclick = () => {
      let timeDate = new Date("1970-01-01 " + localTimeCell.textContent);
      timeDate.setSeconds(timeDate.getSeconds() + secondsToAdjust);
      let newTimeStr = timeDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      localTimeCell.textContent = newTimeStr;
      newRecord.time = newTimeStr;
      saveHistoryToLocalStorage();
      btn.classList.add("copied-cell");
      setTimeout(() => {
        btn.classList.remove("copied-cell");
      }, 800);
    };
    return btn;
  }

  const minusDiv = document.createElement("div");
  minusDiv.classList.add("time-control-group");
  minusDiv.appendChild(createTimeAdjustButton("-5s", -5));
  minusDiv.appendChild(createTimeAdjustButton("-3s", -3));
  minusDiv.appendChild(createTimeAdjustButton("-1s", -1));

  const plusDiv = document.createElement("div");
  plusDiv.classList.add("time-control-group");
  plusDiv.appendChild(createTimeAdjustButton("+1s", +1));
  plusDiv.appendChild(createTimeAdjustButton("+3s", +3));
  plusDiv.appendChild(createTimeAdjustButton("+5s", +5));

  const nowDiv = document.createElement("div");
  nowDiv.classList.add("time-control-group");
  const nowBtn = document.createElement("button");
  nowBtn.textContent = "Now";
  nowBtn.classList.add("copy-row-button");
  nowBtn.onclick = () => {
    const newTimeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    localTimeCell.textContent = newTimeStr;
    newRecord.time = newTimeStr;
    saveHistoryToLocalStorage();
    nowBtn.classList.add("copied-cell");
    setTimeout(() => {
      nowBtn.classList.remove("copied-cell");
    }, 800);
  };
  nowDiv.appendChild(nowBtn);

  // *** Added extra button for "Marked" time ***
  const markedBtn = document.createElement("button");
  markedBtn.textContent = "Marked";
  markedBtn.classList.add("copy-row-button");
  markedBtn.onclick = () => {
    if (timeModeTime) {
      localTimeCell.textContent = timeModeTime;
      newRecord.time = timeModeTime;
      saveHistoryToLocalStorage();
      markedBtn.classList.add("copied-cell");
      setTimeout(() => {
        markedBtn.classList.remove("copied-cell");
      }, 800);
    } else {
      alert("No marked time set.");
    }
  };
  nowDiv.appendChild(markedBtn);

  timeAdjustCell.appendChild(minusDiv);
  timeAdjustCell.appendChild(plusDiv);
  timeAdjustCell.appendChild(nowDiv);
  inProgressRow.appendChild(timeAdjustCell);

  // Delete cell with a Delete button.
  const deleteCell = document.createElement("td");
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "X";
  deleteButton.classList.add("copy-row-button");
  deleteButton.style.backgroundColor = "#dc3545";
  deleteButton.onclick = function() {
    if (inProgressRecordIndex !== null) {
      historyRecords.splice(inProgressRecordIndex, 1);
      saveHistoryToLocalStorage();
    }
    const row = this.closest("tr");
    if (row) {
      row.remove();
    }
    constructedStatement = "";
    finalizeInProgressRow();
  };
  deleteCell.appendChild(deleteButton);
  inProgressRow.appendChild(deleteCell);

  // Attach the Control‑click handler to the row.
  addCtrlClickHandler(inProgressRow);

  tableBody.appendChild(inProgressRow);
  historyRecords.push(newRecord);
  inProgressRecordIndex = historyRecords.length - 1;
  saveHistoryToLocalStorage();

  // Update global references.
  timeCell = localTimeCell;
  statementCell = localStatementCell;
}




function finalizeInProgressRow() {
  inProgressRow = null;
  timeCell = null;
  statementCell = null;
  statementStartTime = null;
}

/**
 * Inserts a brand-new statement row into the "History" table
 * using the current local time and the given statement text.
 */
function insertHearingStatementDirect(statementData) {
  // Capture the starting time from time mode (if active), then disable time mode.
  let startingTime = getStartingTime();
  resetTimeMode();

  let statementText, fileLink;
  let isTestimony = false;
  let testimonyDetails = null;
  if (typeof statementData === "object" && statementData !== null) {
    statementText = statementData.text;
    fileLink = statementData.link || "";
    isTestimony = !!statementData.isTestimony;
    testimonyDetails = statementData.testimony || null;
  } else {
    statementText = statementData;
    fileLink = "";
  }

  if (inProgressRow !== null) {
    resetAllAndFinalize();
  }

  constructedStatement = statementText;
  statementStartTime = startingTime;
  createNewRowInHistory(fileLink);
  finalizeInProgressRow();

  // If it's a testimony entry, store additional properties.
  if (isTestimony && historyRecords.length > 0) {
    let newRecord = historyRecords[historyRecords.length - 1];
    newRecord.isTestimony = true;
    newRecord.testimony = testimonyDetails;
    saveHistoryToLocalStorage();
  }
}






/* --------------------------
   Auto Copy
   -------------------------- */
function onAutoCopyChanged() {
  autoCopyEnabled = document.getElementById("autoCopyCheckbox").checked;
  console.log("Auto copy changed:", autoCopyEnabled);
  localStorage.setItem("autoCopyEnabled", autoCopyEnabled);
  if (
    autoCopyEnabled &&
    constructedStatement.trim() !== "[Click a member and an action]" &&
    constructedStatement.trim() !== ""
  ) {
    copyToClipboard();
  }
}



function autoCopyIfEnabled() {
  if (autoCopyEnabled) {
    copyToClipboard(false);
  }
}

/* --------------------------
   Main Flow
   -------------------------- */
function updateMembers() {
  currentCommittee = document.getElementById("committeeSelect").value;
  // Save the current committee selection to localStorage
  localStorage.setItem("selectedCommittee", currentCommittee);
  resetSelections();

  const membersContainer = document.getElementById("members-container");
  membersContainer.innerHTML = "";

  if (!committees[currentCommittee]) {
    // If user typed a new committee name, but there's no members yet
    return;
  }
   
  // Group members into chairs/vice chairs and others.
  const groups = groupCommitteeMembers(committees[currentCommittee]);

  // Create a container for the top members (chairs and vice chairs)
  const topDiv = document.createElement("div");
  topDiv.classList.add("committee-top");
  
  // Add chairs first.
  groups.chairs.forEach(member => {
     const btn = document.createElement("button");
     btn.innerText = member;
     btn.addEventListener("click", (e) => {
       if (e.ctrlKey) {
         // When Ctrl is held, handle the control‑click action.
         handleMemberCtrlClick(member, btn);
       } else {
         // Otherwise, do the normal selectMember action.
         selectMember(member, btn);
       }
     });
     topDiv.appendChild(btn);
  });

  
  // Then vice chairs.
  groups.viceChairs.forEach(member => {
     const btn = document.createElement("button");
     btn.innerText = member;
     btn.addEventListener("click", (e) => {
       if (e.ctrlKey) {
         handleMemberCtrlClick(member, btn);
       } else {
         selectMember(member, btn);
       }
     });
     topDiv.appendChild(btn);
  });
  
  membersContainer.appendChild(topDiv);

  // Add a divider between top members and others.
  const divider = document.createElement("div");
  divider.classList.add("committee-divider");
  // divider.textContent = "Other Members";
  membersContainer.appendChild(divider);

  // Create a container for other members.
  const othersDiv = document.createElement("div");
  othersDiv.classList.add("committee-others");
  groups.others.forEach(member => {
     const btn = document.createElement("button");
     btn.innerText = member;
     btn.addEventListener("click", (e) => {
       if (e.ctrlKey) {
         handleMemberCtrlClick(member, btn);
       } else {
         selectMember(member, btn);
       }
     });
     othersDiv.appendChild(btn);
  });
  membersContainer.appendChild(othersDiv);
}

function handleMemberCtrlClick(member, btn) {
  // Retrieve the member info from your mapping.
  let info = getMemberInfoForMember(member);
  // If no info is found, you might fallback to using the member name.
  if (!info) {
    info = member;
  }
  // Optionally, if you need to massage the format further, do so here.
  // For example, if you want to ensure it appears as "member-no:009;Mic:" 
  // (assuming that’s the format stored in your XML mapping), then info should already be in that format.
  
  // Copy the member info to the clipboard.
  navigator.clipboard.writeText(info).then(() => {
    // Add a CSS class to make the button glow.
    btn.classList.add("member-copied");
    // Remove the glow after 1 second.
    setTimeout(() => {
      btn.classList.remove("member-copied");
    }, 1000);
    console.log("Control-click: Copied member info:", info);
  }).catch((err) => {
    console.error("Error copying member info:", err);
  });
}

function selectMember(member, btn) {
  // If we are already editing a record (currentEditIndex !== null),
  // do not create a new row; simply update the member value.
  selectedMember = member;
  
  // Capture the starting time.
  let startingTime = getStartingTime();
  resetTimeMode();
  statementStartTime = startingTime;
  
  // Only if not editing, create a new row.
  if (currentEditIndex === null) {
    createNewRowInHistory();
  }
  
  updateStatement();

  // Highlight the selected member button.
  document.querySelectorAll("#members-container button").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function setMainAction(button, action) {
  console.log("setMainAction() called with action:", action);
  // For actions that do NOT require a member:
  if (action !== "Moved" && action !== "Seconded" && action !== "Introduced Bill") {
    let startingTime = getStartingTime();
    resetTimeMode();
    if (!inProgressRow) {
      statementStartTime = startingTime;
      createNewRowInHistory();
    }
  } else {
    // For member-based actions, ensure a member is selected.
    if ((action === "Moved" || action === "Seconded" || action === "Introduced Bill") && !selectedMember) {
      alert("Please select a member first for '" + action + "'!");
      return;
    }
    let startingTime = getStartingTime();
    resetTimeMode();
    if (!inProgressRow) {
      statementStartTime = startingTime;
      createNewRowInHistory();
    }
  }
  
  // Normalize mainAction for roll call votes.
  if (action.startsWith("Roll Call Vote on")) {
    if (action.includes("Amendment")) {
      mainAction = "Roll Call Vote on Amendment";
      selectedBillType = "Amendment";
    } else if (action.includes("Reconsider")) {
      mainAction = "Roll Call Vote on Reconsider";
      selectedBillType = "Reconsider";
    } else if (action.includes("SB")) {
      mainAction = "Roll Call Vote on Bill";
      selectedBillType = "SB";
    } else if (action.includes("HB")) {
      mainAction = "Roll Call Vote on Bill";
      selectedBillType = "HB";
    } else {
      mainAction = "Roll Call Vote on Bill";
      selectedBillType = "";
    }
  } else {
    mainAction = action;
  }
  
  // Clear and mark buttons.
  const allMainActionButtons = document.querySelectorAll("#mainActionsSection button");
  allMainActionButtons.forEach((b) => {
    b.classList.remove("selected");
    b.classList.remove("inactive");
  });
  button.classList.add("selected");
  allMainActionButtons.forEach((b) => {
    if (b !== button) {
      b.classList.add("inactive");
    }
  });
  
  // Set remaining globals.
  selectedSubAction = "";
  selectedCarrier = "";
  asAmended = false;
  voiceVoteOutcome = "";
  
  console.log("After setMainAction, globals:", {
    mainAction,
    selectedSubAction,
    selectedBillType,
    selectedCarrier,
    asAmended,
    voiceVoteOutcome
  });
  
  // Hide all optional sections.
  document.getElementById("meetingActionsSection").classList.add("hidden");
  document.getElementById("sub-actions").classList.add("hidden");
  document.getElementById("bill-type-section").classList.add("hidden");
  document.getElementById("vote-tally-section").classList.add("hidden");
  document.getElementById("bill-carrier-section").classList.add("hidden");
  // NEW: Always hide the As Amended section for voice votes.
  document.getElementById("as-amended-section").classList.add("hidden");
  document.getElementById("voice-vote-outcome-section").classList.add("hidden");
  document.getElementById("members-container").classList.remove("hidden");
  
  // Show sections based on action.
  if (action === "Moved") {
    showBillTypeSection(true);
  } else if (action.startsWith("Roll Call Vote on")) {
    document.getElementById("members-container").classList.add("hidden");
    showVoteTallySection(true);
    // Always show bill carrier if the selected bill type is SB or HB.
    if (selectedBillType === "SB" || selectedBillType === "HB") {
      showBillCarrierSection(true);
      // Also show "As Amended" section if SB.
      if (selectedBillType === "SB") {
        showAsAmendedSection(true);
      }
    } else {
      document.getElementById("bill-carrier-section").classList.add("hidden");
      document.getElementById("as-amended-section").classList.add("hidden");
    }
  } else if (action.startsWith("Voice Vote on")) {
    document.getElementById("members-container").classList.add("hidden");
    document.getElementById("voice-vote-outcome-section").classList.remove("hidden");
    // Always hide the "As Amended" section for voice votes.
    document.getElementById("as-amended-section").classList.add("hidden");
  }
  
  updateStatement();
}



/* "Moved" => sub-actions => "Do Pass" / "Do Not Pass" */
function showMovedSubActions() {
  const subActionsContainer = document.getElementById("sub-actions-container");
  subActionsContainer.innerHTML = "";
  document.getElementById("sub-actions").classList.remove("hidden");

  const subActions = ["Do Pass", "Do Not Pass"];
  subActions.forEach((subAction) => {
    const btn = document.createElement("button");
    btn.innerText = subAction;
    btn.onclick = () => handleMovedSubAction(btn, subAction);
    subActionsContainer.appendChild(btn);
  });
}

function handleMovedSubAction(button, subAction) {
  selectedSubAction = subAction;
  console.log("handleMovedSubAction() – selectedSubAction set to:", selectedSubAction);
  updateStatement();
  
  document.querySelectorAll("#sub-actions-container button").forEach((b) => b.classList.remove("selected"));
  button.classList.add("selected");
  
  document.getElementById("rerefer-section").classList.remove("hidden");
  selectedRereferCommittee = "";
  
  let isHouse = currentCommittee.toLowerCase().includes("house");
  let possibleCommittees = [];
  for (let cName in committees) {
    let cNameLower = cName.toLowerCase();
    if (isHouse && cNameLower.includes("house")) {
      possibleCommittees.push(cName);
    } else if (!isHouse && cNameLower.includes("senate")) {
      possibleCommittees.push(cName);
    }
  }
  
  const rereferSelect = document.getElementById("rereferCommitteeSelect");
  rereferSelect.innerHTML = "";
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "(No rerefer)";
  rereferSelect.appendChild(noneOpt);
  
  possibleCommittees.forEach((cName) => {
    const opt = document.createElement("option");
    opt.value = cName;
    opt.textContent = cName;
    rereferSelect.appendChild(opt);
  });
  
  rereferSelect.onchange = () => {
    selectedRereferCommittee = rereferSelect.value;
    console.log("Rerefer committee selected:", selectedRereferCommittee);
    updateStatement();
  };
}


// Bill Type => "SB", "HB", or "Amendment"
function showBillTypeSection(visible) {
  const billTypeSection = document.getElementById("bill-type-section");
  if (visible) {
    billTypeSection.classList.remove("hidden");
    const billTypeContainer = document.getElementById("bill-type-container");
    billTypeContainer.innerHTML = "";
    
    // If the current main action is "Moved" and the moved setting is off,
    // show a generic "Bill" button instead of SB/HB.
    let types;
    if (mainAction === "Moved" && !includeBillTypeInMoved) {
      types = ["Bill", "Amendment", "Reconsider"];
    } else {
      types = ["SB", "HB", "Amendment", "Reconsider"];
    }
    
    types.forEach((t) => {
      const btn = document.createElement("button");
      btn.innerText = t;
      btn.onclick = () => selectBillType(t, btn);
      billTypeContainer.appendChild(btn);
    });
  } else {
    billTypeSection.classList.add("hidden");
  }
}


function selectBillType(type, btn) {
  selectedBillType = type;
  console.log("selectBillType() – selectedBillType set to:", selectedBillType);
  updateStatement();
  
  // Highlight the selected bill type.
  document.querySelectorAll("#bill-type-container button").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
  
  // For SB, HB, or Bill, show sub-actions (e.g., "Do Pass" / "Do Not Pass")
  if (type === "SB" || type === "HB" || type === "Bill") {
    showMovedSubActions();
  } else {
    document.getElementById("sub-actions").classList.add("hidden");
    document.getElementById("rerefer-section").classList.add("hidden");
    selectedRereferCommittee = "";
  }
}



// "As Amended" for Roll Call Vote on SB
function showAsAmendedSection(visible) {
  const asAmendedSec = document.getElementById("as-amended-section");
  if (visible) {
    asAmendedSec.classList.remove("hidden");
  } else {
    asAmendedSec.classList.add("hidden");
  }
}

function toggleAsAmended(btn) {
  asAmended = !asAmended;
  if (asAmended) {
    btn.classList.add("selected");
  } else {
    btn.classList.remove("selected");
  }
  updateStatement();
}

// Vote Tally
// Modify showVoteTallySection so it resets only when not editing:
function showVoteTallySection(visible) {
  const tallySec = document.getElementById("vote-tally-section");
  if (visible) {
    tallySec.classList.remove("hidden");
    if (rollCallUseMemberNames) {
      showRollCallMemberButtons();
    } else {
      // In non–member button mode, if not editing, reset the plus/minus counts.
      if (currentEditIndex === null) {
        resetVoteTally();
      }
      // (Assume your existing plus–minus controls remain in the HTML.)
    }
  } else {
    tallySec.classList.add("hidden");
  }
}

// --- Roll Call Vote Button Functions ---
function showRollCallMemberButtons(existingVotes) {
  const tallySec = document.getElementById("vote-tally-section");
  tallySec.classList.remove("hidden"); // Ensure the section is visible
  tallySec.innerHTML = ""; // Clear previous content

  // Create a container for roll call member buttons.
  const container = document.createElement("div");
  container.id = "rollCallMembersContainer";
  container.style.margin = "5px 0";

  // Get the committee members.
  const members = committees[currentCommittee] || [];
  
  // Initialize vote counts.
  let countFor = 0, countAgainst = 0;
  
  members.forEach(member => {
    const btn = document.createElement("button");
    btn.innerText = member;
    btn.dataset.vote = "neutral";
    btn.style.backgroundColor = "#007bff"; // blue for neutral
    btn.style.color = "#fff";
    btn.style.margin = "2px";
    btn.style.border = "none";
    btn.style.padding = "5px 10px";
    btn.style.cursor = "pointer";

    // If existingVotes data is available, mark the button accordingly.
    if (existingVotes) {
      if (
        existingVotes.for &&
        existingVotes.for.some(vote => namesMatch(vote, member))
      ) {
        btn.dataset.vote = "for";
        btn.style.backgroundColor = "green";
        countFor++;
      } else if (
        existingVotes.against &&
        existingVotes.against.some(vote => namesMatch(vote, member))
      ) {
        btn.dataset.vote = "against";
        btn.style.backgroundColor = "red";
        countAgainst++;
      }
    }
    
    // Allow the user to cycle the vote state.
    btn.addEventListener("click", function() {
      let currentVote = btn.dataset.vote;
      if (currentVote === "neutral") {
        btn.dataset.vote = "for";
        btn.style.backgroundColor = "green";
      } else if (currentVote === "for") {
        btn.dataset.vote = "against";
        btn.style.backgroundColor = "red";
      } else {
        btn.dataset.vote = "neutral";
        btn.style.backgroundColor = "#007bff";
      }
      recalcRollCallVotes();
    });
    
    container.appendChild(btn);
  });
  
  tallySec.appendChild(container);
  
  // Create and add the vote counts display.
  const countsDiv = document.createElement("div");
  countsDiv.id = "rollCallCounts";
  countsDiv.style.marginTop = "10px";
  countsDiv.style.fontWeight = "bold";
  tallySec.appendChild(countsDiv);
  
  // Calculate remaining neutral votes.
  const totalMembers = members.length;
  neutralVal = totalMembers - (countFor + countAgainst);
  forVal = countFor;
  againstVal = countAgainst;
  updateVoteTallyDisplay();
}

function recalcRollCallVotes() {
  const container = document.getElementById("rollCallMembersContainer");
  let countFor = 0, countAgainst = 0, countNeutral = 0;
  let votesForArr = [];
  let votesAgainstArr = [];
  container.querySelectorAll("button").forEach(btn => {
    const vote = btn.dataset.vote;
    if (vote === "for") {
      countFor++;
      votesForArr.push(btn.innerText);
    } else if (vote === "against") {
      countAgainst++;
      votesAgainstArr.push(btn.innerText);
    } else {
      countNeutral++;
    }
  });
  forVal = countFor;
  againstVal = countAgainst;
  neutralVal = countNeutral;
  updateVoteTallyDisplay();
  
  // Update the in-progress row's vote data and update tooltip on the statement cell.
  if (inProgressRow && statementCell) {
    const votesObj = { for: votesForArr, against: votesAgainstArr };
    inProgressRow.dataset.votes = JSON.stringify(votesObj);
    updateRowVoteTooltip(statementCell, votesObj);
    attachTooltipToElement(statementCell);
  }
  
  updateStatement();
}


function updateVoteTallyDisplay() {
  // First, try updating the roll call counts display (if it exists).
  const countsDiv = document.getElementById("rollCallCounts");
  if (countsDiv) {
    countsDiv.innerText = `For: ${forVal}   Against: ${againstVal}   Neutral: ${neutralVal}`;
  } else {
    // Fallback to existing elements (for plus–minus UI)
    let forCountEl = document.getElementById("forCount");
    let againstCountEl = document.getElementById("againstCount");
    let neutralCountEl = document.getElementById("neutralCount");
    if (forCountEl && againstCountEl && neutralCountEl) {
         forCountEl.innerText = forVal;
         againstCountEl.innerText = againstVal;
         neutralCountEl.innerText = neutralVal;
    }
  }
}

// Bill Carrier
function showBillCarrierSection(visible) {
  const carrierSection = document.getElementById("bill-carrier-section");
  if (visible) {
    carrierSection.classList.remove("hidden");
    const carrierContainer = document.getElementById("bill-carrier-container");
    carrierContainer.innerHTML = "";

    committees[currentCommittee].forEach((member) => {
      const btn = document.createElement("button");
      btn.innerText = member;
      btn.onclick = () => selectBillCarrier(member, btn);
      carrierContainer.appendChild(btn);
    });
  } else {
    carrierSection.classList.add("hidden");
  }
}

function selectBillCarrier(member, btn) {
  selectedCarrier = member;
  document
    .querySelectorAll("#bill-carrier-container button")
    .forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
  updateStatement();
}

// Tally increment/decrement
function incrementVote(type, isIncrement) {
  if (type === "for") {
    if (isIncrement) forVal++;
    else if (forVal > 0) forVal--;
  } else if (type === "against") {
    if (isIncrement) againstVal++;
    else if (againstVal > 0) againstVal--;
  } else if (type === "neutral") {
    if (isIncrement) neutralVal++;
    else if (neutralVal > 0) neutralVal--;
  }
  document.getElementById("forCount").innerText = forVal;
  document.getElementById("againstCount").innerText = againstVal;
  document.getElementById("neutralCount").innerText = neutralVal;

  updateStatement();
}

function getMotionResultText() {
  // ties are fail
  if (forVal > againstVal) {
    return "Motion Passed";
  } else {
    return "Motion Failed";
  }
}

function updateInProgressRow() {
  // If a row is in progress, update its statement cell.
  if (inProgressRow && statementCell) {
    statementCell.textContent = constructedStatement;
  }
  // If we have a record index, update the record fields from the current globals.
  if (inProgressRecordIndex !== null) {
    let rec = historyRecords[inProgressRecordIndex];
    rec.member = selectedMember;
    rec.mainAction = mainAction;
    rec.selectedSubAction = selectedSubAction;
    rec.selectedBillType = selectedBillType;
    rec.selectedCarrier = selectedCarrier;
    rec.asAmended = asAmended;
    rec.voiceVoteOutcome = voiceVoteOutcome;
    rec.forVal = forVal;
    rec.againstVal = againstVal;
    rec.neutralVal = neutralVal;
    rec.selectedRereferCommittee = selectedRereferCommittee;
    rec.statement = constructedStatement;
    console.log("updateInProgressRow() – updated record:", rec);
    saveHistoryToLocalStorage();
  }
}

// Build the statement
function updateStatement() {
  console.log("updateStatement() – current globals:", {
    selectedMember,
    mainAction,
    selectedSubAction,
    selectedBillType,
    selectedCarrier,
    asAmended,
    voiceVoteOutcome,
    selectedRereferCommittee
  });
  
  const actionsNotRequiringMember = [
    "Roll Call Vote on Amendment",
    "Roll Call Vote on Reconsider",
    "Voice Vote on SB",
    "Voice Vote on Amendment",
    "Voice Vote on Reconsider",
    "Motion Failed for lack of a second",
    "Motion for Do Pass failed for lack of a second",
    "Motion for Do Not Pass failed for lack of a second"
  ];
  
  if (!selectedMember && !mainAction.startsWith("Roll Call Vote on") && !actionsNotRequiringMember.includes(mainAction)) {
    document.getElementById("log").innerText = "[Click a member and an action]";
    return;
  }
  
  if (
    mainAction === "Motion Failed for lack of a second" ||
    mainAction === "Motion for Do Pass failed for lack of a second" ||
    mainAction === "Motion for Do Not Pass failed for lack of a second"
  ) {
    constructedStatement = mainAction;
    document.getElementById("log").innerText = constructedStatement;
    updateInProgressRow();
    autoCopyIfEnabled();
    return;
  }
  
  if (selectedMember && !mainAction) {
    constructedStatement = applyUseLastNamesOnly(selectedMember);
    document.getElementById("log").innerText = constructedStatement;
    updateInProgressRow();
    autoCopyIfEnabled();
    return;
  }
  
  let parts = [];
  
  if (mainAction.startsWith("Roll Call Vote on")) {
    let actionText = "Roll Call Vote";
    // If the selected bill type is Amendment or Reconsider, use it directly.
    if (selectedBillType === "Amendment" || selectedBillType === "Reconsider") {
      actionText += " on " + selectedBillType;
    }
    // Otherwise, if the include setting is on, try to get the bill type.
    else if (includeBillTypeInRollCall) {
      let billType = getPreviousBillType();
      if (!billType && selectedBillType) {
        billType = selectedBillType;
      }
      if (billType) {
        actionText += " on " + billType;
        if (billType === "SB" && asAmended) {
          actionText += " as Amended";
        }
      }
    }
    parts.push(actionText);
    parts.push(getMotionResultText());
    parts.push(`${forVal}-${againstVal}-${neutralVal}`);
    // Include carrier text only for SB votes.
    if (selectedBillType === "SB" && selectedCarrier) {
      let carrierName = useLastNamesOnly ? applyUseLastNamesOnly(selectedCarrier) : selectedCarrier;
      parts.push(`${carrierName} Carried the Bill`);
    }
  }
  else if (mainAction.startsWith("Voice Vote on")) {
    let actionText = mainAction;
    if (mainAction === "Voice Vote on SB" && asAmended) {
      actionText = "Voice Vote on SB as Amended";
    }
    parts.push(actionText);
    if (voiceVoteOutcome) {
      parts.push(`Motion ${voiceVoteOutcome}`);
    } else {
      parts.push("[Pick Passed/Failed]");
    }
  }
  else if (mainAction === "Moved") {
    parts.push(applyUseLastNamesOnly(selectedMember));
    if (selectedBillType === "Reconsider") {
      parts.push("Moved to Reconsider");
    } else if (selectedBillType === "Amendment") {
      parts.push("Moved Amendment");
    } else if (includeBillTypeInMoved) {
      if (selectedBillType) {
        if (selectedBillType === "SB" || selectedBillType === "HB") {
          if (selectedSubAction) {
            parts.push(`Moved ${selectedSubAction} on ${selectedBillType}`);
          } else {
            parts.push(`Moved on ${selectedBillType}`);
          }
        } else {
          parts.push(`Moved ${selectedBillType}`);
        }
      } else if (selectedSubAction) {
        parts.push(`Moved ${selectedSubAction}`);
      } else {
        parts.push("Moved");
      }
    } else {
      if (selectedSubAction) {
        parts.push(`Moved ${selectedSubAction}`);
      } else {
        parts.push("Moved");
      }
    }
    if (selectedRereferCommittee) {
      parts.push(`and rereferred to ${selectedRereferCommittee}`);
    }
  }
  // NEW branch for Proposed Amendment and Proposed Verbal Amendment
  else if (
    mainAction === "Seconded" ||
    mainAction === "Introduced Bill" ||
    mainAction === "Proposed Amendment" ||
    mainAction === "Proposed Verbal Amendment"
  ) {
    let formattedMember = applyUseLastNamesOnly(selectedMember);
    parts.push(formattedMember);
    parts.push(mainAction);
  }
  else if (mainAction === "Withdrew") {
    let formattedMember = applyUseLastNamesOnly(selectedMember);
    parts.push(formattedMember);
    parts.push("Withdrew Motion");
  }
  
  constructedStatement = parts.length ? parts.join(" - ") : "[Click a member and an action]";
  document.getElementById("log").innerText = constructedStatement;
  updateInProgressRow();
  autoCopyIfEnabled();
  console.log("updateStatement() – constructedStatement:", constructedStatement);
}




function resetVoteTally() {
  // For the plus–minus UI mode.
  forVal = 0;
  againstVal = 0;
  neutralVal = 0;
  let forCountEl = document.getElementById("forCount");
  let againstCountEl = document.getElementById("againstCount");
  let neutralCountEl = document.getElementById("neutralCount");
  if (forCountEl && againstCountEl && neutralCountEl) {
    forCountEl.innerText = 0;
    againstCountEl.innerText = 0;
    neutralCountEl.innerText = 0;
  }
}

// Meeting actions
function appendMeetingAction(action) {
  if (!meetingActionsWithoutMember && !selectedMember) {
    alert("Please select a member first!");
    return;
  }
  
  if (meetingActionsWithoutMember) {
    // With the setting enabled, simply use the action text.
    constructedStatement = action;
  } else {
    let formattedMember = applyUseLastNamesOnly(selectedMember);
    if (action === "Seconded") {
      constructedStatement = `${formattedMember} Seconded`;
    } else {
      constructedStatement = `${formattedMember} - ${action}`;
    }
  }
  
  // Immediately insert the statement into history.
  insertHearingStatementDirect(constructedStatement);
  autoCopyIfEnabled();
}



function setVoiceVoteOutcome(outcome) {
  voiceVoteOutcome = outcome; // "Passed" or "Failed"
  // Highlight whichever button was clicked:
  document.querySelectorAll("#voice-vote-outcome-section button")
    .forEach(btn => btn.classList.remove("selected"));

  // Mark the chosen button as selected
  const buttons = document.querySelectorAll("#voice-vote-outcome-section button");
  for (let btn of buttons) {
    if (btn.textContent.includes(outcome)) {
      btn.classList.add("selected");
      break;
    }
  }

  // Update the final statement
  updateStatement();
  autoCopyIfEnabled();
}


/* -------------
   Copy to Clipboard
   ------------- */
function copyToClipboard(highlight = true) {
  if (
    !constructedStatement ||
    constructedStatement.startsWith("[Click a member")
  ) {
    return;
  }
  // Remove commas before copying.
  navigator.clipboard.writeText(constructedStatement.replace(/,/g, "")).then(() => {
    if (highlight) {
      const log = document.getElementById("log");
      log.classList.add("copied");
      setTimeout(() => log.classList.remove("copied"), 1000);
    }
  });
}


/* -------------
   Reset Logic
   ------------- */
// "Reset All"
function resetAllAndFinalize() {
  if (
    constructedStatement &&
    constructedStatement !== "[Click a member and an action]" &&
    constructedStatement.trim() !== ""
  ) {
    updateInProgressRow();
    // (The record is already in historyRecords thanks to auto-saving.)
  }
  if (inProgressRow) {
    inProgressRow.remove();
  }
  finalizeInProgressRow();
  resetSelections();
  loadHistoryFromLocalStorage();
  // Clear the in-progress record index now that we've finalized
  inProgressRecordIndex = null;
}


// The main reset
function resetSelections(finalize = true) {
  if (
    finalize &&
    constructedStatement &&
    constructedStatement !== "[Click a member and an action]" &&
    constructedStatement.trim() !== ""
  ) {
    updateInProgressRow();
  }
  if (finalize) {
    finalizeInProgressRow();
  }

  selectedMember = "";
  mainAction = "";
  selectedSubAction = "";
  selectedBillType = "";
  selectedCarrier = "";
  asAmended = false;
  constructedStatement = "";

  resetVoteTally();

  // Hide relevant sections
  document.getElementById("sub-actions").classList.add("hidden");
  document.getElementById("bill-type-section").classList.add("hidden");
  document.getElementById("vote-tally-section").classList.add("hidden");
  document.getElementById("bill-carrier-section").classList.add("hidden");
  document.getElementById("as-amended-section").classList.add("hidden");
  document.getElementById("rerefer-section").classList.add("hidden");
  selectedRereferCommittee = "";

  // Remove .selected and .inactive from all main-action buttons
  document.querySelectorAll("#mainActionsSection button").forEach((b) => {
    b.classList.remove("selected");
    b.classList.remove("inactive");
  });

  // Reset log text
  document.getElementById("log").innerText = "[Click a member and an action]";
  document.getElementById("members-container").classList.remove("hidden");
  document.getElementById("meetingActionsSection").classList.remove("hidden");

  inProgressRecordIndex = null;
}


function saveHistoryToLocalStorage() {
  localStorage.setItem("historyRecords", JSON.stringify(historyRecords));
}

// UPDATED loadHistoryFromLocalStorage (for finalized records)
function loadHistoryFromLocalStorage() {
  let stored = localStorage.getItem("historyRecords");
  if (stored) {
    historyRecords = JSON.parse(stored);
    const tableBody = document.getElementById("historyTableBody");
    tableBody.innerHTML = "";

    for (let i = 0; i < historyRecords.length; i++) {
      let record = historyRecords[i];
      let tr = document.createElement("tr");

      if (record.votes) {
        tr.dataset.votes = JSON.stringify(record.votes);
        // Instead of updating the entire row, we will update the tooltip on the statement cell later.
        console.log("create tool tip~");
      }
      
      if (record.member) {
        tr.setAttribute("data-member", record.member);
      }
      if (record.fileLink) {
        tr.dataset.fileLink = record.fileLink;
      }

      // Time cell as an editable field
      let tdTime = document.createElement("td");
      tdTime.textContent = record.time;
      tdTime.contentEditable = "true";
      tdTime.classList.add("clickable");
      tdTime.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          tdTime.blur();
        }
      });
      tdTime.addEventListener("blur", function () {
        let newTime = tdTime.textContent.trim();
        let timeRegex = /^(0?[1-9]|1[0-2]):[0-5]\d:[0-5]\d\s+(AM|PM)$/i;
        if (timeRegex.test(newTime)) {
          record.time = newTime;
          saveHistoryToLocalStorage();
        } else {
          alert("Invalid time format. Please enter time in the format H:mm:ss AM/PM (e.g., 5:15:32 PM).");
          tdTime.textContent = record.time;
        }
      });
      tdTime.addEventListener("click", function () {
        navigator.clipboard.writeText(tdTime.textContent.replace(/,/g, "")).then(() => {
          tdTime.classList.add("copied-cell");
          setTimeout(() => {
            tdTime.classList.remove("copied-cell");
          }, 800);
        });
      });
      tr.appendChild(tdTime);

      // Statement cell – attach tooltip only here.
      let tdStatement = document.createElement("td");
      tdStatement.textContent = record.statement;
      tdStatement.classList.add("clickable");
      tdStatement.addEventListener("click", function () {
        navigator.clipboard.writeText(tdStatement.textContent.replace(/,/g, "")).then(() => {
          tdStatement.classList.add("copied-cell");
          setTimeout(() => {
            tdStatement.classList.remove("copied-cell");
          }, 800);
        });
      });
      // If this record has vote data, update and attach the tooltip to tdStatement.
      if (record.votes) {
        updateRowVoteTooltip(tdStatement, record.votes);
        attachTooltipToElement(tdStatement);
      }
      tr.appendChild(tdStatement);

      // Time Control cell with adjust buttons and now/marked buttons.
      let tdTimeControl = document.createElement("td");
      tdTimeControl.style.whiteSpace = "nowrap";
      function createAdjustButton(label, secondsToAdjust) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.classList.add("copy-row-button");
        btn.onclick = () => {
          let timeDate = new Date("1970-01-01 " + tdTime.textContent);
          timeDate.setSeconds(timeDate.getSeconds() + secondsToAdjust);
          let newTimeStr = timeDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          tdTime.textContent = newTimeStr;
          record.time = newTimeStr;
          saveHistoryToLocalStorage();
          btn.classList.add("copied-cell");
          setTimeout(() => {
            btn.classList.remove("copied-cell");
          }, 800);
        };
        return btn;
      }
      const minusDiv = document.createElement("div");
      minusDiv.classList.add("time-control-group");
      minusDiv.appendChild(createAdjustButton("-5s", -5));
      minusDiv.appendChild(createAdjustButton("-3s", -3));
      minusDiv.appendChild(createAdjustButton("-1s", -1));

      const plusDiv = document.createElement("div");
      plusDiv.classList.add("time-control-group");
      plusDiv.appendChild(createAdjustButton("+1s", +1));
      plusDiv.appendChild(createAdjustButton("+3s", +3));
      plusDiv.appendChild(createAdjustButton("+5s", +5));

      const nowDiv = document.createElement("div");
      nowDiv.classList.add("time-control-group");
      const nowBtn = document.createElement("button");
      nowBtn.textContent = "Now";
      nowBtn.classList.add("copy-row-button");
      nowBtn.onclick = () => {
        const newTimeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        tdTime.textContent = newTimeStr;
        record.time = newTimeStr;
        saveHistoryToLocalStorage();
        nowBtn.classList.add("copied-cell");
        setTimeout(() => {
          nowBtn.classList.remove("copied-cell");
        }, 800);
      };
      nowDiv.appendChild(nowBtn);

      // *** Added extra button for "Marked" time ***
      const markedBtn = document.createElement("button");
      markedBtn.textContent = "Marked";
      markedBtn.classList.add("copy-row-button");
      markedBtn.onclick = () => {
        if (timeModeTime) {
          tdTime.textContent = timeModeTime;
          record.time = timeModeTime;
          saveHistoryToLocalStorage();
          markedBtn.classList.add("copied-cell");
          setTimeout(() => {
            markedBtn.classList.remove("copied-cell");
          }, 800);
        } else {
          alert("No marked time set.");
        }
      };
      nowDiv.appendChild(markedBtn);

      tdTimeControl.appendChild(minusDiv);
      tdTimeControl.appendChild(plusDiv);
      tdTimeControl.appendChild(nowDiv);
      tr.appendChild(tdTimeControl);

      // Delete cell
      let tdDelete = document.createElement("td");
      let btnDelete = document.createElement("button");
      btnDelete.textContent = "X";
      btnDelete.classList.add("copy-row-button");
      btnDelete.style.backgroundColor = "#dc3545";
      btnDelete.onclick = function () {
        historyRecords.splice(i, 1);
        saveHistoryToLocalStorage();
        loadHistoryFromLocalStorage();
      };
      tdDelete.appendChild(btnDelete);
      tr.appendChild(tdDelete);

      // Edit cell with an edit button.
      let tdEdit = document.createElement("td");
      let editButton = document.createElement("button");
      editButton.textContent = "✏️";
      editButton.classList.add("copy-row-button");
      editButton.style.backgroundColor = "#ffc107";
      editButton.onclick = function() {
        editHistoryRecord(i);
      };
      tdEdit.appendChild(editButton);
      tr.appendChild(tdEdit);

      addCtrlClickHandler(tr);
      tableBody.appendChild(tr);
    }
  }
}




function clearHistory() {
  localStorage.removeItem("historyRecords");
  historyRecords = [];
  document.getElementById("historyTableBody").innerHTML = "";
}

function cancelCurrentAction() {
  console.log("cancelCurrentAction invoked. currentEditIndex:", currentEditIndex, "inProgressRecordIndex:", inProgressRecordIndex);
  // If in edit mode, exit edit mode without deleting anything.
  if (currentEditIndex !== null) {
    console.log("Edit mode active. Exiting edit mode without deletion.");
    currentEditIndex = null;
    inProgressRecordIndex = null; // clear any in-progress index
    document.getElementById("log").style.border = "none";
    // Restore member button functionality
    updateMembers();
    return;
  }
  
  // If no in-progress row exists, do nothing.
  if (!inProgressRow && inProgressRecordIndex === null) {
    console.log("No in-progress record exists. Nothing to cancel.");
    return;
  }
  
  // Otherwise, delete the in-progress record.
  if (inProgressRecordIndex !== null && inProgressRecordIndex < historyRecords.length) {
    console.log("Deleting in-progress record at index:", inProgressRecordIndex);
    historyRecords.splice(inProgressRecordIndex, 1);
    saveHistoryToLocalStorage();
  }
  
  if (inProgressRow) {
    inProgressRow.remove();
  }
  finalizeInProgressRow();
  resetSelections(false);
  
  constructedStatement = "";
  document.getElementById("log").innerText = "[Click a member and an action]";
  console.log("cancelCurrentAction completed.");

  // Ensure that after canceling, the members container is re-enabled.
  updateMembers();
}



function loadCommitteesFromLocalStorage() {
  let stored = localStorage.getItem("allCommittees");
  if (stored) {
    // Parse and use that data
    return JSON.parse(stored);
  } else {
    // If not present, use default committees
    const defaultCommittees = {
      energy: [
        "Chairman Dale Patton",
        "Vice Chairman Greg Kessel",
        "Senator Todd Beard",
        "Senator Keith Boehm",
        "Senator Mark Enget",
        "Senator Justin Gerhardt",
        "Senator Desiree Van Oosting"
      ],
      judiciary: [
        "Chairwoman Diane Larson",
        "Vice Chairman Bob Paulson",
        "Senator Jose Castaneda",
        "Senator Claire Cory",
        "Senator Larry Luick",
        "Senator Janne Myrdal",
        "Senator Ryan Braunberger"
      ]
    };
    localStorage.setItem("allCommittees", JSON.stringify(defaultCommittees));
    return defaultCommittees;
  }
}

function saveCommitteesToLocalStorage() {
  localStorage.setItem("allCommittees", JSON.stringify(committees));
}

function toggleManageCommitteesModal() {
  const modal = document.getElementById("manageCommitteesModal");
  modal.classList.toggle("hidden");
  // Clear inputs or refresh the list
  refreshCommitteeListUI();
}

function closeManageCommitteesModal() {
  const modal = document.getElementById("manageCommitteesModal");
  modal.classList.add("hidden");
}

function refreshCommitteeListUI() {
  const container = document.getElementById("committeeListContainer");
  container.innerHTML = ""; // Clear existing

  for (let committeeName in committees) {
    // Create a heading
    const h4 = document.createElement("h4");
    h4.textContent = committeeName;
    container.appendChild(h4);

    // A list or table of members
    const ul = document.createElement("ul");
    committees[committeeName].forEach((member, index) => {
      const li = document.createElement("li");
      li.textContent = member; // e.g. "Chairwoman Diane Larson"

      // Edit button
      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.style.marginLeft = "10px";
      // CALL the function properly
      editBtn.onclick = () => editMember(committeeName, index);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.textContent = "Delete";
      delBtn.style.marginLeft = "5px";
      delBtn.onclick = () => deleteMember(committeeName, index);

      li.appendChild(editBtn);
      li.appendChild(delBtn);
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }
}


function addOrUpdateMember() {
  // Convert to lowercase
  let committeeName = document.getElementById("committeeNameInput").value.trim().toLowerCase();
  const memberName = document.getElementById("memberNameInput").value.trim();
  const role = document.getElementById("memberRoleSelect").value; // "chair", "vice", "regular"

  if (!committeeName || !memberName) {
    alert("Please enter both committee name and member name.");
    return;
  }

  let displayName = memberName;
  if (role === "chair") {
    displayName = "Chairman " + memberName;
  } else if (role === "vice") {
    displayName = "Vice Chairman " + memberName;
  }

  if (!committees[committeeName]) {
    committees[committeeName] = [];
  }

  // If we only want ONE chair or vice per committee
  if (role === "chair" || role === "vice") {
    removeExistingChairOrVice(committeeName, role);
  }

  if (editMode) {
    committees[editCommitteeName][Index] = displayName;
    editMode = false;
    editCommitteeName = null;
    Index = null;
  } else {
    committees[committeeName].push(displayName);
  }

  saveCommitteesToLocalStorage();
  refreshCommitteeListUI();

  // Clear inputs
  document.getElementById("committeeNameInput").value = "";
  document.getElementById("memberNameInput").value = "";
  document.getElementById("memberRoleSelect").value = "regular";
}


function removeExistingChairOrVice(committeeName, role) {
  // If the user is adding a "chair," remove any existing "Chairman" or "Chairwoman"
  // If the user is adding a "vice," remove any existing "Vice" name
  // This ensures only one chair / one vice in that committee
  const isChair = (role === "chair");
  committees[committeeName] = committees[committeeName].filter(member => {
    if (isChair) {
      return !(member.includes("Chairman") || member.includes("Chairwoman"));
    } else {
      return !member.includes("Vice");
    }
  });
}

function editMember(committeeName, index) {
  editMode = true;
  editCommitteeName = committeeName;
  editMemberIndex = index;

  const memberFull = committees[committeeName][index];
  // e.g. "Chairwoman Diane Larson" or "Vice Chairwoman Kathy Hogan" or "Senator John Doe" or "Representative Jane Smith"

  // By default, assume "regular" unless we detect chair/vice text
  let role = "regular";
  let namePart = memberFull;

  // Check "Vice Chairwoman" first, then "Chairwoman",
  // then "Vice Chairman", then "Chairman"
  if (memberFull.includes("Vice Chairwoman")) {
    role = "vice";
    namePart = memberFull.replace("Vice Chairwoman ", "");
  } 
  else if (memberFull.includes("Chairwoman")) {
    role = "chair";
    namePart = memberFull.replace("Chairwoman ", "");
  } 
  else if (memberFull.includes("Vice Chairman")) {
    role = "vice";
    namePart = memberFull.replace("Vice Chairman ", "");
  } 
  else if (memberFull.includes("Chairman")) {
    role = "chair";
    namePart = memberFull.replace("Chairman ", "");
  }
  
  // If it starts with "Senator "
  else if (namePart.startsWith("Senator ")) {
    namePart = namePart.replace("Senator ", "");
  }
  // Or if it starts with "Representative "
  else if (namePart.startsWith("Representative ")) {
    namePart = namePart.replace("Representative ", "");
  }

  // Populate the form fields
  document.getElementById("committeeNameInput").value = committeeName;
  document.getElementById("memberNameInput").value = namePart.trim();
  document.getElementById("memberRoleSelect").value = role;

  // Show the modal if it's hidden
  const modal = document.getElementById("manageCommitteesModal");
  modal.classList.remove("hidden");

  // Optionally refresh the list so the user sees the current data
  refreshCommitteeListUI();
}




function deleteMember(committeeName, index) {
  committees[committeeName].splice(index, 1);
  // If removing the last member from a committee, you may want to remove the committee entirely
  if (committees[committeeName].length === 0) {
    delete committees[committeeName];
  }
  saveCommitteesToLocalStorage();
  refreshCommitteeListUI();
}

function populateCommitteeSelect() {
  const select = document.getElementById("committeeSelect");
  select.innerHTML = "";
  // For each committee name, add an <option>
  for (let committeeName in committees) {
    const opt = document.createElement("option");
    opt.value = committeeName;
    opt.textContent = toTitleCase(committeeName);
    select.appendChild(opt);
  }
}

function toTitleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setDefaultCommittees() {
  /**
   * If your "defaultCommittees.js" is loaded,
   * then `window.DEFAULT_COMMITTEES` and `window.FEMALE_NAMES` should exist.
   * Otherwise, fall back to a short "mini" version below as a demonstration.
   */

  const fallbackFemaleNames = [
    "Diane Larson", "Kathy Hogan", "Judy Lee" // etc...
  ];

  let fallbackCommittees = {
    // A short demo version of committees, just so you can see the structure:
    "Senate Demo Committee": [
      "Someone - Chairman",
      "Someone Else - Vice Chairman",
      "Another Person"
    ],
    "House Demo Committee": [
      "Somebody - Chairman",
      "Different Person - Vice Chairman"
    ]
  };

  // Use the large data from defaultCommittees.js if available,
  // otherwise fall back to the short "demo" version:
  let rawCommittees = window.DEFAULT_COMMITTEES || fallbackCommittees;
  let femaleNames = window.FEMALE_NAMES || fallbackFemaleNames;

  // We'll build a new object "transformedCommittees"
  let transformedCommittees = {};

  // For each committee, transform each line
  for (let committeeName in rawCommittees) {
    let members = rawCommittees[committeeName].map(line =>
      transformMemberLine(line, committeeName, femaleNames)
    );
    transformedCommittees[committeeName] = members;
  }

  // Assign it to our global committees
  committees = transformedCommittees;

  // Now do the usual saves + refresh
  saveCommitteesToLocalStorage();
  refreshCommitteeListUI();
  populateCommitteeSelect();
  updateMembers();

  alert("Default committees have been set!");
}

function transformMemberLine(line, committeeName, femaleNames) {
  // Trim any leading/trailing spaces
  let trimmed = line.trim();

  // Check for " - Chairman"
  if (trimmed.endsWith("- Chairman")) {
    let namePart = trimmed.replace("- Chairman", "").trim();
    // If female
    if (femaleNames.includes(namePart)) {
      return "Chairwoman " + namePart;
    } else {
      return "Chairman " + namePart;
    }
  }
  // Check for " - Vice Chairman"
  else if (trimmed.endsWith("- Vice Chairman")) {
    let namePart = trimmed.replace("- Vice Chairman", "").trim();
    if (femaleNames.includes(namePart)) {
      return "Vice Chairwoman " + namePart;
    } else {
      return "Vice Chairman " + namePart;
    }
  }
  // Otherwise: fallback to "Senator" or "Representative"
  else {
    // Remove any trailing dashes or extra spaces
    let namePart = trimmed.replace(/^-+|-+$/g, "").trim();

    // If the committee name includes "house" => "Representative"
    // otherwise => "Senator"
    if (committeeName.toLowerCase().includes("house")) {
      return "Representative " + namePart;
    } else {
      return "Senator " + namePart;
    }
  }
}

function openSettingsModal() {
  // Set the checkboxes to the current settings
  document.getElementById("useLastNamesCheckbox").checked = useLastNamesOnly;
  document.getElementById("meetingActionsWithoutMemberCheckbox").checked = meetingActionsWithoutMember;
  document.getElementById("includeBillTypeInRollCallCheckbox").checked = includeBillTypeInRollCall;
  document.getElementById("includeBillTypeInMovedCheckbox").checked = includeBillTypeInMoved;
  document.getElementById("forceSenatorTermsCheckbox").checked = forceSenatorTerms;
  // NEW: Set the roll call votes option checkbox.
  document.getElementById("rollCallUseMemberNamesCheckbox").checked = rollCallUseMemberNames;
  
  document.getElementById("settingsModal").classList.remove("hidden");
}


function closeSettingsModal() {
  document.getElementById("settingsModal").classList.add("hidden");
}

function saveSettings() {
  useLastNamesOnly = document.getElementById("useLastNamesCheckbox").checked;
  localStorage.setItem("useLastNamesOnly", useLastNamesOnly);
  
  meetingActionsWithoutMember = document.getElementById("meetingActionsWithoutMemberCheckbox").checked;
  localStorage.setItem("meetingActionsWithoutMember", meetingActionsWithoutMember);
  
  includeBillTypeInRollCall = document.getElementById("includeBillTypeInRollCallCheckbox").checked;
  localStorage.setItem("includeBillTypeInRollCall", includeBillTypeInRollCall);
  
  includeBillTypeInMoved = document.getElementById("includeBillTypeInMovedCheckbox").checked;
  localStorage.setItem("includeBillTypeInMoved", includeBillTypeInMoved);
  
  forceSenatorTerms = document.getElementById("forceSenatorTermsCheckbox").checked;
  localStorage.setItem("forceSenatorTerms", forceSenatorTerms);
  
  rollCallUseMemberNames = document.getElementById("rollCallUseMemberNamesCheckbox").checked;
  localStorage.setItem("rollCallUseMemberNames", rollCallUseMemberNames);
  
  closeSettingsModal();
  console.log("Settings saved. useLastNamesOnly =", useLastNamesOnly,
              "meetingActionsWithoutMember =", meetingActionsWithoutMember,
              "includeBillTypeInRollCall =", includeBillTypeInRollCall,
              "includeBillTypeInMoved =", includeBillTypeInMoved,
              "forceSenatorTerms =", forceSenatorTerms,
              "rollCallUseMemberNames =", rollCallUseMemberNames);
}


// Attach event listener to the settings button.
document.getElementById("settingsBtn").addEventListener("click", openSettingsModal);


// --- Lookup Members Modal Functions ---

// Open the Lookup Members modal
function openLookupMembersModal() {
  document.getElementById("lookupMembersModal").classList.remove("hidden");
  document.getElementById("lookupInput").value = "";
  document.getElementById("lookupResults").innerHTML = "";
  document.getElementById("lookupInput").focus();
}

// Close the Lookup Members modal
function closeLookupMembersModal() {
  document.getElementById("lookupMembersModal").classList.add("hidden");
}

function openTestimonyModal() {
  if (editingTestimonyIndex !== null) {
    document.getElementById("submitTestimonyButton").textContent = "Save Changes";
  } else {
    document.getElementById("submitTestimonyButton").textContent = "Add Testimony";
  }
  document.getElementById("testimonyModal").classList.remove("hidden");
}

function closeTestimonyModal() {
  // Reset the editing flag if needed
  editingTestimonyIndex = null;
  // Reset the submit button text to default
  document.getElementById("submitTestimonyButton").textContent = "Add Testimony";
  document.getElementById("testimonyModal").classList.add("hidden");
}


// Called when the user clicks the "Add Testimony" button in the modal.
function submitTestimonyModal() {
  // Get values from the modal input fields.
  const firstName = document.getElementById("testimonyFirstName").value.trim();
  const lastName = document.getElementById("testimonyLastName").value.trim();
  const role = document.getElementById("testimonyRole").value.trim();
  const organization = document.getElementById("testimonyOrganization").value.trim();
  const testimonyPosition = document.getElementById("testimonyPosition").value;
  const testimonyNumber = document.getElementById("testimonyNumber").value.trim();
  // NEW: Get the link value.
  const testimonyLink = document.getElementById("testimonyLink").value.trim();
  
  // Only testimony position is required.
  if (!testimonyPosition) {
    alert("Testimony position is required.");
    return;
  }
  
  // Build the testimony string.
  const parts = [];
  if (firstName || lastName) {
    parts.push(`${firstName}${firstName && lastName ? ' ' : ''}${lastName}`);
  }
  if (role || organization) {
    parts.push(`${role}${role && organization ? ' ' : ''}${organization}`);
  }
  parts.push(testimonyPosition);
  if (testimonyNumber) {
    parts.push(`Testimony#${testimonyNumber}`);
  }
  const testimonyString = parts.join(" - ");
  
  // Create a testimony details object.
  const testimonyDetails = {
    firstName,
    lastName,
    role,
    organization,
    position: testimonyPosition,
    number: testimonyNumber
  };
  
  if (editingTestimonyIndex !== null) {
    let record = historyRecords[editingTestimonyIndex];
    record.statement = testimonyString;
    record.testimony = testimonyDetails;
    // Save the link in the record (it will also be passed to insertHearingStatementDirect).
    record.fileLink = testimonyLink;
    constructedStatement = testimonyString;
    saveHistoryToLocalStorage();
    loadHistoryFromLocalStorage();
    editingTestimonyIndex = null;  // reset edit flag
  } else {
    // Pass the link as part of the object so that insertHearingStatementDirect saves it.
    insertHearingStatementDirect({ 
      text: testimonyString, 
      isTestimony: true, 
      testimony: testimonyDetails,
      link: testimonyLink
    });
  }
  
  // Close and clear the modal.
  closeTestimonyModal();
  document.getElementById("testimonyFirstName").value = "";
  document.getElementById("testimonyLastName").value = "";
  document.getElementById("testimonyRole").value = "";
  document.getElementById("testimonyOrganization").value = "";
  document.getElementById("testimonyPosition").value = "";
  document.getElementById("testimonyNumber").value = "";
  document.getElementById("testimonyLink").value = "";
}



// Attach click event to the Lookup Members button
document.getElementById("lookupMembersBtn").addEventListener("click", openLookupMembersModal);

// When the user types in the lookup input, filter the members
document.getElementById("lookupInput").addEventListener("keyup", function() {
  const query = this.value.trim().toLowerCase();
  const resultsDiv = document.getElementById("lookupResults");
  resultsDiv.innerHTML = ""; // Clear previous results

  // If the query is empty, do nothing further.
  if (!query) return;

  // Loop through the keys in memberInfoMapping.
  // (Assuming memberInfoMapping is already loaded via loadMemberInfoXML().)
  const matchingMembers = Object.keys(memberInfoMapping).filter(memberName => {
    // Remove common prefixes for a friendlier search.
    let normalized = memberName.replace(/^(Senator|Representative|Chairman|Chairwoman|Vice Chairman|Vice Chairwoman)\s+/i, "");
    return normalized.toLowerCase().includes(query);
  });

  if (matchingMembers.length === 0) {
    resultsDiv.innerHTML = "<p>No matching members found.</p>";
    return;
  }

  // Create a list of matching results.
  matchingMembers.forEach(memberName => {
     // Create a container for this result
     const itemDiv = document.createElement("div");
     itemDiv.style.display = "flex";
     itemDiv.style.justifyContent = "space-between";
     itemDiv.style.alignItems = "center";
     itemDiv.style.padding = "5px 0";
     itemDiv.style.borderBottom = "1px solid #eee";
   
     // Create a span to hold the member's name.
     const nameSpan = document.createElement("span");
     nameSpan.textContent = memberName;
     
     // *** NEW: Clicking the name copies the member name to the clipboard.
     nameSpan.addEventListener("click", () => {
       navigator.clipboard.writeText(memberName).then(() => {
         // Temporarily change the background to a light green to indicate success.
         nameSpan.style.backgroundColor = "#d4edda";
         setTimeout(() => {
           nameSpan.style.backgroundColor = "";
         }, 1000);
       }).catch(err => {
         console.error("Failed to copy member name:", err);
       });
     });
     
     itemDiv.appendChild(nameSpan);
   
     // Create a "Copy" button (if you still want to keep this button)
     const copyBtn = document.createElement("button");
     copyBtn.textContent = "Copy Member Info";
     copyBtn.style.marginLeft = "10px";
     copyBtn.style.padding = "5px 8px";
     copyBtn.style.fontSize = "12px";
     copyBtn.addEventListener("click", (e) => {
       // Prevent the event from bubbling up to the nameSpan click.
       e.stopPropagation();
       let info = memberInfoMapping[memberName];
       if (!info) info = memberName; // fallback if info missing
       navigator.clipboard.writeText(info).then(() => {
         copyBtn.textContent = "Copied!";
         setTimeout(() => {
           copyBtn.textContent = "Copy Member Info";
         }, 1000);
       }).catch(err => {
         console.error("Failed to copy member info:", err);
       });
     });
     itemDiv.appendChild(copyBtn);
   
     // Create an "Introduced Bill" shortcut button.
     const introBtn = document.createElement("button");
     introBtn.textContent = "Introduced Bill";
     introBtn.style.marginLeft = "5px";
     introBtn.style.padding = "5px 8px";
     introBtn.style.fontSize = "12px";
     introBtn.addEventListener("click", (e) => {
         // Prevent the event from bubbling up so that the name click is not triggered.
         e.stopPropagation();
         selectedMember = memberName;
         let fullName = applyUseLastNamesOnly(memberName);
         let message = `${fullName} - Introduced Bill`;
         insertHearingStatementDirect(message);
         console.log("Introduced Bill entry added:", message);
         introBtn.textContent = "Added!";
         setTimeout(() => {
           introBtn.textContent = "Introduced Bill";
         }, 1000);
      });
     itemDiv.appendChild(introBtn);
   
     resultsDiv.appendChild(itemDiv);
   });

});


// --- KEYDOWN HANDLER ---
document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();
    console.log("CTRL+Enter detected – copying to clipboard.");
    copyToClipboard();
  }
  else if (event.key === "Enter") {
    event.preventDefault();
    if (currentEditIndex !== null) {
      console.log("Enter pressed in edit mode for record index:", currentEditIndex);
      finalizeEdit();
    } else {
      console.log("Enter pressed in new record mode – finalizing new record.");
      resetAllAndFinalize();
    }
  }
  else if (event.key === "Escape") {
    event.preventDefault();
    console.log("Escape key detected.");
    cancelCurrentAction();
  }
});


document.addEventListener("DOMContentLoaded", () => {
  // Initialization
  committees = loadCommitteesFromLocalStorage();
  populateCommitteeSelect();
  let storedCommittee = localStorage.getItem("selectedCommittee");
  if (storedCommittee && committees[storedCommittee]) {
    document.getElementById("committeeSelect").value = storedCommittee;
  }
  let storedAutoCopy = localStorage.getItem("autoCopyEnabled");
  if (storedAutoCopy !== null) {
    autoCopyEnabled = storedAutoCopy === "true";
    document.getElementById("autoCopyCheckbox").checked = autoCopyEnabled;
  }
  updateMembers();
  loadHistoryFromLocalStorage();
  
  // Load XML member info.
  loadMemberInfoXML();
  
  document.getElementById("addTestimonyBtn").addEventListener("click", openTestimonyModal);
  
  // Set up the log copy-on-click.
  const logElem = document.getElementById("log");
  logElem.addEventListener("click", () => {
    if (!constructedStatement || constructedStatement.startsWith("[Click a member")) {
      return;
    }
    navigator.clipboard.writeText(constructedStatement).then(() => {
      logElem.classList.add("copied");
      setTimeout(() => logElem.classList.remove("copied"), 1000);
    });
  });
  
  let storedMeetingActionsWithoutMember = localStorage.getItem("meetingActionsWithoutMember");
  if (storedMeetingActionsWithoutMember !== null) {
    meetingActionsWithoutMember = storedMeetingActionsWithoutMember === "true";
    document.getElementById("meetingActionsWithoutMemberCheckbox").checked = meetingActionsWithoutMember;
  }
});


// Listen for the backtick key (`) to toggle time mode.
document.addEventListener("keydown", (e) => {
  if (e.key === "`") {
    timeModeActivated = !timeModeActivated;
    if (timeModeActivated) {
      timeModeTime = getCurrentTimestamp();
      document.body.classList.add("time-mode");
      console.log("Time mode activated at", timeModeTime);
    } else {
      timeModeTime = null;
      document.body.classList.remove("time-mode");
      console.log("Time mode deactivated.");
    }
  }
});

// Inject CSS for the pulsing green effect.
const style = document.createElement("style");
style.textContent = `
  .time-mode {
    animation: pulseGreen 1s infinite;
  }
  @keyframes pulseGreen {
    0% { background-color: #d4edda; }
    50% { background-color: #c3e6cb; }
    100% { background-color: #d4edda; }
  }
`;
document.head.appendChild(style);


// This runs in the main page environment (the same environment as your "script.js" functions).
window.addEventListener("message", function (event) {
  // 1) Only handle messages from our own content script
  if (event.source !== window) return; // ignore if from an iframe
  if (!event.data) return;
  if (event.data.source !== "CLERK_EXTENSION") return;

  // 2) Check the type
  if (event.data.type === "HEARING_STATEMENT") {
    let payload = event.data.payload;
    let rowText = "";
    // If the payload is an object, extract the text property; otherwise, convert it to string.
    if (typeof payload === "object" && payload !== null) {
      rowText = payload.text || "";
    } else {
      rowText = String(payload);
    }
    console.log("Page context received row text via postMessage:", rowText);

    // If the string contains "Testimony#", assume it's a testimony entry.
    if (rowText.includes("Testimony#")) {
      // Extract testimony details from the text.
      const testimonyDetails = parseTestimonyString(rowText);
      document.getElementById("testimonyFirstName").value = testimonyDetails.firstName || "";
      document.getElementById("testimonyLastName").value = testimonyDetails.lastName || "";
      document.getElementById("testimonyRole").value = testimonyDetails.role || "";
      document.getElementById("testimonyOrganization").value = testimonyDetails.organization || "";
      document.getElementById("testimonyPosition").value = testimonyDetails.position || "";
      document.getElementById("testimonyNumber").value = testimonyDetails.number || "";
      // NEW: Prefill the testimony link if provided.
      document.getElementById("testimonyLink").value = (payload.link) ? payload.link : "";

      editingTestimonyIndex = null;  // reset edit flag if needed
      openTestimonyModal();

      // Change the modal button text to "Save Changes"
      document.getElementById("submitTestimonyButton").textContent = "Save Changes";
    } else {
      insertHearingStatementDirect(rowText);
      window.scrollTo(0, document.body.scrollHeight);
    }
  }
});







