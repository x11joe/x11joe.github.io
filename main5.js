import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";
import { MemberModule } from "./classes/memberModule.js";
import { TokenSystem } from "./classes/tokenSystem.js";
import { DEFAULT_COMMITTEES, FEMALE_NAMES } from "./classes/defaultCommittees.js";
import { CommitteeSelector } from "./classes/committeeSelector.js";

// Import the flow data. (Using 'with' syntax for your environment.)
import flowDataRaw from "./flow5.json" with { type: "json" };

// Global registry for class renderers.
const classRegistry = {};
const defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;
classRegistry["Rerefer_Committee_Module"] = new RereferCommitteeModule();
classRegistry["Member_Module"] = new MemberModule();

// Use complete flow data.
const flowData = flowDataRaw;

document.addEventListener("DOMContentLoaded", () => {
  // Instantiate TokenSystem.
  const tokenContainer = document.getElementById("token-container");
  const tokenInput = document.getElementById("token-input");
  const suggestionsContainer = document.getElementById("suggestions-container");
  new TokenSystem(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer);
  
  // Instantiate the CommitteeSelector.
  const committeeSelectorContainer = document.getElementById("committee-selector");
  const committeeLegend = document.getElementById("committee-legend");
  new CommitteeSelector(committeeSelectorContainer, committeeLegend, DEFAULT_COMMITTEES);
});
