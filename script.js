/* --------------------------
   Global Variables & Setup
   -------------------------- */
let historyRecords = [];

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

function createNewRowInHistory() {
  const tableBody = document.getElementById("historyTableBody");
  inProgressRow = document.createElement("tr");

  // Local references for time & statement cells
  const localTimeCell = document.createElement("td");
  localTimeCell.textContent = statementStartTime;
  inProgressRow.appendChild(localTimeCell);

  const localStatementCell = document.createElement("td");
  localStatementCell.textContent = constructedStatement;
  inProgressRow.appendChild(localStatementCell);

  // "Copy Time" (existing)
  const copyTimeCell = document.createElement("td");
  const copyTimeButton = document.createElement("button");
  copyTimeButton.textContent = "Copy Time";
  copyTimeButton.classList.add("copy-row-button");
  copyTimeButton.onclick = () => {
    navigator.clipboard.writeText(localTimeCell.textContent).then(() => {
      localTimeCell.classList.add("copied-cell");
      setTimeout(() => {
        localTimeCell.classList.remove("copied-cell");
      }, 800);
    });
  };
  copyTimeCell.appendChild(copyTimeButton);
  inProgressRow.appendChild(copyTimeCell);

  // "Copy Statement" (existing)
  const copyStatementCell = document.createElement("td");
  const copyStatementButton = document.createElement("button");
  copyStatementButton.textContent = "Copy Statement";
  copyStatementButton.classList.add("copy-row-button");
  copyStatementButton.onclick = () => {
    navigator.clipboard.writeText(localStatementCell.textContent).then(() => {
      localStatementCell.classList.add("copied-cell");
      setTimeout(() => {
        localStatementCell.classList.remove("copied-cell");
      }, 800);
    });
  };
  copyStatementCell.appendChild(copyStatementButton);
  inProgressRow.appendChild(copyStatementCell);

  // Create a single cell to hold all +/- time buttons
  const timeAdjustCell = document.createElement("td");
  timeAdjustCell.style.whiteSpace = "nowrap"; // Keep buttons on one line if you want

  // Helper to create a button
  function createTimeAdjustButton(label, secondsToAdjust) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.classList.add("copy-row-button");
    btn.onclick = () => {
      // Convert "1970-01-01 TIME"
      let timeDate = new Date("1970-01-01 " + localTimeCell.textContent);
      timeDate.setSeconds(timeDate.getSeconds() + secondsToAdjust); // +/- seconds

      // Reformat as HH:MM:SS
      const newTimeStr = timeDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      // Update permanent time in the cell
      localTimeCell.textContent = newTimeStr;

      // Show quick glow
      btn.classList.add("copied-cell");
      setTimeout(() => {
        btn.classList.remove("copied-cell");
      }, 800);
    };
    return btn;
  }

  // Create all 6 time adjust buttons
  const minus5 = createTimeAdjustButton("-5s", -5);
  const minus3 = createTimeAdjustButton("-3s", -3);
  const minus1 = createTimeAdjustButton("-1s", -1);
  const plus1 = createTimeAdjustButton("+1s", +1);
  const plus3 = createTimeAdjustButton("+3s", +3);
  const plus5 = createTimeAdjustButton("+5s", +5);

  // Append them in a row
  timeAdjustCell.appendChild(minus5);
  timeAdjustCell.appendChild(minus3);
  timeAdjustCell.appendChild(minus1);
  timeAdjustCell.appendChild(plus1);
  timeAdjustCell.appendChild(plus3);
  timeAdjustCell.appendChild(plus5);
  inProgressRow.appendChild(timeAdjustCell);

  // Finally append the row
  tableBody.appendChild(inProgressRow);

  // Update global references so we can still update the "in-progress" row
  timeCell = localTimeCell;
  statementCell = localStatementCell;
}




