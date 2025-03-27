// main5.js

import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";

// Global registry for class renderers.
const classRegistry = {};

// Register the default renderer.
const defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;

// Register our custom renderer for Rerefer_Committee_Module.
classRegistry["Rerefer_Committee_Module"] = new RereferCommitteeModule();

// flowData will be loaded externally.
let flowData = null;

// For this prototype, we start with the "Member" branch.
// Once the JSON is loaded, we extract the "Member" branch from the array.
fetch("flow5.json")
  .then(response => response.json())
  .then(data => {
    // Assuming the JSON is an array of objects, find the one with the "Member" key.
    for (let i = 0; i < data.length; i++) {
      if (data[i]["Member"]) {
        flowData = data[i]["Member"];
        break;
      }
    }
    // Initialize suggestions once the flow data is loaded.
    updateSuggestions();
  })
  .catch(error => {
    console.error("Error loading JSON:", error);
  });

// Array to store tokens (the path of choices).
let tokens = [];

// References to DOM elements.
const tokenContainer = document.getElementById("token-container");
const tokenInput = document.getElementById("token-input");
const suggestionsContainer = document.getElementById("suggestions-container");

/**
 * Traverse the flowData based on tokens to return the current branch data.
 * @returns {Object} The current branch data.
 */
function getCurrentBranchData() {
  if (!flowData) return {};
  let currentData = flowData;
  tokens.forEach(token => {
    if (currentData[token]) {
      currentData = currentData[token];
    } else {
      currentData = {};
    }
  });
  return currentData;
}

/**
 * Update the suggestions container based on the current branch and input.
 */
function updateSuggestions() {
  const query = tokenInput.value.trim();
  const branchData = getCurrentBranchData();
  const options = branchData["Options"] || [];

  // Choose renderer: if the branch defines a Class, use that; otherwise, default.
  let renderer;
  if (branchData["Class"]) {
    renderer = classRegistry[branchData["Class"]] || defaultRenderer;
  } else {
    renderer = defaultRenderer;
  }

  // Render the suggestion HTML using the chosen renderer.
  const html = renderer.render(options, query);
  suggestionsContainer.innerHTML = html;
}

/**
 * Add a token (a confirmed choice) to the tokenContainer.
 * @param {string} value - The selected option.
 */
function addToken(value) {
  // Create token span element.
  const tokenSpan = document.createElement("span");
  tokenSpan.className = "token";
  tokenSpan.textContent = value;
  tokenSpan.dataset.value = value;
  // Allow editing when the token is clicked.
  tokenSpan.addEventListener("click", tokenClickHandler);

  // Insert the token before the input field.
  tokenContainer.insertBefore(tokenSpan, tokenInput);

  // Save token.
  tokens.push(value);

  // Clear input, update suggestions, and re-focus.
  tokenInput.value = "";
  updateSuggestions();
  tokenInput.focus();
}

/**
 * When a token is clicked, remove it and any tokens after it, then set its value in the input for editing.
 */
function tokenClickHandler(e) {
  const tokenElements = Array.from(tokenContainer.querySelectorAll(".token"));
  const index = tokenElements.indexOf(e.currentTarget);
  if (index === -1) return;

  // Remove tokens from the DOM and tokens array.
  for (let i = tokenElements.length - 1; i >= index; i--) {
    tokenElements[i].remove();
    tokens.pop();
  }

  // Place the clicked token's value into the input.
  tokenInput.value = e.currentTarget.dataset.value;
  updateSuggestions();
  tokenInput.focus();
}

// Handle keydown events on the token input.
tokenInput.addEventListener("keydown", (e) => {
  // Backspace on empty input removes the last token.
  if (e.key === "Backspace" && tokenInput.value === "") {
    const tokenElements = Array.from(tokenContainer.querySelectorAll(".token"));
    if (tokenElements.length > 0) {
      const lastTokenEl = tokenElements[tokenElements.length - 1];
      lastTokenEl.remove();
      tokens.pop();
      updateSuggestions();
    }
    e.preventDefault();
  }
});

// On keyup, update suggestions. On Enter, add the first suggestion.
tokenInput.addEventListener("keyup", (e) => {
  if (e.key === "Enter") {
    const firstSuggestion = suggestionsContainer.querySelector("li");
    if (firstSuggestion) {
      addToken(firstSuggestion.dataset.value);
    }
    e.preventDefault();
    return;
  }
  updateSuggestions();
});

// Handle clicks on suggestion items.
suggestionsContainer.addEventListener("click", (e) => {
  if (e.target && e.target.nodeName === "LI") {
    addToken(e.target.dataset.value);
  }
});

// Hide suggestions if clicking outside the input or suggestions list,
// but only if the tokenInput is not focused.
document.addEventListener("click", (e) => {
  if (!suggestionsContainer.contains(e.target) && e.target !== tokenInput) {
    if (document.activeElement !== tokenInput) {
      suggestionsContainer.innerHTML = "";
    }
  }
});
