/* --------------------------
   Global Variables & Setup
   -------------------------- */
let historyRecords = [];

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

const committees = {
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

/* --------------------------
   Utility Functions
   -------------------------- */
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
  // Capture the current timestamp in a local variable.
  const recordTime = statementStartTime;
  const tableBody = document.getElementById("historyTableBody");
  inProgressRow = document.createElement("tr");

  // Time cell
  const localTimeCell = document.createElement("td");
  localTimeCell.textContent = recordTime;
  // Make the cell show a pointer cursor
  localTimeCell.classList.add("clickable");
   
  // When user clicks the time cell, copy the time to clipboard
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
  // Make the cell show a pointer cursor
  localStatementCell.classList.add("clickable");
   
  // When user clicks the statement cell, copy the statement to clipboard
  localStatementCell.addEventListener("click", function () {
    navigator.clipboard.writeText(localStatementCell.textContent).then(() => {
      localStatementCell.classList.add("copied-cell");
      setTimeout(() => {
        localStatementCell.classList.remove("copied-cell");
      }, 800);
    });
  });
  inProgressRow.appendChild(localStatementCell);

  // Create a cell to hold all the +/- time adjustment buttons
  const timeAdjustCell = document.createElement("td");
  timeAdjustCell.style.whiteSpace = "nowrap";

  // Helper to create a time adjustment button
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

  // Create +/- time adjustment buttons (split into two rows for aesthetics)
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

  timeAdjustCell.appendChild(minusDiv);
  timeAdjustCell.appendChild(plusDiv);

  inProgressRow.appendChild(timeAdjustCell);

  // Delete cell with a Delete button for live rows
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

  // Append the row to the table body
  tableBody.appendChild(inProgressRow);

  // Push the new record into historyRecords using recordTime
  inProgressRecordIndex = historyRecords.length;
  historyRecords.push({ time: recordTime, statement: constructedStatement });
  saveHistoryToLocalStorage();

  // Update global references for the in-progress row
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
  // If it's "Moved," you still require a member:
  if (action === "Moved" && !selectedMember) {
    alert("Please select a member first for 'Moved' actions!");
    return;
  }

  // If no row is in progress, we create a new one so the statement can appear
  if (!inProgressRow) {
    statementStartTime = getCurrentTimestamp();
    createNewRowInHistory();
  }

  mainAction = action;
  selectedSubAction = "";
  selectedBillType = "";
  selectedCarrier = "";
  asAmended = false;

  // Highlight the chosen main action
  document.querySelectorAll(".section:nth-of-type(2) button")
    .forEach((b) => b.classList.remove("selected"));
  button.classList.add("selected");

  // Hide the meeting actions area once a main action is chosen
  document.getElementById("meetingActionsSection").classList.add("hidden");

  if (action === "Roll Call Vote on SB" || action === "Roll Call Vote on Amendment") {
    // Hide members, show vote tally
    document.getElementById("members-container").classList.add("hidden");
    showVoteTallySection(true);

    if (action === "Roll Call Vote on SB") {
      showBillCarrierSection(true);
      showAsAmendedSection(true);
    } else {
      showBillCarrierSection(false);
      showAsAmendedSection(false);
    }
    // Hide sub-actions, bill-type
    document.getElementById("sub-actions").classList.add("hidden");
    document.getElementById("bill-type-section").classList.add("hidden");

  } else if (action === "Moved") {
    // Show committee members (member is required)
    document.getElementById("members-container").classList.remove("hidden");
    // Show Bill Type first (SB, HB, Amendment)
    showBillTypeSection(true);

    showVoteTallySection(false);
    showBillCarrierSection(false);
    showAsAmendedSection(false);

  } else {
    // For any other main action not roll call or moved
    document.getElementById("members-container").classList.remove("hidden");
    document.getElementById("sub-actions").classList.add("hidden");
    document.getElementById("bill-type-section").classList.add("hidden");
    showVoteTallySection(false);
    showBillCarrierSection(false);
    showAsAmendedSection(false);
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
  updateStatement();

  // Highlight the chosen sub action
  document.querySelectorAll("#sub-actions-container button")
    .forEach((b) => b.classList.remove("selected"));
  button.classList.add("selected");

  // REMOVE any calls to showBillTypeSection here if it existed
  // (We now pick Bill Type before sub-actions)
  // showBillTypeSection(true); // <-- remove this if still present
}

// Bill Type => "SB", "HB", or "Amendment"
function showBillTypeSection(visible) {
  const billTypeSection = document.getElementById("bill-type-section");
  if (visible) {
    billTypeSection.classList.remove("hidden");
    const billTypeContainer = document.getElementById("bill-type-container");
    billTypeContainer.innerHTML = "";

    const types = ["SB", "HB", "Amendment"];
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
  // If a member is selected but no main action has been chosen,
  // immediately set the constructed statement to the member's name.
  if (selectedMember && !mainAction) {
    constructedStatement = selectedMember;
    document.getElementById("log").innerText = constructedStatement;
    updateInProgressRow();
    autoCopyIfEnabled();
    return;
  }

  // Allow no selectedMember only if mainAction is a roll call vote.
  if (
    !selectedMember &&
    mainAction !== "Roll Call Vote on SB" &&
    mainAction !== "Roll Call Vote on Amendment"
  ) {
    document.getElementById("log").innerText = "[Click a member and an action]";
    return;
  }

  let parts = [];

  // Roll Call Votes
  if (
    mainAction === "Roll Call Vote on SB" ||
    mainAction === "Roll Call Vote on Amendment"
  ) {
    let actionText = mainAction;
    if (mainAction === "Roll Call Vote on SB" && asAmended) {
      actionText = "Roll Call Vote on SB as Amended";
    }
    parts.push(actionText);
    parts.push(getMotionResultText());
    parts.push(`${forVal}-${againstVal}-${neutralVal}`);
    if (actionText.includes("SB") && selectedCarrier) {
      parts.push(`${selectedCarrier} Carried the Bill`);
    }
  }
  // Moved
  else if (mainAction === "Moved") {
    parts.push(selectedMember);
    if (selectedBillType) {
      if (selectedBillType === "Amendment") {
        parts.push(`Moved ${selectedBillType}`);
      } else {
        if (selectedSubAction) {
          parts.push(`Moved ${selectedSubAction} on ${selectedBillType}`);
        } else {
          parts.push(`Moved on ${selectedBillType}`);
        }
      }
    } else if (selectedSubAction) {
      parts.push(`Moved ${selectedSubAction}`);
    } else {
      parts.push("Moved");
    }
  }
  // Other main actions
  else if (mainAction) {
    parts.push(`${selectedMember} - ${mainAction}`);
  }

  if (parts.length === 0) {
    constructedStatement = "[Click a member and an action]";
  } else {
    constructedStatement = parts.join(" - ");
  }

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

  // Remove .selected from all buttons
  document.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));

  // Reset log text
  document.getElementById("log").innerText = "[Click a member and an action]";
   
  // Show the committee members and meeting actions again
  document.getElementById("members-container").classList.remove("hidden");
  document.getElementById("meetingActionsSection").classList.remove("hidden");

  // Also clear the in-progress record index
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
       
      // Clicking the time cell copies the time to clipboard
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

      // Time Control cell with 6 adjustment buttons
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
          record.time = newTimeStr;  // update the record
          saveHistoryToLocalStorage();
          btn.classList.add("copied-cell");
          setTimeout(() => {
            btn.classList.remove("copied-cell");
          }, 800);
        };
        return btn;
      }

      // Two small groups for minus/plus
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

      tdTimeControl.appendChild(minusDiv);
      tdTimeControl.appendChild(plusDiv);

      tr.appendChild(tdTimeControl);

      // Delete cell with a Delete button
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
  // If there’s a row in progress, remove it from the DOM:
  if (inProgressRow) {
    inProgressRow.remove();
    finalizeInProgressRow(); // clears inProgressRow, timeCell, statementCell references
  }

  // Reset any local selections but pass false so we don’t finalize
  resetSelections(false);

  // Clear the statement from the log
  constructedStatement = "";
  document.getElementById("log").innerText = "[Click a member and an action]";
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

// On page load, check if a committee was saved from a previous session.
document.addEventListener("DOMContentLoaded", () => {
  let storedCommittee = localStorage.getItem("selectedCommittee");
  if (storedCommittee) {
    document.getElementById("committeeSelect").value = storedCommittee;
  }

  let storedAutoCopy = localStorage.getItem("autoCopyEnabled");
  if (storedAutoCopy !== null) {
    autoCopyEnabled = storedAutoCopy === "true";
    document.getElementById("autoCopyCheckbox").checked = autoCopyEnabled;
  }

  updateMembers();
  loadHistoryFromLocalStorage();
});


