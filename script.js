/* --------------------------
   Global Variables & Setup
   -------------------------- */
let historyRecords = [];

// Global variable for XML member info mapping:
let memberInfoMapping = {};

let inProgressRecordIndex = null; // track the current record in historyRecords..

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
        // Build a key – for example, "Representative B. Anderson"
        let fullName = (firstName + " " + name).trim();
        // (If you prefer to key by last name only, you might instead use the surname.)
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
        memberInfoMapping[fullName] = memberInfoStr;
      }
      console.log("Member info mapping loaded:", memberInfoMapping);
    })
    .catch(err => {
      console.error("Failed to load member info XML:", err);
    });
}

// 3. Helper function to get member info for a given member name.
// It first tries an exact match and then falls back to matching by the last name.
function getMemberInfoForMember(member) {
  if (!member) return "";
  // Try exact match.
  if (memberInfoMapping && memberInfoMapping[member]) {
    return memberInfoMapping[member];
  }
  // Otherwise, attempt to match by surname (last word in the member name).
  let parts = member.split(" ");
  let surname = parts[parts.length - 1].trim();
  for (let key in memberInfoMapping) {
    if (key.trim().endsWith(surname)) {
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

function createNewRowInHistory() {
  // Capture the current timestamp.
  const recordTime = statementStartTime;
  const tableBody = document.getElementById("historyTableBody");
  inProgressRow = document.createElement("tr");

  // If a member is selected, store it as a data attribute on the row.
  if (selectedMember) {
    inProgressRow.setAttribute("data-member", selectedMember);
  }

  // Time cell
  const localTimeCell = document.createElement("td");
  localTimeCell.textContent = recordTime;
  localTimeCell.classList.add("clickable");
  localTimeCell.addEventListener("click", function () {
    navigator.clipboard.writeText(localTimeCell.textContent).then(() => {
      localTimeCell.classList.add("copied-cell");
      setTimeout(() => {
        localTimeCell.classList.remove("copied-cell");
      }, 800);
    });
  });
  inProgressRow.appendChild(localTimeCell);

  // Statement cell
  const localStatementCell = document.createElement("td");
  localStatementCell.textContent = constructedStatement;
  localStatementCell.classList.add("clickable");
  localStatementCell.addEventListener("click", function () {
    navigator.clipboard.writeText(localStatementCell.textContent).then(() => {
      localStatementCell.classList.add("copied-cell");
      setTimeout(() => {
        localStatementCell.classList.remove("copied-cell");
      }, 800);
    });
  });
  inProgressRow.appendChild(localStatementCell);

  // Create a cell for the +/- time adjustment buttons.
  const timeAdjustCell = document.createElement("td");
  timeAdjustCell.style.whiteSpace = "nowrap";

  // Helper to create a time adjustment button.
  function createTimeAdjustButton(label, secondsToAdjust) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.classList.add("copy-row-button");
    btn.onclick = () => {
      let timeDate = new Date("1970-01-01 " + localTimeCell.textContent);
      timeDate.setSeconds(timeDate.getSeconds() + secondsToAdjust);
      const newTimeStr = timeDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      localTimeCell.textContent = newTimeStr;
      btn.classList.add("copied-cell");
      setTimeout(() => {
        btn.classList.remove("copied-cell");
      }, 800);
    };
    return btn;
  }

  // Create the minus and plus groups.
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

  // "Now" button.
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
    nowBtn.classList.add("copied-cell");
    setTimeout(() => {
      nowBtn.classList.remove("copied-cell");
    }, 800);
  };
  nowDiv.appendChild(nowBtn);

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
    const row = this.closest("tr");
    if (row) {
      row.remove();
    }
    constructedStatement = "";
    finalizeInProgressRow();
  };
  deleteCell.appendChild(deleteButton);
  inProgressRow.appendChild(deleteCell);

  // Add a double-click event listener to the entire row.
  inProgressRow.addEventListener("dblclick", function () {
    // Highlight the row in yellow.
    inProgressRow.style.backgroundColor = "yellow";
    // Get the time (first cell) and statement (second cell).
    let timeStr = inProgressRow.cells[0].textContent;
    let statementStr = inProgressRow.cells[1].textContent;
    // Get the member name from the data attribute.
    let member = inProgressRow.getAttribute("data-member");
    // Look up member info from the XML mapping.
    let memberInfo = getMemberInfoForMember(member);
    // Build the final string.
    let finalString = timeStr + " | " + statementStr + " | " + memberInfo;
    // Copy the final string to the clipboard.
    navigator.clipboard.writeText(finalString).then(() => {
      // Remove yellow highlight after 1 second.
      setTimeout(() => {
        inProgressRow.style.backgroundColor = "";
      }, 1000);
    });
    console.log("Double-click copy:", finalString);
  });

  // Append the row and update history.
  tableBody.appendChild(inProgressRow);
  inProgressRecordIndex = historyRecords.length;
  historyRecords.push({ time: recordTime, statement: constructedStatement });
  saveHistoryToLocalStorage();

  // Update global references.
  timeCell = localTimeCell;
  statementCell = localStatementCell;
}

