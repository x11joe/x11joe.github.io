import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";
import { MemberModule } from "./classes/memberModule.js";
import { TokenSystem } from "./classes/tokenSystem.js";

// Import the flow data. (Using 'with' syntax for your environment.)
import flowDataRaw from "./flow5.json" with { type: "json" };

// Global registry for class renderers.
const classRegistry = {};

// Register the default renderer.
const defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;

// Register our custom renderers.
classRegistry["Rerefer_Committee_Module"] = new RereferCommitteeModule();
classRegistry["Member_Module"] = new MemberModule();

// Instead of extracting only one branch, use the complete flow data.
const flowData = flowDataRaw;

// Instantiate TokenSystem once DOM content is loaded.
document.addEventListener("DOMContentLoaded", () => {
  const tokenContainer = document.getElementById("token-container");
  const tokenInput = document.getElementById("token-input");
  const suggestionsContainer = document.getElementById("suggestions-container");
  
  new TokenSystem(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer);
});