function updateInProgressRow() {
  if (inProgressRow && statementCell) {
    statementCell.textContent = constructedStatement;
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
  // If turning ON and we have a statement
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
  resetSelections();

  const membersContainer = document.getElementById("members-container");
  membersContainer.innerHTML = "";
  committees[currentCommittee].forEach((member) => {
    const btn = document.createElement("button");
    btn.innerText = member;
    btn.onclick = () => selectMember(member, btn);
    membersContainer.appendChild(btn);
  });
}

function selectMember(member, btn) {
  // If there's a statement in progress, finalize it first
  if (
    constructedStatement &&
    constructedStatement !== "[Click a member and an action]" &&
    constructedStatement.trim() !== ""
  ) {
    updateInProgressRow();
    finalizeInProgressRow();
  }
  // Now reset
  resetSelections(false);

  // Start new statement
  selectedMember = member;
  statementStartTime = getCurrentTimestamp();
  // Create new row in history for in-progress
  createNewRowInHistory();

  updateStatement();

  // Highlight selected member
  document
    .querySelectorAll("#members-container button")
    .forEach((b) => b.classList.remove("selected"));
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
  // Allow no selectedMember if mainAction is a roll call vote
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
      // If the bill type is Amendment, we don't require a sub-action.
      if (selectedBillType === "Amendment") {
        parts.push(`Moved ${selectedBillType}`);
      } else {
        // For SB or HB, if a sub-action is chosen, use it; otherwise, still show the bill type.
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
    updateInProgressRow(); // finalize the in-progress row

    // Create a record object with the (possibly adjusted) time and the constructed statement.
    let record = {
      time: timeCell ? timeCell.textContent : statementStartTime,
      statement: constructedStatement
    };

    // Add the record to the history array and save to local storage.
    historyRecords.push(record);
    saveHistoryToLocalStorage();
  }
  finalizeInProgressRow();
  resetSelections();
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
   
  // Show the committee members again
  document.getElementById("members-container").classList.remove("hidden");
  // Show the meeting actions again
  document.getElementById("meetingActionsSection").classList.remove("hidden");
}

function saveHistoryToLocalStorage() {
  localStorage.setItem("historyRecords", JSON.stringify(historyRecords));
}

function loadHistoryFromLocalStorage() {
  let stored = localStorage.getItem("historyRecords");
  if (stored) {
    historyRecords = JSON.parse(stored);
    const tableBody = document.getElementById("historyTableBody");
    tableBody.innerHTML = "";
    historyRecords.forEach(record => {
      let tr = document.createElement("tr");

      // Time cell
      let tdTime = document.createElement("td");
      tdTime.textContent = record.time;
      tr.appendChild(tdTime);

      // Statement cell
      let tdStatement = document.createElement("td");
      tdStatement.textContent = record.statement;
      tr.appendChild(tdStatement);

      // "Copy Time" cell + button
      let tdCopyTime = document.createElement("td");
      let btnCopyTime = document.createElement("button");
      btnCopyTime.textContent = "Copy Time";
      btnCopyTime.classList.add("copy-row-button");
      btnCopyTime.onclick = () => {
        navigator.clipboard.writeText(record.time).then(() => {
          tdTime.classList.add("copied-cell");
          setTimeout(() => {
            tdTime.classList.remove("copied-cell");
          }, 800);
        });
      };
      tdCopyTime.appendChild(btnCopyTime);
      tr.appendChild(tdCopyTime);

      // "Copy Statement" cell + button
      let tdCopyStatement = document.createElement("td");
      let btnCopyStatement = document.createElement("button");
      btnCopyStatement.textContent = "Copy Statement";
      btnCopyStatement.classList.add("copy-row-button");
      btnCopyStatement.onclick = () => {
        navigator.clipboard.writeText(record.statement).then(() => {
          tdStatement.classList.add("copied-cell");
          setTimeout(() => {
            tdStatement.classList.remove("copied-cell");
          }, 800);
        });
      };
      tdCopyStatement.appendChild(btnCopyStatement);
      tr.appendChild(tdCopyStatement);

      // Time Control cell: Create 6 buttons (-5s, -3s, -1s, +1s, +3s, +5s)
      let tdTimeControl = document.createElement("td");
      tdTimeControl.style.whiteSpace = "nowrap";
      
      function createAdjustButton(label, secondsToAdjust) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.classList.add("copy-row-button");
        btn.onclick = () => {
          // Parse the stored time (assuming format "HH:MM:SS")
          let timeDate = new Date("1970-01-01 " + tdTime.textContent);
          timeDate.setSeconds(timeDate.getSeconds() + secondsToAdjust);
          let newTimeStr = timeDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
          // Update the cell text and also update the record's time in memory
          tdTime.textContent = newTimeStr;
          record.time = newTimeStr;
          // Save the updated history to local storage
          saveHistoryToLocalStorage();
          btn.classList.add("copied-cell");
          setTimeout(() => {
            btn.classList.remove("copied-cell");
          }, 800);
        };
        return btn;
      }
      
      // Create adjustment buttons
      tdTimeControl.appendChild(createAdjustButton("-5s", -5));
      tdTimeControl.appendChild(createAdjustButton("-3s", -3));
      tdTimeControl.appendChild(createAdjustButton("-1s", -1));
      tdTimeControl.appendChild(createAdjustButton("+1s", +1));
      tdTimeControl.appendChild(createAdjustButton("+3s", +3));
      tdTimeControl.appendChild(createAdjustButton("+5s", +5));
      tr.appendChild(tdTimeControl);

      tableBody.appendChild(tr);
    });
  }
}

function clearHistory() {
  localStorage.removeItem("historyRecords");
  historyRecords = [];
  document.getElementById("historyTableBody").innerHTML = "";
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

// Initialize on page load
updateMembers();
loadHistoryFromLocalStorage();

