import { DefaultRenderer } from "./classes/defaultRenderer.js";
import { RereferCommitteeModule } from "./classes/rereferCommitteeModule.js";
import { MemberModule } from "./classes/memberModule.js";
import { MemberLookUpModule } from "./classes/memberLookUpModule.js";
import { LCModule } from "./classes/lcModule.js"; // Import the new LCModule
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
classRegistry["LC_Module"] = new LCModule(); // Register the LCModule

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
 * Loads allMember.xml to associate member numbers with DEFAULT_COMMITTEES.
 */
document.addEventListener("DOMContentLoaded", async () => {
    const tokenContainer = document.getElementById("token-container");
    const tokenInput = document.getElementById("token-input");
    const suggestionsContainer = document.getElementById("suggestions-container");

    const committeeSelectorContainer = document.getElementById("committee-selector");
    const committeeLegend = document.getElementById("committee-legend");

    // Fetch and parse allMember.xml
    const response = await fetch("allMember.xml");
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const hotKeys = xmlDoc.getElementsByTagName("HotKey");

    const memberData = Array.from(hotKeys).map(hotKey => {
        const lastName = hotKey.getElementsByTagName("Name")[0]?.textContent;
        const firstNameEl = hotKey.getElementsByTagName("FirstName")[0]?.textContent;
        const fields = hotKey.getElementsByTagName("Field");
        let memberNo = null;
        for (const field of fields) {
            if (field.getElementsByTagName("Key")[0]?.textContent === "member-no") {
                memberNo = field.getElementsByTagName("Value")[0]?.textContent;
                break;
            }
        }
        const titleMatch = firstNameEl?.match(/^(Senator|Representative)(?:\s+([A-Z])\.)?/);
        return {
            lastName,
            title: titleMatch ? titleMatch[1] : null,
            initial: titleMatch && titleMatch[2] ? titleMatch[2] : null,
            memberNo
        };
    });

    // Match XML data to DEFAULT_COMMITTEES
    for (const committee in DEFAULT_COMMITTEES) {
        DEFAULT_COMMITTEES[committee].forEach(memberObj => {
            const [fullName] = memberObj.name.split(" - ");
            const nameParts = fullName.split(" ");
            const lastName = nameParts[nameParts.length - 1];
            const firstInitial = nameParts[0][0];
            const isSenate = committee.toLowerCase().startsWith("senate");
            const title = isSenate ? "Senator" : "Representative";

            const matches = memberData.filter(md => md.lastName === lastName && md.title === title);
            if (matches.length === 1) {
                memberObj.memberNo = matches[0].memberNo;
            } else if (matches.length > 1) {
                // Handle duplicates by matching initial
                const exactMatch = matches.find(md => md.initial === firstInitial);
                if (exactMatch) {
                    memberObj.memberNo = exactMatch.memberNo;
                }
            }
        });
    }

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
});