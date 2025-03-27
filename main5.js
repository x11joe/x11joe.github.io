// main5.js

// Global registry for class renderers.
var classRegistry = {};

// For the prototype, we register the default renderer.
var defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;

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
var tokens = [];

// References to DOM elements.
const tokenContainer = document.getElementById("token-container");
const tokenInput = document.getElementById("token-input");
const suggestionsContainer = document.getElementById("suggestions-container");

// Given the tokens selected so far, traverse the flowData to get the current options.
function getCurrentOptions() {
  if (!flowData) return [];
  let currentData = flowData;
  tokens.forEach(token => {
    if (currentData[token]) {
      currentData = currentData[token];
    } else {
      currentData = {};
    }
  });
  return currentData["Options"] || [];
}

// Render suggestions based on the current input and available options.
function updateSuggestions() {
  const query = tokenInput.value.trim();
  const options = getCurrentOptions();

  // Use the default renderer from the registry.
  // The renderer's render() method simply filters options based on the query.
  const suggestions = classRegistry["DefaultRenderer"].render(options, query);

  // Build suggestions list.
  let html = "<ul>";
  suggestions.forEach(option => {
    html += `<li data-value="${option}">${option}</li>`;
  });
  html += "</ul>";
  suggestionsContainer.innerHTML = html;
}

// Add a token (a confirmed choice) to the tokenContainer and update our tokens array.
function addToken(value) {
  // Create token span element.
  const tokenSpan = document.createElement("span");
  tokenSpan.className = "token";
  tokenSpan.textContent = value;
  tokenSpan.dataset.value = value;
  // When a token is clicked, allow editing.
  tokenSpan.addEventListener("click", tokenClickHandler);

  // Insert the token before the input field.
  tokenContainer.insertBefore(tokenSpan, tokenInput);

  // Save token in our tokens array.
  tokens.push(value);

  // Clear the input, update suggestions, and re-focus the input.
  tokenInput.value = "";
  updateSuggestions();
  tokenInput.focus();
}

// When a token is clicked, remove it and all tokens after it, then set its text into the input for editing.
function tokenClickHandler(e) {
  // Determine which token element was clicked.
  const tokenElements = Array.from(tokenContainer.querySelectorAll(".token"));
  // Find the index of the clicked token.
  const index = tokenElements.indexOf(e.currentTarget);
  if (index === -1) return;

  // Remove tokens from the DOM and from the tokens array (from the clicked index to the end).
  for (let i = tokenElements.length - 1; i >= index; i--) {
    tokenElements[i].remove();
    tokens.pop();
  }

  // Set the input field with the clicked token's value for editing.
  tokenInput.value = e.currentTarget.dataset.value;
  updateSuggestions();
  tokenInput.focus();
}

// Handle key events on the token input.
tokenInput.addEventListener("keydown", function(e) {
  // If the input is empty and Backspace is pressed, remove the last token.
  if (e.key === "Backspace" && tokenInput.value === "") {
    const tokenElements = Array.from(tokenContainer.querySelectorAll(".token"));
    if (tokenElements.length > 0) {
      // Remove the last token element.
      const lastTokenEl = tokenElements[tokenElements.length - 1];
      lastTokenEl.remove();
      tokens.pop();
      updateSuggestions();
    }
    e.preventDefault();
  }
});

// On keyup, update suggestions. If Enter is pressed, add the first suggestion if available.
tokenInput.addEventListener("keyup", function(e) {
  if (e.key === "Enter") {
    const firstSuggestion = suggestionsContainer.querySelector("li");
    if (firstSuggestion) {
      const value = firstSuggestion.dataset.value;
      addToken(value);
    }
    e.preventDefault();
    return;
  }
  updateSuggestions();
});

// Handle clicks on suggestion items.
suggestionsContainer.addEventListener("click", function(e) {
  if (e.target && e.target.nodeName === "LI") {
    const value = e.target.dataset.value;
    addToken(value);
  }
});

// Hide suggestions if clicking outside the input or suggestions list,
// but only if the tokenInput is not focused.
document.addEventListener("click", function(e) {
  if (!suggestionsContainer.contains(e.target) && e.target !== tokenInput) {
    if (document.activeElement !== tokenInput) {
      suggestionsContainer.innerHTML = "";
    }
  }
});