function updateInProgressRow() {
  if (inProgressRow && statementCell) {
    statementCell.textContent = constructedStatement;
  }
  if (inProgressRecordIndex !== null) {
    // Update only the statement field; do not update time.
    historyRecords[inProgressRecordIndex].statement = constructedStatement;
    saveHistoryToLocalStorage();
  }
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
function insertHearingStatementDirect(statementText) {
  // 1) If there's an in-progress row, finalize it so we don't interfere
  if (inProgressRow !== null) {
    resetAllAndFinalize();
  }

  // 2) Set the "constructedStatement" to the new text
  constructedStatement = statementText;

  // 3) Record the start time (like selectMember does)
  statementStartTime = getCurrentTimestamp();

  // 4) Create a new row in the history
  createNewRowInHistory();

  // 5) Immediately finalize it if you want it to be a "done" row with no further editing:
  finalizeInProgressRow();

  // Or if you prefer to keep it “in‐progress”, remove that finalizeInProgressRow() call.
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
    btn.onclick = () => selectMember(member, btn);
    topDiv.appendChild(btn);
  });
  
  // Then vice chairs.
  groups.viceChairs.forEach(member => {
    const btn = document.createElement("button");
    btn.innerText = member;
    btn.onclick = () => selectMember(member, btn);
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
    btn.onclick = () => selectMember(member, btn);
    othersDiv.appendChild(btn);
  });
  membersContainer.appendChild(othersDiv);
}




function selectMember(member, btn) {
  // Finalize any in-progress record if one exists.
  if (inProgressRecordIndex !== null) {
    resetAllAndFinalize();
  }
  // Reset UI selections without finalizing (we already finalized above)
  resetSelections(false);

  // Start a new statement with the newly selected member
  selectedMember = member;
  statementStartTime = getCurrentTimestamp();
  createNewRowInHistory();
  updateStatement();

  // Highlight the selected member button
  document.querySelectorAll("#members-container button").forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");
}

