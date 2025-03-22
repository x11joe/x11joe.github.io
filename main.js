// main.js - Main application logic, initialization, and event handlers

// Global array to store all members parsed from XML (populated in data.js)
let allMembers = [];
// Global variable to track a marked time for events (e.g., via backtick key)
let markedTime = null;

// In main.js
let history = [];
window.appState = { history }; // Attach history to window.appState for global access

// Load history from local storage
const savedHistory = localStorage.getItem('historyStatements');
if (savedHistory) {
    const loadedHistory = deserializeHistory(savedHistory);
    history.length = 0; // Clear the existing array
    history.push(...loadedHistory); // Refill with loaded data
    updateHistoryTable();
    console.log('History loaded from local storage:', history);
}

// Main initialization function, runs when DOM is fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize window.appState if not already done
    window.appState = window.appState || {};
    
    // Load default committees from window.DEFAULT_COMMITTEES (assumed from defaultCommittees.js)
    const committees = window.DEFAULT_COMMITTEES || {};
    // Default committee; can be overridden by saved selection
    let currentCommittee = "Senate Judiciary Committee";
    let jsonStructure; // Will hold the parsed flows.json structure

    // Load external data (flows.json and allMember.xml)
    try {
        const response = await fetch('flows.json');
        jsonStructure = await response.json();
        console.log('flows.json loaded:', jsonStructure);

        // Load and parse allMember.xml using function from data.js
        const xmlResponse = await fetch('allMember.xml');
        const xmlText = await xmlResponse.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        allMembers = parseMembersFromXML(xmlDoc); // From data.js
        console.log('All members loaded:', allMembers);
    } catch (error) {
        console.error('Error loading flows.json or allMember.xml:', error);
        return;
    }

    // State variables for tracking input flow and history
    let path = []; // Array of steps/options selected by user
    let currentFlow = null; // Current flow from flows.json
    let currentStep = null; // Current step within the flow
    let statementStartTime = null; // Time when statement input began
    let history = []; // Array of past statements
    let editingIndex = null; // Index of history entry being edited
    let dropdownActive = false; // Tracks if dropdown is open
    let selectedSuggestionIndex = -1; // Index of highlighted suggestion in modal
    let selectedDropdownIndex = -1; // Index of highlighted option in dropdown
    let lastAction = null; // Last committee member action (e.g., "Moved")
    let lastMovedDetail = null; // Last moved detail (e.g., "Do Pass")
    let lastRereferCommittee = null; // Last rereferred committee
    let amendmentPassed = false; // Tracks if an amendment passed via voice vote
    let editingTestimonyIndex = null; // Index of testimony path being edited
    let currentBill = localStorage.getItem('currentBill') || 'Uncategorized'; // Current bill name
    let currentBillType = localStorage.getItem('billType') || "Hearing"; // Bill type (Hearing, Committee Work, etc.)

    // DOM element references
    const inputDiv = document.getElementById('input');
    const modal = document.getElementById('modal');
    const historyTableBody = document.querySelector('#historyTable tbody');
    const committeeSelect = document.getElementById('committeeSelect');
    const historyDiv = document.getElementById('history');
    const entryWrapper = document.querySelector('.entry-wrapper');
    const testimonyModal = document.getElementById('testimonyModal');
    const submitTestimonyButton = document.getElementById('submitTestimonyButton');
    const cancelTestimonyButton = document.getElementById('cancelTestimonyButton');

    // Initialize bill input and display
    document.getElementById('billInput').value = currentBill === 'Uncategorized' ? '' : currentBill;
    document.getElementById('currentBillDisplay').textContent = 'Current Bill: ' + currentBill;
    document.querySelector(`input[name="billType"][value="${currentBillType}"]`).checked = true;

    // Populate committee dropdown
    Object.keys(committees).forEach(committee => {
        const option = document.createElement('option');
        option.value = committee;
        option.textContent = committee;
        committeeSelect.appendChild(option);
    });

    // Load saved committee selection
    const savedCommittee = localStorage.getItem('selectedCommittee');
    if (savedCommittee && committees[savedCommittee]) {
        currentCommittee = savedCommittee;
    }
    committeeSelect.value = currentCommittee;

    // Event listener for committee selection change
    committeeSelect.addEventListener('change', () => {
        currentCommittee = committeeSelect.value;
        localStorage.setItem('selectedCommittee', currentCommittee);
        updateLegend(); // From ui.js
        console.log('Committee changed to:', currentCommittee);
    });

    // Event listener for bill type radio buttons
    document.querySelectorAll('input[name="billType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            currentBillType = document.querySelector('input[name="billType"]:checked').value;
            localStorage.setItem('billType', currentBillType);
            console.log('Bill type changed to:', currentBillType);
        });
    });

    // Load saved history from local storage
    const savedHistory = localStorage.getItem('historyStatements');
    if (savedHistory) {
        history = deserializeHistory(savedHistory); // From utils.js
        updateHistoryTable(); // From ui.js
        console.log('History loaded from local storage:', history);
    }

    // Set lastAction from the most recent member action in history
    if (history.length > 0) {
        const lastEntry = history[history.length - 1];
        if (lastEntry.path[0].step === 'member') {
            const actionPart = lastEntry.path.find(p => p.step === 'action');
            if (actionPart) {
                lastAction = actionPart.value;
                console.log('Set lastAction from history to:', lastAction);
            }
        }
    }

    // Input div event listener: Handle text input and show suggestions
    inputDiv.addEventListener('input', () => {
        const text = getCurrentText(); // From flows.js
        showSuggestions(text); // From ui.js
        tryToTag(); // From flows.js
        adjustHistoryLayout(); // Local function
    });

    // Input div event listener: Handle key presses (e.g., Backspace, Enter)
    inputDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.collapsed && range.startContainer === inputDiv.lastChild && range.startOffset === inputDiv.lastChild.textContent.length && path.length > 0) {
                    e.preventDefault();
                    removeLastTag(); // From flows.js
                }
            }
        } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (modal.classList.contains('active')) {
                const suggestions = modal.querySelectorAll('.option');
                if (suggestions.length > 0) {
                    const index = selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0;
                    suggestions[index].click();
                }
            } else if (dropdownActive) {
                const dropdown = document.querySelector('.dropdown');
                if (dropdown) {
                    const options = dropdown.querySelectorAll('.dropdown-option');
                    if (options.length > 0) {
                        const index = selectedDropdownIndex >= 0 ? selectedDropdownIndex : 0;
                        options[index].click();
                    }
                }
            }
        } else if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            const suggestions = modal.querySelectorAll('.option');
            if (index < suggestions.length) {
                e.preventDefault();
                suggestions[index].click();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (dropdownActive) {
                const dropdown = document.querySelector('.dropdown');
                if (dropdown && selectedDropdownIndex >= 0) {
                    const options = dropdown.querySelectorAll('.dropdown-option');
                    options[selectedDropdownIndex].click();
                }
            } else if (currentStep && jsonStructure.flows[currentFlow]?.steps.find(step => step.step === currentStep)?.optional) {
                const stepConfig = jsonStructure.flows[currentFlow].steps.find(step => step.step === currentStep);
                currentStep = stepConfig.next;
                updateInput(); // From ui.js
                showSuggestions(''); // From ui.js
            } else {
                finalizeStatement(); // Local function
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (dropdownActive) {
                const dropdown = document.querySelector('.dropdown');
                if (dropdown) {
                    const options = dropdown.querySelectorAll('.dropdown-option');
                    selectedDropdownIndex = Math.min(selectedDropdownIndex + 1, options.length - 1);
                    updateDropdownHighlight(dropdown); // From ui.js
                }
            } else if (modal.classList.contains('active')) {
                const suggestions = modal.querySelectorAll('.option');
                selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                updateSuggestionHighlight(suggestions); // From ui.js
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (dropdownActive) {
                const dropdown = document.querySelector('.dropdown');
                if (dropdown) {
                    const options = dropdown.querySelectorAll('.dropdown-option');
                    selectedDropdownIndex = selectedDropdownIndex <= 0 ? -1 : selectedDropdownIndex - 1;
                    updateDropdownHighlight(dropdown); // From ui.js
                }
            } else if (modal.classList.contains('active')) {
                const suggestions = modal.querySelectorAll('.option');
                selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? -1 : selectedSuggestionIndex - 1;
                updateSuggestionHighlight(suggestions); // From ui.js
            }
        } else if (e.key === 'Escape' && dropdownActive) {
            document.dispatchEvent(new MouseEvent('click'));
            e.preventDefault();
        }
    });

    // Input div event listener: Handle clicks on token chevrons to edit tags
    inputDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('chevron')) {
            e.stopPropagation();
            const token = e.target.parentElement;
            const type = token.getAttribute('data-type');
            const index = parseInt(token.getAttribute('data-index'), 10);
            showTagOptions(token, type, index); // From flows.js
        }
    });

    // Clear history button event listener
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        history = [];
        lastAction = null;
        localStorage.removeItem('historyStatements');
        updateHistoryTable(); // From ui.js
        console.log('History cleared');
    });

    // Testimony modal submit button event listener
    submitTestimonyButton.addEventListener('click', () => {
        submitTestimonyModal(); // From testimony.js
    });

    // Testimony modal cancel button event listener
    cancelTestimonyButton.addEventListener('click', () => {
        closeTestimonyModal(); // From testimony.js
    });

    // History table double-click event listener: Edit time of entries
    historyTableBody.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (target.tagName === 'TD' && target.cellIndex === 0) {
            const row = target.closest('tr');
            const index = parseInt(row.getAttribute('data-index'), 10);
            showTimeEditor(history[index], target); // Local function
        }
    });

    // Global keydown listener: Toggle marked time with backtick (`)
    document.addEventListener('keydown', (e) => {
        if (e.key === '`') {
            e.preventDefault();
            const pageWrapper = document.querySelector('.page-wrapper');
            if (!pageWrapper) {
                console.error('Error: .page-wrapper not found');
                return;
            }
            if (markedTime) {
                markedTime = null;
                pageWrapper.classList.remove('marking-time');
                console.log('Marking time turned off');
            } else {
                markedTime = new Date();
                pageWrapper.classList.add('marking-time');
                console.log('Marking time turned on:', markedTime);
            }
        }
    });

    // Set bill button event listener
    document.getElementById('setBillBtn').addEventListener('click', () => {
        const billInput = document.getElementById('billInput').value.trim();
        currentBill = billInput || 'Uncategorized';
        localStorage.setItem('currentBill', currentBill);
        document.getElementById('currentBillDisplay').textContent = 'Current Bill: ' + currentBill;
        console.log('Current bill set to:', currentBill);
    });

    // Window resize event listener: Adjust history layout
    window.addEventListener('resize', adjustHistoryLayout);

    // Extension message listener: Handle external statements
    window.addEventListener("message", function (event) {
        if (event.source !== window || !event.data || event.data.source !== "CLERK_EXTENSION") return;
        if (event.data.type === "HEARING_STATEMENT") {
            const payload = event.data.payload;
            if (typeof payload === 'object' && payload.testimonyNo) {
                openTestimonyModal(payload); // From testimony.js
            } else {
                const startTime = new Date();
                const statementText = String(payload);
                const path = [{ step: 'custom', value: statementText }];
                history.push({ time: startTime, path, text: statementText });
                const row = createHistoryRow(startTime, statementText, path, history.length - 1); // From ui.js
                historyTableBody.insertBefore(row, historyTableBody.firstChild);
                localStorage.setItem('historyStatements', serializeHistory(history)); // From utils.js
            }
        }
    });

    // Initial UI setup
    updateMeetingActionsLegend(); // From ui.js
    updateVoteActionsLegend(); // From ui.js
    updateExternalActionsLegend(); // From ui.js
    updateLegend(); // From ui.js
    adjustHistoryLayout();
    inputDiv.focus();

    // Finalize a statement and add/edit it in history
    function finalizeStatement() {
        if (path.length === 0) return;
        const statementText = constructStatementText(path); // From flows.js

        // Update state based on flow type
        if (currentFlow === jsonStructure.flows.committeeMemberFlow) {
            const actionPart = path.find(p => p.step === 'action');
            if (actionPart) {
                lastAction = actionPart.value;
                if (lastAction === 'Moved') {
                    const detailPart = path.find(p => p.step === 'movedDetail');
                    if (detailPart) lastMovedDetail = detailPart.value;
                    const rereferPart = path.find(p => p.step === 'rereferOptional');
                    lastRereferCommittee = rereferPart ? rereferPart.value : null;
                }
            }
        } else if (currentFlow === jsonStructure.flows.voteActionFlow) {
            const voteType = path.find(p => p.step === 'voteType')?.value;
            if (voteType === 'Voice Vote') {
                const onWhat = path.find(p => p.step === 'voiceVoteOn')?.value;
                const outcome = path.find(p => p.step === 'voiceVoteOutcome')?.value;
                if (onWhat === 'Amendment' && outcome === 'Passed') {
                    amendmentPassed = true;
                }
            }
        }

        const startTime = markedTime || statementStartTime || new Date();
        if (markedTime) {
            markedTime = null;
            document.querySelector('.page-wrapper').classList.remove('marking-time');
        }

        if (editingIndex !== null) {
            history[editingIndex] = { time: startTime, path: [...path], text: statementText, link: history[editingIndex].link || '', bill: history[editingIndex].bill };
            if (path[0].step === 'testimony') {
                handleTestimonyPrompts(editingIndex).then(() => { // From testimony.js
                    updateHistoryTable(); // From ui.js
                    localStorage.setItem('historyStatements', serializeHistory(history)); // From utils.js
                });
            } else {
                updateHistoryTable(); // From ui.js
                localStorage.setItem('historyStatements', serializeHistory(history)); // From utils.js
            }
        } else {
            const newEntry = { time: startTime, path: [...path], text: statementText, link: '', bill: currentBill };
            history.push(newEntry);
            updateHistoryTable(newEntry); // From ui.js
            setTimeout(() => {
                document.getElementById('historyWrapper').scrollTop = 0;
            }, 0);
            localStorage.setItem('historyStatements', serializeHistory(history)); // From utils.js
        }

        // Reset state
        editingIndex = null;
        path = [];
        currentFlow = null;
        currentStep = null;
        statementStartTime = null;
        inputDiv.innerHTML = '';
        inputDiv.appendChild(document.createTextNode(' '));
        inputDiv.focus();
        showSuggestions(''); // From ui.js
    }

    // Adjust the history div position based on entry wrapper
    function adjustHistoryLayout() {
        const entryRect = entryWrapper.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const gap = 10;
        const historyTop = entryRect.bottom + gap;
        historyDiv.style.top = `${historyTop}px`;
        const maxHistoryHeight = viewportHeight - historyTop - 10;
        historyDiv.style.height = `${maxHistoryHeight}px`;
    }

    // Show a time editor for a history entry
    function showTimeEditor(entry, timeCell) {
        const editor = document.createElement('div');
        editor.className = 'time-editor';
        const hour = entry.time.getHours() % 12 || 12;
        const minute = entry.time.getMinutes().toString().padStart(2, '0');
        const second = entry.time.getSeconds().toString().padStart(2, '0');
        const period = entry.time.getHours() >= 12 ? 'PM' : 'AM';

        editor.innerHTML = `
            <label>Hour: <input type="number" id="edit-hour" min="1" max="12" value="${hour}"></label>
            <label>Minute: <input type="number" id="edit-minute" min="0" max="59" value="${minute}"></label>
            <label>Second: <input type="number" id="edit-second" min="0" max="59" value="${second}"></label>
            <label>Period: <select id="edit-period">
                <option value="AM" ${period === 'AM' ? 'selected' : ''}>AM</option>
                <option value="PM" ${period === 'PM' ? 'selected' : ''}>PM</option>
            </select></label>
            <button id="save-time">Save</button>
        `;

        document.body.appendChild(editor);
        const rect = timeCell.getBoundingClientRect();
        const editorHeight = 150;
        const editorWidth = 250;
        let top = rect.bottom + window.scrollY;
        let left = rect.left + window.scrollX;

        if (top + editorHeight > window.innerHeight + window.scrollY) {
            top = rect.top - editorHeight + window.scrollY;
            if (top < window.scrollY) {
                left = rect.right + window.scrollX;
                top = rect.top + window.scrollY;
                if (left + editorWidth > window.innerWidth + window.scrollX) {
                    left = rect.left - editorWidth + window.scrollX;
                }
            }
        }

        editor.style.position = 'absolute';
        editor.style.left = `${left}px`;
        editor.style.top = `${top}px`;
        editor.style.zIndex = '10002';

        document.getElementById('edit-hour').focus();

        document.getElementById('save-time').addEventListener('click', () => {
            let hour = parseInt(document.getElementById('edit-hour').value);
            const period = document.getElementById('edit-period').value;
            if (period === 'PM' && hour < 12) hour += 12;
            else if (period === 'AM' && hour === 12) hour = 0;
            const minute = parseInt(document.getElementById('edit-minute').value);
            const second = parseInt(document.getElementById('edit-second').value);

            entry.time = new Date(entry.time.setHours(hour, minute, second));
            history.sort((a, b) => a.time - b.time);
            updateHistoryTable(); // From ui.js
            localStorage.setItem('historyStatements', serializeHistory(history)); // From utils.js
            editor.remove();
        });

        const closeEditor = (e) => {
            if (!editor.contains(e.target)) {
                editor.remove();
                document.removeEventListener('click', closeEditor);
            }
        };
        setTimeout(() => document.addEventListener('click', closeEditor), 0);
    }
});