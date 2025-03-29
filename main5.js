import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";
import { MemberModule } from "./classes/memberModule.js";
import { MemberLookUpModule } from "./classes/memberLookUpModule.js";
import { TokenSystem } from "./classes/tokenSystem.js";
import { DEFAULT_COMMITTEES, FEMALE_NAMES } from "./defaultCommittees5.js";
import { CommitteeSelector } from "./classes/committeeSelector.js";
import { ShortcutLegend } from "./classes/shortcutLegend.js";

// Import the flow data. (Using 'with' syntax for your environment.)
import flowDataRaw from "./flow5.json" with { type: "json" };

// Global registry for class renderers.
const classRegistry = {};
const defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;
classRegistry["Rerefer_Committee_Module"] = new RereferCommitteeModule();
classRegistry["Member_Module"] = new MemberModule();
classRegistry["Member_Look_Up_Module"] = new MemberLookUpModule();

// Use complete flow data.
const flowData = flowDataRaw;

const shortcuts = {
  "Meeting Actions": {
    "Closed Hearing": ["Meeting Action", "Closed Hearing"],
    "Recessed Meeting": ["Meeting Action", "Recessed Meeting"],
    "Adjourned Meeting": ["Meeting Action", "Adjourned Meeting"],
    "Reconvened Meeting": ["Meeting Action", "Reconvened Meeting"]
  },
  "Vote Actions": {
    "Roll Call Vote": ["Roll Call Vote"],
    "Voice Vote": ["Voice Vote"],
    "Motion Failed": ["Voice Vote"] // Simplified for prototype; adjust as needed
  },
  "External Actions": {
    "Add Testimony": ["Testimony"],
    "Introduced Bill": ["Member Action", "Introduced"],
    "Proposed Amendment": ["Member Action", "Proposed"],
    "Introduced Amendment": ["Member Action", "Introduced"] // Assuming similar to Introduced Bill
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const tokenContainer = document.getElementById("token-container");
  const tokenInput = document.getElementById("token-input");
  const suggestionsContainer = document.getElementById("suggestions-container");
  
  // Instantiate the CommitteeSelector.
  const committeeSelectorContainer = document.getElementById("committee-selector");
  const committeeLegend = document.getElementById("committee-legend");
  new CommitteeSelector(committeeSelectorContainer, committeeLegend, DEFAULT_COMMITTEES);

  // Instantiate TokenSystem.
  const tokenSystem = new TokenSystem(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer, CommitteeSelector);

  const shortcutLegendContainer = document.getElementById("shortcut-legend");
  new ShortcutLegend(shortcutLegendContainer, tokenSystem, shortcuts);
});
