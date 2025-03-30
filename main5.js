import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";
import { MemberModule } from "./classes/memberModule.js";
import { MemberLookUpModule } from "./classes/memberLookUpModule.js";
import { TokenSystem } from "./classes/tokenSystem.js";
import { DEFAULT_COMMITTEES, FEMALE_NAMES } from "./defaultCommittees5.js";
import { CommitteeSelector } from "./classes/committeeSelector.js";
import { ShortcutLegend } from "./classes/shortcutLegend.js";
import { HistoryManager } from "./classes/historyManager.js";
// eslint-disable-next-line no-unused-vars
import { TextConstructor } from "./classes/textConstructor.js";
import { Utils } from "./classes/utils.js";

import flowDataRaw from "./flow5.json" with { type: "json" };

const classRegistry = {};
const defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;
classRegistry["Rerefer_Committee_Module"] = new RereferCommitteeModule();
classRegistry["Member_Module"] = new MemberModule();
classRegistry["Member_Look_Up_Module"] = new MemberLookUpModule();

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
        "Motion Failed": ["Voice Vote"]
    },
    "External Actions": {
        "Add Testimony": ["Testimony"],
        "Introduced Bill": ["Member Action", "Introduced"],
        "Proposed Amendment": ["Member Action", "Proposed"],
        "Introduced Amendment": ["Member Action", "Introduced"]
    }
};

document.addEventListener("DOMContentLoaded", () => {
  const tokenContainer = document.getElementById("token-container");
  const tokenInput = document.getElementById("token-input");
  const suggestionsContainer = document.getElementById("suggestions-container");

  const committeeSelectorContainer = document.getElementById("committee-selector");
  const committeeLegend = document.getElementById("committee-legend");

  const committeeSelector = new CommitteeSelector(committeeSelectorContainer, committeeLegend, DEFAULT_COMMITTEES, FEMALE_NAMES);

  const historyContainer = document.getElementById("history-table");
  const historyManager = new HistoryManager(historyContainer, committeeSelector);

  const tokenSystem = new TokenSystem(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer, committeeSelector, historyManager);

  committeeSelector.setTokenSystem(tokenSystem);
  historyManager.setTokenSystem(tokenSystem);
  historyManager.render(); // Call render after setting tokenSystem

  const shortcutLegendContainer = document.getElementById("shortcut-legend");
  new ShortcutLegend(shortcutLegendContainer, tokenSystem, shortcuts);

  // Add event listener for the Clear All button
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      historyManager.clearAllHistory();
    }
  });

  document.querySelectorAll('.copy-button').forEach(button => {
    button.addEventListener('click', () => {
      const targetId = button.dataset.target;
      const textField = document.getElementById(targetId);
      const text = textField.value;
      Utils.copyWithGlow(textField, text);
    });
  });

  // Add keydown listener for mark time feature
  document.addEventListener('keydown', (e) => {
    if (e.key === '`') {
      tokenSystem.markTime();
    }
  });

  // Handle saving and loading bill and bill type
  const billInput = document.getElementById('bill');
  const billTypeSelect = document.getElementById('bill-type');

  // Load from local storage
  const savedBill = localStorage.getItem('bill');
  const savedBillType = localStorage.getItem('billType');
  if (savedBill) billInput.value = savedBill;
  if (savedBillType) billTypeSelect.value = savedBillType;

  // Save to local storage on change
  billInput.addEventListener('input', () => {
    localStorage.setItem('bill', billInput.value);
  });
  billTypeSelect.addEventListener('change', () => {
    localStorage.setItem('billType', billTypeSelect.value);
  });
});