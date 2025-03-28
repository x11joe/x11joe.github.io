//main5.js
import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";
import { TokenSystem } from "./classes/tokenSystem.js";

// Import the flow data. (Using 'with' syntax for your environment.)
import flowDataRaw from "./flow5.json" with { type: "json" };

// Global registry for class renderers.
const classRegistry = {};

// Register the default renderer.
const defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;

// Register our custom renderer for Rerefer_Committee_Module.
classRegistry["Rerefer_Committee_Module"] = new RereferCommitteeModule();

// Instead of extracting only the "Member" branch, use the complete flow data.
const flowData = flowDataRaw;

// Instantiate TokenSystem once DOM content is loaded.
document.addEventListener("DOMContentLoaded", () => {
  const tokenContainer = document.getElementById("token-container");
  const tokenInput = document.getElementById("token-input");
  const suggestionsContainer = document.getElementById("suggestions-container");
  
  new TokenSystem(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer);
});
