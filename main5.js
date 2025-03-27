// Global registry for class renderers.
var classRegistry = {};

// For the prototype, we register the default renderer.
var defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;

// Example JSON data structure – for demonstration, we will start with the "Member" branch.
// (In a full implementation, you could use the entire JSON to drive the dynamic traversal.)
const flowData = {
  "Member": {
    "Options": ["Moved", "Seconded", "Withdrew", "Introduced", "Proposed"],
    "Moved": {
      "Options": ["Do Pass", "Do Not Pass", "Amendment", "Reconsider", "Without Committee Recommendation"],
      "Do Pass": {
        "Options": ["No Amendment or Rerefered", "As Amended", "and Rerefered"],
        "No Amendment or Rerefered": {},
        "As Amended": {
          "Options": ["No Referer", "and Rerefered"],
          "No Referer": {},
          "and Rerefered": {
            "Class": "Rerefer_Committee_Module",
            "Options": []
          }
        },
        "and Rerefered": {
          "Class": "Rerefer_Committee_Module",
          "Options": []
        }
      }
      // (Other branches omitted for brevity)
    }
    // (Other keys omitted for brevity)
  }
};

// Array to store tokens (the path of choices)
var tokens = [];

// References to DOM elements
const tokenContainer = document.getElementById('token-container');
const tokenInput = document.getElementById('token-input');
const suggestionsContainer = document.getElementById('suggestions-container');

// Get the current options based on the tokens chosen so far.
function getCurrentOptions() {
  // For this prototype, we always start with the "Member" branch.
  let currentData = flowData["Member"];
  // Traverse the tokens (if any)
  tokens.forEach(token => {
    // Only traverse if the property exists.
    if (currentData[token]) {
      currentData = currentData[token];
    } else {
      currentData = {};
    }
  });
  // Return the options for the current step
  return currentData["Options"] || [];
}

// Render suggestions based on current input.
function updateSuggestions() {
  const query = tokenInput.value.trim();
  const options = getCurrentOptions();
  // Use the default renderer from the registry.
  // In the future, if a step has a specific class assigned in the JSON, you could
  // use that renderer instead.
  const renderer = classRegistry["DefaultRenderer"];
  const suggestions = renderer.render(options, query);

  // Build suggestions list
  let html = "<ul>";
  suggestions.forEach(option => {
    html += `<li data-value="${option}">${option}</li>`;
  });
  html += "</ul>";
  suggestionsContainer.innerHTML = html;
}

// Add a token (i.e. a confirmed choice)
function addToken(value) {
  // Create token span
  const tokenSpan = document.createElement('span');
  tokenSpan.className = 'token';
  tokenSpan.textContent = value;
  tokenSpan.dataset.value = value;
  tokenSpan.addEventListener('click', tokenClickHandler);
  
  // Insert token before the input
  tokenContainer.insertBefore(tokenSpan, tokenInput);
  
  // Save token in our array
  tokens.push(value);
  
  // Clear input
  tokenInput.value = "";
  updateSuggestions();
}

// When a token is clicked, remove it and all tokens after it, and load its text into input for editing.
function tokenClickHandler(e) {
  const clickedValue = e.target.dataset.value;
  // Find index of clicked token in tokens array
  const index = tokens.indexOf(clickedValue);
  if (index !== -1) {
    // Remove tokens from the end down to the clicked one
    while (tokens.length > index) {
      tokens.pop();
      // Also remove token elements (all tokens except the input)
      if (tokenContainer.firstChild !== tokenInput) {
        tokenContainer.removeChild(tokenContainer.firstChild);
      }
    }
    // Set the input to the clicked value for editing
    tokenInput.value = clickedValue;
    updateSuggestions();
    tokenInput.focus();
  }
}

// Handle key events for token input.
tokenInput.addEventListener('keydown', function(e) {
  if (e.key === "Backspace" && tokenInput.value === "") {
    // If input is empty and backspace is pressed, remove the last token.
    if (tokens.length > 0) {
      tokens.pop();
      // Remove the last token element (which is the first child, as tokens are added before input)
      if (tokenContainer.firstChild !== tokenInput) {
        tokenContainer.removeChild(tokenContainer.firstChild);
      }
      updateSuggestions();
    }
    e.preventDefault();
  }
});

// Handle keyup to update suggestions.
tokenInput.addEventListener('keyup', function(e) {
  // If Enter is pressed, add the first suggestion if available.
  if (e.key === "Enter") {
    const firstSuggestion = suggestionsContainer.querySelector('li');
    if (firstSuggestion) {
      const value = firstSuggestion.dataset.value;
      addToken(value);
    }
    e.preventDefault();
    return;
  }
  updateSuggestions();
});

// Handle click on suggestion items.
suggestionsContainer.addEventListener('click', function(e) {
  if (e.target && e.target.nodeName === "LI") {
    const value = e.target.dataset.value;
    addToken(value);
  }
});

// Click outside suggestions should hide the list (optional improvement)
document.addEventListener('click', function(e) {
  if (!suggestionsContainer.contains(e.target) && e.target !== tokenInput) {
    suggestionsContainer.innerHTML = "";
  }
});

// Initialize suggestions on page load.
updateSuggestions();