function setMainAction(button, action) {
  // 1) If it requires a member, check that
  if (action === "Moved" && !selectedMember) {
    alert("Please select a member first for 'Moved' actions!");
    return;
  }
  if (action === "Seconded" && !selectedMember) {
    alert("Please select a member first for 'Seconded' action!");
    return;
  }
  if (action === "Introduced Bill" && !selectedMember) {
    alert("Please select a member first for 'Introduced Bill'!");
    return;
  }

  // 2) If no row is in progress, create it
  if (!inProgressRow) {
    statementStartTime = getCurrentTimestamp();
    createNewRowInHistory();
  }

  // 3) Clear old selections from all main-action buttons
  const allMainActionButtons = document.querySelectorAll("#mainActionsSection button");
  allMainActionButtons.forEach((b) => {
    b.classList.remove("selected");
    b.classList.remove("inactive");
  });

  // Mark the clicked button as selected (green)
  button.classList.add("selected");

  // Fade out (inactive) the others
  allMainActionButtons.forEach((b) => {
    if (b !== button) {
      b.classList.add("inactive");
    }
  });

  // 4) Reset some global states
  mainAction = action;
  selectedSubAction = "";
  selectedBillType = "";
  selectedCarrier = "";
  asAmended = false;
  voiceVoteOutcome = "";

  // 5) Hide the meeting actions area once a main action is chosen
  document.getElementById("meetingActionsSection").classList.add("hidden");

  // 6) Hide all dynamic sections by default
  document.getElementById("sub-actions").classList.add("hidden");
  document.getElementById("bill-type-section").classList.add("hidden");
  document.getElementById("vote-tally-section").classList.add("hidden");
  document.getElementById("bill-carrier-section").classList.add("hidden");
  document.getElementById("as-amended-section").classList.add("hidden");
  document.getElementById("voice-vote-outcome-section").classList.add("hidden");
  document.getElementById("members-container").classList.remove("hidden");

  // 7) Decide what sections to show based on action
  if (action === "Moved") {
    showBillTypeSection(true);
  }
  else if (action === "Roll Call Vote on SB") {
    document.getElementById("members-container").classList.add("hidden");
    showVoteTallySection(true);
    showBillCarrierSection(true);
    showAsAmendedSection(true);
  }
  else if (action === "Roll Call Vote on Amendment") {
    document.getElementById("members-container").classList.add("hidden");
    showVoteTallySection(true);
  }
  else if (action === "Roll Call Vote on Reconsider") {
    document.getElementById("members-container").classList.add("hidden");
    showVoteTallySection(true);
  }
  else if (action === "Voice Vote on SB") {
    document.getElementById("members-container").classList.add("hidden");
    document.getElementById("voice-vote-outcome-section").classList.remove("hidden");
    showAsAmendedSection(true);
  }
  else if (action === "Voice Vote on Amendment") {
    document.getElementById("members-container").classList.add("hidden");
    document.getElementById("voice-vote-outcome-section").classList.remove("hidden");
  }
  else if (action === "Voice Vote on Reconsider") {
    document.getElementById("members-container").classList.add("hidden");
    document.getElementById("voice-vote-outcome-section").classList.remove("hidden");
  }

  // 8) Build/update the constructed statement
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
  updateStatement();

  // Highlight the chosen sub action
  document.querySelectorAll("#sub-actions-container button")
    .forEach((b) => b.classList.remove("selected"));
  button.classList.add("selected");

  // Show the "rerefer" section
  document.getElementById("rerefer-section").classList.remove("hidden");

  // We can reset selectedRereferCommittee if we want
  selectedRereferCommittee = "";

  // Determine if it’s a House or Senate committee
  //  e.g. if currentCommittee name includes "house"
  let isHouse = currentCommittee.toLowerCase().includes("house");
  
  // Build a list of possible committees to rerefer to, either House or Senate
  let possibleCommittees = [];
  for (let cName in committees) {
    let cNameLower = cName.toLowerCase();
    // If we want to allow House -> House only, and Senate -> Senate only:
    if (isHouse && cNameLower.includes("house")) {
      possibleCommittees.push(cName);
    } else if (!isHouse && cNameLower.includes("senate")) {
      possibleCommittees.push(cName);
    }
  }
  
  // Populate the <select> with these committees
  const rereferSelect = document.getElementById("rereferCommitteeSelect");
  rereferSelect.innerHTML = "";
  
  // Add a "(No rerefer)" option
  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "(No rerefer)";
  rereferSelect.appendChild(noneOpt);

  // Add each possible committee
  possibleCommittees.forEach((cName) => {
    const opt = document.createElement("option");
    opt.value = cName;   // e.g. "Senate Appropriations Committee"
    opt.textContent = cName; // display the same
    rereferSelect.appendChild(opt);
  });
  
  // Listen for changes
  rereferSelect.onchange = () => {
    selectedRereferCommittee = rereferSelect.value; // store
    updateStatement(); // re-build the final statement
  };
}


