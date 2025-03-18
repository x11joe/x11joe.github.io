// script2.js
// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', async () => {
    // Import committee data from defaultCommittees.js
    const committees = window.DEFAULT_COMMITTEES || {};
    let currentCommittee = "Senate Judiciary Committee"; // Default to Senate Judiciary

    // Load flows.json using async/await
    let jsonStructure;
    try {
        const response = await fetch('flows.json');
        jsonStructure = await response.json();
    } catch (error) {
        console.error('Error loading flows.json:', error);
        return; // Exit if fetch fails
    }

    // Dynamic option functions
    const suggestMotionType = () => ["Do Pass", "Do Not Pass", "Without Committee Recommendation"];
    const suggestFailedReason = () => ["for lack of a second"];

    // State variables
    let path = []; // Array of {step, value}
    let currentFlow = null;
    let currentStep = null;
    let statementStartTime = null; // Track when first tag is added
    let history = []; // Store finalized statements
    let editingIndex = null; // Track the index of the entry being edited

    // DOM elements
    const inputDiv = document.getElementById('input');
    const modal = document.getElementById('modal');
    const historyTableBody = document.querySelector('#historyTable tbody');

    // Get committee members from currentCommittee
    function getCommitteeMembers() {
        return committees[currentCommittee] || [];
    }

    // Get other committees based on chamber
    function getOtherCommittees() {
        const isHouse = currentCommittee.toLowerCase().includes("house");
        return Object.keys(committees).filter(c => 
            isHouse ? c.toLowerCase().includes("house") : c.toLowerCase().includes("senate")
        ).filter(c => c !== currentCommittee);
    }

    // Get options for the current step
    function getCurrentOptions() {
        if (!currentFlow) {
            let allOptions = [];
            jsonStructure.startingPoints.forEach(sp => {
                if (sp.options === "committeeMembers") {
                    allOptions = allOptions.concat(getCommitteeMembers());
                } else if (Array.isArray(sp.options)) {
                    allOptions = allOptions.concat(sp.options);
                }
            });
            return allOptions;
        } else {
            const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
            if (!stepConfig) return [];
            if (stepConfig.options === "committeeMembers") {
                return getCommitteeMembers();
            } else if (stepConfig.options === "otherCommittees") {
                return getOtherCommittees();
            } else if (stepConfig.options === "suggestMotionType") {
                return suggestMotionType();
            } else if (stepConfig.options === "suggestFailedReason") {
                return suggestFailedReason();
            } else if (Array.isArray(stepConfig.options)) {
                return stepConfig.options;
            }
            return [];
        }
    }

    // Get the current untagged text at the end
    function getCurrentText() {
        let text = '';
        for (let i = inputDiv.childNodes.length - 1; i >= 0; i--) {
            const node = inputDiv.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE) {
                text = node.textContent + text;
            } else if (node.classList && node.classList.contains('token')) {
                break; // Stop at the last token
            }
        }
        return text.trim();
    }

    function showTagOptions(tagElement, stepType, pathIndex) {
        // Find the flow and step configuration
        const flow = pathIndex === 0 && !currentFlow ? null : currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === stepType)?.flow];
        let options = [];
        
        if (pathIndex === 0 && !flow) {
            // Starting point options
            const startingPoint = jsonStructure.startingPoints.find(sp => sp.type === stepType);
            options = startingPoint.options === "committeeMembers" ? getCommitteeMembers() : startingPoint.options;
        } else {
            const stepConfig = flow.steps.find(step => step.step === stepType);
            options = stepConfig.options === "committeeMembers" ? getCommitteeMembers() :
                      stepConfig.options === "otherCommittees" ? getOtherCommittees() :
                      stepConfig.options === "suggestMotionType" ? suggestMotionType() :
                      stepConfig.options === "suggestFailedReason" ? suggestFailedReason() :
                      stepConfig.options || [];
        }
    
        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        dropdown.style.position = 'absolute';
        dropdown.style.background = 'white';
        dropdown.style.border = '1px solid #ccc';
        dropdown.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        
        options.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = opt;
            div.onclick = (e) => {
                e.stopPropagation();
                path[pathIndex].value = opt;
                updateInput();
                adjustCurrentStep(pathIndex);
                document.body.removeChild(dropdown);
            };
            dropdown.appendChild(div);
        });
    
        document.body.appendChild(dropdown);
        const rect = tagElement.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    }

    // Adjust currentStep after tag change
    function adjustCurrentStep(changedIndex) {
        if (changedIndex === path.length - 1) {
            const stepConfig = currentFlow.steps.find(step => step.step === path[changedIndex].step);
            if (stepConfig.next) {
                currentStep = typeof stepConfig.next === 'string' ? stepConfig.next : stepConfig.next[path[changedIndex].value] || stepConfig.next.default;
            } else {
                currentStep = null;
            }
        }
        showSuggestions('');
    }

    // Create a tag element
    function createTag(text, type, index) {
        const span = document.createElement('span');
        span.className = 'token';
        span.setAttribute('data-type', type);
        span.setAttribute('data-index', index); // Store path index
        span.contentEditable = false;
    
        const textNode = document.createTextNode(text);
        const chevron = document.createElement('span');
        chevron.className = 'chevron';
        chevron.textContent = ' ▼'; // Down arrow
        span.appendChild(textNode);
        span.appendChild(chevron);
    
        span.onclick = (e) => {
            e.stopPropagation();
            showTagOptions(span, type, index);
        };
        return span;
    }

    // Try to convert the last word into a tag
    function tryToTag() {
        let lastTextNode = null;
        for (let i = inputDiv.childNodes.length - 1; i >= 0; i--) {
            if (inputDiv.childNodes[i].nodeType === Node.TEXT_NODE) {
                lastTextNode = inputDiv.childNodes[i];
                break;
            }
        }
        if (lastTextNode) {
            const text = lastTextNode.textContent.trim();
            const words = text.split(/\s+/);
            if (words.length > 0) {
                const lastWord = words[words.length - 1];
                const options = getCurrentOptions();
                const match = options.find(opt => opt.toLowerCase() === lastWord.toLowerCase());
                if (match) {
                    const tag = createTag(match, currentStep || 'startingPoint');
                    lastTextNode.textContent = text.slice(0, -lastWord.length).trim() + ' ';
                    inputDiv.insertBefore(tag, lastTextNode);
                    selectOption(match);
                }
            }
        }
    }

    // Select an option and update state
    function selectOption(option) {
        if (!currentFlow) {
            const startingPoint = jsonStructure.startingPoints.find(sp => {
                if (sp.options === "committeeMembers") {
                    return getCommitteeMembers().includes(option);
                } else if (Array.isArray(sp.options)) {
                    return sp.options.includes(option);
                }
                return false;
            });
            if (startingPoint) {
                currentFlow = jsonStructure.flows[startingPoint.flow];
                const firstStep = currentFlow.steps[0];
                let stepOptions = firstStep.options === "committeeMembers" ? getCommitteeMembers() : firstStep.options;
                if (stepOptions.includes(option)) {
                    path.push({ step: firstStep.step, value: option });
                    currentStep = typeof firstStep.next === 'string' ? firstStep.next : firstStep.next?.default;
                } else {
                    path.push({ step: startingPoint.type, value: option });
                    currentStep = firstStep.step;
                }
            }
        } else {
            const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
            path.push({ step: currentStep, value: option });
            if (stepConfig.next) {
                if (typeof stepConfig.next === 'string') {
                    currentStep = stepConfig.next;
                } else if (typeof stepConfig.next === 'object') {
                    currentStep = stepConfig.next[option] || stepConfig.next.default;
                }
            } else {
                currentStep = null;
            }
        }
        if (path.length === 1) statementStartTime = new Date(); // Add this line
        updateInput();
        showSuggestions('');
    }

    // Handle module input (simplified for voteModule)
    function handleModule(stepConfig, triggerOption) {
        modal.innerHTML = '';
        const form = document.createElement('div');
        stepConfig.fields.forEach(field => {
            const label = document.createElement('label');
            label.textContent = `${field.name}: `;
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                field.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    input.appendChild(option);
                });
            } else {
                input = document.createElement('input');
                input.type = field.type;
            }
            input.id = `module-${field.name}`;
            label.appendChild(input);
            form.appendChild(label);
            form.appendChild(document.createElement('br'));
        });
        const submit = document.createElement('button');
        submit.textContent = 'Submit';
        submit.onclick = () => {
            const moduleResult = {};
            stepConfig.fields.forEach(field => {
                const input = document.getElementById(`module-${field.name}`);
                moduleResult[field.name] = field.type === 'number' ? parseInt(input.value) || 0 : input.value;
            });
            const resultStr = JSON.stringify(moduleResult);
            path.push({ step: currentStep, value: resultStr });
            currentStep = stepConfig.next.outcome ? stepConfig.next.outcome[moduleResult.outcome] : stepConfig.next;
            updateInput();
            modal.classList.remove('active');
        };
        form.appendChild(submit);
        modal.appendChild(form);
        modal.classList.add('active');
        positionModal();
    }

    // Update the input display
    function updateInput() {
        inputDiv.innerHTML = '';
        path.forEach((part, index) => {
            const tag = createTag(part.value, part.step, index);
            inputDiv.appendChild(tag);
        });
        inputDiv.appendChild(document.createTextNode(' '));
        inputDiv.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(inputDiv);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    // Show suggestions based on current text
    function showSuggestions(text) {
        const options = getCurrentOptions();
        const filtered = text ? options.filter(opt => opt.toLowerCase().includes(text.toLowerCase())) : options;
        modal.innerHTML = '';
        if (filtered.length > 0) {
            filtered.forEach((opt, index) => {
                const div = document.createElement('div');
                div.className = 'option';
                div.textContent = `${index + 1}. ${opt}`;
                div.onclick = () => {
                    inputDiv.lastChild.textContent = ' '; // Clear text
                    const tag = createTag(opt, currentStep || 'startingPoint');
                    inputDiv.insertBefore(tag, inputDiv.lastChild);
                    selectOption(opt);
                };
                modal.appendChild(div);
            });
            modal.classList.add('active');
            positionModal(); // Call after content is added
        } else {
            modal.classList.remove('active');
        }
    }

    // Position modal above input
    function positionModal() {
        const rect = inputDiv.getBoundingClientRect();
        ///This code did not work before so I added it directly in the CSS
    }

    // Remove last tag on backspace
    function removeLastTag() {
        if (path.length > 0) {
            path.pop();
            if (path.length > 0) {
                const lastPart = path[path.length - 1];
                currentFlow = Object.values(jsonStructure.flows).find(flow => 
                    flow.steps.some(step => step.step === lastPart.step)
                );
                const stepConfig = currentFlow.steps.find(step => step.step === lastPart.step);
                currentStep = stepConfig.next;
                if (typeof currentStep === 'object') {
                    currentStep = currentStep[lastPart.value] || currentStep.default;
                }
            } else {
                currentFlow = null;
                currentStep = null;
            }
            updateInput();
            showSuggestions('');
        }
    }

    // Updated finalizeStatement function
    function finalizeStatement() {
        if (path.length === 0) return;

        const statementText = constructStatementText(path);
        const startTime = statementStartTime || new Date();

        if (editingIndex !== null) {
            // Update existing entry
            history[editingIndex] = { time: startTime, path: [...path], text: statementText };
            updateHistoryTable();
        } else {
            // Add new entry
            history.push({ time: startTime, path: [...path], text: statementText });
            const row = createHistoryRow(startTime, statementText, path, history.length - 1);
            historyTableBody.insertBefore(row, historyTableBody.firstChild); // Prepend for top-first
        }

        // Reset state
        path = [];
        currentFlow = null;
        currentStep = null;
        statementStartTime = null;
        editingIndex = null;
        inputDiv.innerHTML = '';
        inputDiv.focus();
        showSuggestions('');
    }

    function constructStatementText(path) {
        if (path.length === 0) return '';
        const flowType = path[0].step;
        if (flowType === 'member') {
            const member = path.find(p => p.step === 'member')?.value || '';
            const action = path.find(p => p.step === 'action')?.value || '';
            const detail = path.find(p => p.step === 'movedDetail')?.value || '';
            const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
            let text = `${member} - ${action}`;
            if (detail) text += ` ${detail}`;
            if (rerefer) text += ` and Rerefer to ${getShortCommitteeName(rerefer)}`;
            return text;
        } else if (flowType === 'meetingAction') {
            const action = path.find(p => p.step === 'meetingAction')?.value || '';
            const member = path.find(p => p.step === 'memberOptional')?.value || '';
            let text = action;
            if (member) text += ` by ${member}`;
            return text;
        } else if (flowType === 'voteAction') {
            const voteType = path.find(p => p.step === 'voteType')?.value || '';
            if (voteType === 'Roll Call Vote') {
                const motionType = path.find(p => p.step === 'rollCallMotionType')?.value || '';
                const asAmended = path.find(p => p.step === 'asAmendedOptional')?.value || '';
                const voteResult = path.find(p => p.step === 'voteModule')?.value || '';
                const outcome = path.find(p => p.step === 'voteOutcome')?.value || '';
                const billCarrier = path.find(p => p.step === 'billCarrier')?.value || '';
                let text = `Roll Call Vote on ${motionType}`;
                if (asAmended) text += ` ${asAmended}`;
                if (voteResult) {
                    const result = JSON.parse(voteResult);
                    text += ` - For: ${result.for}, Against: ${result.against}, Outcome: ${result.outcome}`;
                }
                if (outcome === 'Passed' && billCarrier) text += ` - Bill Carrier: ${billCarrier}`;
                return text;
            } else if (voteType === 'Voice Vote') {
                const onWhat = path.find(p => p.step === 'voiceVoteOn')?.value || '';
                const outcome = path.find(p => p.step === 'voiceVoteOutcome')?.value || '';
                return `Voice Vote on ${onWhat} - ${outcome}`;
            } else if (voteType === 'Motion Failed') {
                const reason = path.find(p => p.step === 'motionFailedReason')?.value || '';
                return `Motion Failed ${reason}`;
            }
        }
        return path.map(p => p.value).join(' - ');
    }

    function getShortCommitteeName(fullName) {
        const match = fullName.match(/(\w+)\s+Committee$/);
        return match ? match[1] : fullName;
    }

    // New function to create history rows with edit icon
    function createHistoryRow(time, statementText, path, index) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${time.toLocaleTimeString()}</td>
            <td><div class="tags">${path.map(p => `<span class="token">${p.value}</span>`).join(' ')}</div><div>${statementText}</div></td>
            <td><span class="edit-icon" data-index="${index}">✏️</span></td>
        `;
        row.querySelector('.edit-icon').onclick = (e) => {
            e.stopPropagation(); // Prevent row click (copy to clipboard)
            editHistoryEntry(index);
        };
        row.onclick = () => {
            navigator.clipboard.writeText(statementText).then(() => {
                console.log('Copied to clipboard:', statementText);
            });
        };
        return row;
    }

    // New function to edit an entry
    function editHistoryEntry(index) {
        const entry = history[index];
        path = [...entry.path]; // Copy the path array
        statementStartTime = entry.time;
        editingIndex = index;
        updateInput();
        showSuggestions('');
    }

    // New function to refresh the history table
    function updateHistoryTable() {
        historyTableBody.innerHTML = '';
        history.forEach((entry, index) => {
            const row = createHistoryRow(entry.time, entry.text, entry.path, index);
            historyTableBody.insertBefore(row, historyTableBody.firstChild); // Prepend for top-first
        });
    }

    // Event listeners
    inputDiv.addEventListener('input', () => {
        const text = getCurrentText();
        showSuggestions(text);
        tryToTag(); // Attempt to convert text to tag as you type
    });

    // Handle Enter to lock in selection
    inputDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent newline
            const text = getCurrentText();
            const options = getCurrentOptions();
            const match = options.find(opt => opt.toLowerCase() === text.toLowerCase());
            if (match) {
                inputDiv.lastChild.textContent = ' '; // Clear text
                const tag = createTag(match, currentStep || 'startingPoint');
                inputDiv.insertBefore(tag, inputDiv.lastChild);
                selectOption(match);
            } else if (currentStep === null || (currentFlow && currentFlow.steps.find(step => step.step === currentStep)?.optional)) {
                finalizeStatement(); // Add this to finalize on Enter
            }
        } else if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.collapsed && inputDiv.childNodes.length > 1 && range.startOffset === 0 && inputDiv.lastChild.nodeType === Node.TEXT_NODE) {
                    e.preventDefault();
                    removeLastTag();
                }
            }
        } else if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            const suggestions = modal.querySelectorAll('.option');
            if (index < suggestions.length) {
                e.preventDefault();
                suggestions[index].click();
            }
        }
    });

    // Initialize
    inputDiv.focus();

    // Add CSS in style2.css
    document.addEventListener('click', (e) => {
        const dropdown = document.querySelector('.dropdown');
        if (dropdown && !dropdown.contains(e.target)) {
            document.body.removeChild(dropdown);
        }
    });
});