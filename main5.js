import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";
import { MemberModule } from "./classes/memberModule.js";
import { MemberLookUpModule } from "./classes/memberLookUpModule.js";
import { LCModule } from "./classes/lcModule.js";
import { TestimonyModule } from "./classes/testimonyModule.js";
import { TokenSystem } from "./classes/tokenSystem.js";
import { DEFAULT_COMMITTEES, FEMALE_NAMES } from "./defaultCommittees5.js";
import { CommitteeSelector } from "./classes/committeeSelector.js";
import { ShortcutLegend } from "./classes/shortcutLegend.js";
import { HistoryManager } from "./classes/historyManager.js";
// eslint-disable-next-line no-unused-vars
import { TextConstructor } from "./classes/textConstructor.js";
import { Utils } from "./classes/utils.js";
import { MemberDataProcessor } from "./classes/memberDataProcessor.js";

import flowDataRaw from "./flow5.json" with { type: "json" };

const classRegistry = {};
const defaultRenderer = new DefaultRenderer();
classRegistry["DefaultRenderer"] = defaultRenderer;
classRegistry["Rerefer_Committee_Module"] = new RereferCommitteeModule();
classRegistry["Member_Module"] = new MemberModule();
classRegistry["Member_Look_Up_Module"] = new MemberLookUpModule();
classRegistry["LC_Module"] = new LCModule();
classRegistry["Testimony_Module"] = new TestimonyModule();

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

/**
 * Main entry point for the application. Initializes all components and sets up event listeners.
 * Uses MemberDataProcessor to load member numbers into DEFAULT_COMMITTEES and adds a window event listener
 * for the Chrome extension's HEARING_STATEMENT event to trigger the TestimonyModule modal.
 */
document.addEventListener("DOMContentLoaded", async () => {
    const tokenContainer = document.getElementById("token-container");
    const tokenInput = document.getElementById("token-input");
    const suggestionsContainer = document.getElementById("suggestions-container");

    const committeeSelectorContainer = document.getElementById("committee-selector");
    const committeeLegend = document.getElementById("committee-legend");

    // Process member data and update DEFAULT_COMMITTEES
    const memberProcessor = new MemberDataProcessor("allMember.xml", DEFAULT_COMMITTEES);
    await memberProcessor.loadAndProcess();

    const committeeSelector = new CommitteeSelector(committeeSelectorContainer, committeeLegend, DEFAULT_COMMITTEES, FEMALE_NAMES);

    const historyContainer = document.getElementById("history-table");
    const historyManager = new HistoryManager(historyContainer, committeeSelector);

    const tokenSystem = new TokenSystem(tokenContainer, tokenInput, suggestionsContainer, flowData, classRegistry, defaultRenderer, committeeSelector, historyManager);

    committeeSelector.setTokenSystem(tokenSystem);
    historyManager.setTokenSystem(tokenSystem);
    historyManager.render();

    const shortcutLegendContainer = document.getElementById("shortcut-legend");
    new ShortcutLegend(shortcutLegendContainer, tokenSystem, shortcuts);

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

    document.addEventListener('keydown', (e) => {
        if (e.key === '`') {
            tokenSystem.markTime();
        }
    });

    const billInput = document.getElementById('bill');
    const billTypeSelect = document.getElementById('bill-type');

    const savedBill = localStorage.getItem('bill');
    const savedBillType = localStorage.getItem('billType');
    if (savedBill) billInput.value = savedBill;
    if (savedBillType) billTypeSelect.value = savedBillType;

    billInput.addEventListener('input', () => {
        localStorage.setItem('bill', billInput.value);
    });
    billTypeSelect.addEventListener('change', () => {
        localStorage.setItem('billType', billTypeSelect.value);
    });

    // Add window event listener for HEARING_STATEMENT from Chrome extension
    window.addEventListener("message", function (event) {
        if (event.source !== window || !event.data || event.data.source !== "CLERK_EXTENSION") return;
        if (event.data.type === "HEARING_STATEMENT") {
            const payload = event.data.payload;
            if (typeof payload === 'object' && payload.testimonyNo) {
                // Process format
                if (payload.format) {
                    if (payload.format.includes('(In-Person)')) {
                        payload.format = 'In Person';
                    } else if (payload.format.includes('(Online)')) {
                        payload.format = 'Online';
                    } else {
                        payload.format = 'Written';
                    }
                }
                // Deduplicate role and organization
                if (payload.role === payload.organization) {
                    payload.role = '';
                }
                // Instead of appending a new "Testimony" token, reset tokens to only contain "Testimony"
                tokenSystem.setTokens(["Testimony"]);
                // Set the prefill data so that the modal shows the payload information
                tokenSystem.classRegistry["Testimony_Module"].prefillData = payload;
                tokenSystem.updateSuggestions();
            }
        }
    });
});