// Bill Type => "SB", "HB", or "Amendment"
function showBillTypeSection(visible) {
  const billTypeSection = document.getElementById("bill-type-section");
  if (visible) {
    billTypeSection.classList.remove("hidden");
    const billTypeContainer = document.getElementById("bill-type-container");
    billTypeContainer.innerHTML = "";

    const types = ["SB", "HB", "Amendment", "Reconsider"];

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
  updateStatement();

  // Highlight the chosen bill type
  document.querySelectorAll("#bill-type-container button")
    .forEach((b) => b.classList.remove("selected"));
  btn.classList.add("selected");

  // If the user picked SB or HB, THEN show sub-actions (Do Pass / Do Not Pass).
  // If Amendment, skip sub-actions
  if (type === "SB" || type === "HB") {
    showMovedSubActions();  // "Do Pass" / "Do Not Pass"
  } else {
     // If it's "Amendment," hide sub-actions (no Do Pass / Do Not Pass for amendments)
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
function showVoteTallySection(visible) {
  const tallySec = document.getElementById("vote-tally-section");
  if (visible) {
    tallySec.classList.remove("hidden");
    resetVoteTally();
  } else {
    tallySec.classList.add("hidden");
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

// Build the statement
function updateStatement() {
  // If a member is selected but no main action has been chosen
  if (selectedMember && !mainAction) {
    constructedStatement = selectedMember;
    document.getElementById("log").innerText = constructedStatement;
    updateInProgressRow();
    autoCopyIfEnabled();
    return;
  }

  // Allow no selectedMember only if mainAction is one of the vote actions
  if (!selectedMember &&
      mainAction !== "Roll Call Vote on SB" &&
      mainAction !== "Roll Call Vote on Amendment" &&
      mainAction !== "Roll Call Vote on Reconsider" &&
      mainAction !== "Voice Vote on SB" &&
      mainAction !== "Voice Vote on Amendment" &&
      mainAction !== "Voice Vote on Reconsider"
  ) {
    document.getElementById("log").innerText = "[Click a member and an action]";
    return;
  }

  let parts = [];

  // 1) Roll Call Votes (SB, Amendment, Reconsider)
  if (mainAction.startsWith("Roll Call Vote on")) {
    let actionText = mainAction;

    // If "Roll Call Vote on SB as Amended"
    if (mainAction === "Roll Call Vote on SB" && asAmended) {
      actionText = "Roll Call Vote on SB as Amended";
    }

    parts.push(actionText);

    // Then the motion result, e.g. "Motion Passed" or "Motion Failed"
    // We can use your existing numeric logic + getMotionResultText()
    parts.push(getMotionResultText());
    // e.g. "7-0-0"
    parts.push(`${forVal}-${againstVal}-${neutralVal}`);

    // If it's SB (not "Amendment" or "Reconsider"), check for carrier
    if (actionText.includes("SB") && selectedCarrier) {
      parts.push(`${selectedCarrier} Carried the Bill`);
    }
  }

  // 2) Voice Vote (SB, Amendment, Reconsider)
  else if (mainAction.startsWith("Voice Vote on")) {
    let actionText = mainAction;

    // If "Voice Vote on SB as Amended"
    if (mainAction === "Voice Vote on SB" && asAmended) {
      actionText = "Voice Vote on SB as Amended";
    }

    parts.push(actionText);

    // Instead of a numeric tally, we do "Motion Passed" or "Motion Failed"
    // if the user picked one:
    if (voiceVoteOutcome) {
      parts.push(`Motion ${voiceVoteOutcome}`);
    } else {
      // If user hasn't clicked Passed/Failed yet, show placeholder:
      parts.push("[Pick Passed/Failed]");
    }
  }

  // 3) Moved
  else if (mainAction === "Moved") {
     parts.push(selectedMember);
   
     if (selectedBillType === "Reconsider") {
       parts.push("Moved to Reconsider");
     }
     else if (selectedBillType) {
       if (selectedBillType === "Amendment") {
         parts.push(`Moved ${selectedBillType}`);
       } else {
         if (selectedSubAction) {
           parts.push(`Moved ${selectedSubAction} on ${selectedBillType}`);
         } else {
           parts.push(`Moved on ${selectedBillType}`);
         }
       }
     }
     else if (selectedSubAction) {
       parts.push(`Moved ${selectedSubAction}`);
     }
     else {
       parts.push("Moved");
     }
   
     // *** NEW: If user picked a subAction AND a rerefer committee
     if (selectedSubAction && selectedRereferCommittee) {
       parts.push(`and rereferred to ${selectedRereferCommittee}`);
     }
  }

  // 4) Other main actions (e.g. "Seconded")
  else if (mainAction) {
    parts.push(`${selectedMember} - ${mainAction}`);
  }

  if (parts.length === 0) {
    constructedStatement = "[Click a member and an action]";
  } else {
    constructedStatement = parts.join(" - ");
  }

  // Show it on screen
  document.getElementById("log").innerText = constructedStatement;
  updateInProgressRow();
  autoCopyIfEnabled();
}


function resetVoteTally() {
  forVal = 0;
  againstVal = 0;
  neutralVal = 0;
  document.getElementById("forCount").innerText = 0;
  document.getElementById("againstCount").innerText = 0;
  document.getElementById("neutralCount").innerText = 0;
}

// Meeting actions
function appendMeetingAction(action) {
  if (!selectedMember) {
    alert("Please select a member first!");
    return;
  }
  if (action === "Seconded") {
    constructedStatement = `${selectedMember} Seconded`;
  } else {
    // e.g. "Senator Boehm - Introduced Bill"
    constructedStatement = `${selectedMember} - ${action}`;
  }
  document.getElementById("log").innerText = constructedStatement;
  updateInProgressRow();
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
  navigator.clipboard.writeText(constructedStatement).then(() => {
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

      // Time cell
      let tdTime = document.createElement("td");
      tdTime.textContent = record.time;
      tdTime.classList.add("clickable");
      
      // Clicking the time cell copies the time
      tdTime.addEventListener("click", function () {
        navigator.clipboard.writeText(tdTime.textContent).then(() => {
          tdTime.classList.add("copied-cell");
          setTimeout(() => {
            tdTime.classList.remove("copied-cell");
          }, 800);
        });
      });
      tr.appendChild(tdTime);

      // Statement cell
      let tdStatement = document.createElement("td");
      tdStatement.textContent = record.statement;
      tdStatement.classList.add("clickable");
      
      // Clicking the statement cell copies the statement
      tdStatement.addEventListener("click", function () {
        navigator.clipboard.writeText(tdStatement.textContent).then(() => {
          tdStatement.classList.add("copied-cell");
          setTimeout(() => {
            tdStatement.classList.remove("copied-cell");
          }, 800);
        });
      });
      tr.appendChild(tdStatement);

      // Time Control cell
      let tdTimeControl = document.createElement("td");
      tdTimeControl.style.whiteSpace = "nowrap";

      // Helper to create time adjustment button
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
          record.time = newTimeStr; // update the record
          saveHistoryToLocalStorage();
          btn.classList.add("copied-cell");
          setTimeout(() => {
            btn.classList.remove("copied-cell");
          }, 800);
        };
        return btn;
      }

      // Minus group
      const minusDiv = document.createElement("div");
      minusDiv.classList.add("time-control-group");
      minusDiv.appendChild(createAdjustButton("-5s", -5));
      minusDiv.appendChild(createAdjustButton("-3s", -3));
      minusDiv.appendChild(createAdjustButton("-1s", -1));

      // Plus group
      const plusDiv = document.createElement("div");
      plusDiv.classList.add("time-control-group");
      plusDiv.appendChild(createAdjustButton("+1s", +1));
      plusDiv.appendChild(createAdjustButton("+3s", +3));
      plusDiv.appendChild(createAdjustButton("+5s", +5));

      // NEW: The "Now" button for existing rows
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
        record.time = newTimeStr; // update the record
        saveHistoryToLocalStorage();
        nowBtn.classList.add("copied-cell");
        setTimeout(() => {
          nowBtn.classList.remove("copied-cell");
        }, 800);
      };
      nowDiv.appendChild(nowBtn);

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
      btnDelete.onclick = function() {
        historyRecords.splice(i, 1);
        saveHistoryToLocalStorage();
        loadHistoryFromLocalStorage();
      };
      tdDelete.appendChild(btnDelete);
      tr.appendChild(tdDelete);

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
  // If there's an in-progress record, remove it from historyRecords:
  if (inProgressRecordIndex !== null && inProgressRecordIndex < historyRecords.length) {
    historyRecords.splice(inProgressRecordIndex, 1);
    saveHistoryToLocalStorage();
  }

  // If there's a row in progress, remove it from the DOM:
  if (inProgressRow) {
    inProgressRow.remove();
  }

  // Clear references so we are no longer in "edit mode":
  finalizeInProgressRow();

  // Reset the UI selections without finalizing
  resetSelections(false);

  // Make sure the log text is set back to the placeholder
  constructedStatement = "";
  document.getElementById("log").innerText = "[Click a member and an action]";
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



// Support Ctrl + Enter to copy
document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.key === "Enter") {
    event.preventDefault();       // Stop default button activati
    copyToClipboard();
  }

   // If just Enter (without Ctrl), reset everything
  if (event.key === "Enter") {
    event.preventDefault();       // Stop default button activati
    resetAllAndFinalize();
  }

   // ESC => Cancel current in-progress action (no record saved~)
  if (event.key === "Escape") {
    event.preventDefault();
    cancelCurrentAction();
  }

});

document.addEventListener("DOMContentLoaded", () => {
  // (Your existing code at the bottom of DOMContentLoaded is fine, just add this inside)

  const logElem = document.getElementById("log");
  logElem.addEventListener("click", () => {
    if (
      !constructedStatement ||
      constructedStatement.startsWith("[Click a member")
    ) {
      return;
    }
    // Attempt to copy
    navigator.clipboard.writeText(constructedStatement).then(() => {
      logElem.classList.add("copied");
      setTimeout(() => logElem.classList.remove("copied"), 1000);
    });
  });
});


// On page load, check if a committee was saved from a previous session.
document.addEventListener("DOMContentLoaded", () => {
  // 1) Load committees
  committees = loadCommitteesFromLocalStorage();

  // 2) Populate the select
  populateCommitteeSelect();

  // 3) Load saved committee name from localStorage
  let storedCommittee = localStorage.getItem("selectedCommittee");
  if (storedCommittee && committees[storedCommittee]) {
    document.getElementById("committeeSelect").value = storedCommittee;
  }

  // 4) Load AutoCopy if any
  let storedAutoCopy = localStorage.getItem("autoCopyEnabled");
  if (storedAutoCopy !== null) {
    autoCopyEnabled = storedAutoCopy === "true";
    document.getElementById("autoCopyCheckbox").checked = autoCopyEnabled;
  }

  // 5) Update the member buttons for the selected or default committee
  updateMembers();

  // 6) Load previous statement history
  loadHistoryFromLocalStorage();
});

document.addEventListener("DOMContentLoaded", () => {
  // Existing initialization...
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

  // NEW: Load the XML member info.
  loadMemberInfoXML();
});


// This runs in the main page environment (the same environment as your "script.js" functions).
window.addEventListener("message", function (event) {
  // 1) Only handle messages from our own content script
  if (event.source !== window) return; // ignore if from an iframe
  if (!event.data) return;
  if (event.data.source !== "CLERK_EXTENSION") return;

  // 2) Check the type
  if (event.data.type === "HEARING_STATEMENT") {
    // This is your hearing row text
    const rowText = event.data.payload;
    console.log("Page context received row text via postMessage:", rowText);

    // 3) Now we CAN call your real function
    insertHearingStatementDirect(rowText); 
    // e.g. function that sets constructedStatement and calls createNewRowInHistory
  }
});


