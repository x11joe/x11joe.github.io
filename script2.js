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
    const committeeSelect = document.getElementById('committeeSelect');
    const historyDiv = document.getElementById('history');
    const entryWrapper = document.querySelector('.entry-wrapper');

    // Populate committee dropdown
    Object.keys(committees).forEach(committee => {
        const option = document.createElement('option');
        option.value = committee;
        option.textContent = committee;
        committeeSelect.appendChild(option);
    });

    // Load saved committee from local storage
    const savedCommittee = localStorage.getItem('selectedCommittee');
    if (savedCommittee && committees[savedCommittee]) {
        currentCommittee = savedCommittee;
    }
    committeeSelect.value = currentCommittee;

    // Handle committee selection change
    committeeSelect.addEventListener('change', () => {
        currentCommittee = committeeSelect.value;
        localStorage.setItem('selectedCommittee', currentCommittee);
    });

    // Functions to serialize and deserialize history for local storage
    function serializeHistory(history) {
        return JSON.stringify(history.map(entry => ({
            time: entry.time.toISOString(),
            path: entry.path,
            text: entry.text
        })));
    }

    function deserializeHistory(serialized) {
        const parsed = JSON.parse(serialized);
        return parsed.map(entry => ({
            time: new Date(entry.time),
            path: entry.path,
            text: entry.text
        }));
    }

    // Load saved history from local storage
    const savedHistory = localStorage.getItem('historyStatements');
    if (savedHistory) {
        history = deserializeHistory(savedHistory);
        updateHistoryTable();
    }

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
        console.log('showTagOptions called - stepType:', stepType, 'pathIndex:', pathIndex);
        const flow = pathIndex === 0 && !currentFlow ? null : currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === stepType)?.flow];
        let options = [];
        
        if (pathIndex === 0 && !flow) {
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
        
        console.log('Options for dropdown:', options);
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        dropdown.style.position = 'absolute';
        dropdown.style.background = 'white';
        dropdown.style.border = '1px solid #ccc';
        dropdown.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        dropdown.style.zIndex = '1000';
        
        options.forEach(opt => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = opt;
            div.onclick = (e) => {
                e.stopPropagation();
                path[pathIndex].value = opt;
                updateInput();
                modal.classList.remove('active'); // Hide suggestions modal
                inputDiv.removeChild(dropdown);
                console.log('Tag updated to:', opt, 'at index:', pathIndex);
            };
            dropdown.appendChild(div);
        });
        
        inputDiv.appendChild(dropdown);
        dropdown.style.left = `${tagElement.offsetLeft}px`;
        dropdown.style.top = `${tagElement.offsetTop + tagElement.offsetHeight}px`;
        
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                inputDiv.removeChild(dropdown);
                document.removeEventListener('click', closeDropdown);
            }
        };
        document.addEventListener('click', closeDropdown);
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
        span.setAttribute('data-index', index);
        span.contentEditable = false;
        
        const textNode = document.createTextNode(text);
        const chevron = document.createElement('span');
        chevron.className = 'chevron';
        chevron.textContent = ' ▼';
        span.appendChild(textNode);
        span.appendChild(chevron);
        
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
        const textNode = document.createTextNode(' ');
        inputDiv.appendChild(textNode);
        inputDiv.focus();
        
        setTimeout(() => {
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(textNode, textNode.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }, 0);
    }

    // Show suggestions based on current text
    function showSuggestions(text) {
        console.log('showSuggestions called with text:', text, 'currentStep:', currentStep);
        if (!text && !currentStep) {
            modal.classList.remove('active');
            console.log('Modal hidden: no text and no current step');
            return;
        }
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
                    const tag = createTag(opt, currentStep || 'startingPoint', path.length);
                    inputDiv.insertBefore(tag, inputDiv.lastChild);
                    selectOption(opt);
                };
                modal.appendChild(div);
            });
            modal.classList.add('active');
            positionModal();
            console.log('Modal shown with options:', filtered);
        } else {
            modal.classList.remove('active');
            console.log('Modal hidden: no filtered options');
        }
    }

    // Position modal above input
    function positionModal() {
        const rect = inputDiv.getBoundingClientRect();
        // Positioned via CSS
    }

    // Remove last tag on backspace
    function removeLastTag() {
        if (path.length > 0) {
            path.pop();
            if (path.length > 0) {
                // Determine currentFlow based on the first tag's step
                const firstStep = path[0].step;
                const startingPoint = jsonStructure.startingPoints.find(sp => sp.type === firstStep);
                if (startingPoint) {
                    currentFlow = jsonStructure.flows[startingPoint.flow];
                    if (path.length === 1) {
                        currentStep = currentFlow.steps[0].step;
                    } else {
                        const lastPart = path[path.length - 1];
                        const stepConfig = currentFlow.steps.find(step => step.step === lastPart.step);
                        if (stepConfig && stepConfig.next) {
                            if (typeof stepConfig.next === 'string') {
                                currentStep = stepConfig.next;
                            } else if (typeof stepConfig.next === 'object') {
                                currentStep = stepConfig.next[lastPart.value] || stepConfig.next.default || null;
                            }
                        } else {
                            currentStep = null;
                        }
                    }
                } else {
                    console.warn('No starting point found for step:', firstStep);
                    currentFlow = null;
                    currentStep = null;
                }
            } else {
                currentFlow = null;
                currentStep = null;
            }
            updateInput();
            const text = getCurrentText();
            showSuggestions(text);
        }
    }

    // Updated finalizeStatement function
    function finalizeStatement() {
        if (path.length === 0) return;
        
        const statementText = constructStatementText(path);
        const startTime = statementStartTime || new Date();
        
        if (editingIndex !== null) {
            history[editingIndex] = { time: startTime, path: [...path], text: statementText };
            updateHistoryTable();
        } else {
            history.push({ time: startTime, path: [...path], text: statementText });
            const row = createHistoryRow(startTime, statementText, path, history.length - 1);
            historyTableBody.insertBefore(row, historyTableBody.firstChild);
            setTimeout(() => {
                const historyWrapper = document.getElementById('historyWrapper');
                historyWrapper.scrollTop = 0;
                console.log('Scrolled to top after adding new entry');
            }, 0);
        }
        
        localStorage.setItem('historyStatements', serializeHistory(history));
        
        editingIndex = null;
        path = [];
        currentFlow = null;
        currentStep = null;
        statementStartTime = null;
        inputDiv.innerHTML = '';
        inputDiv.appendChild(document.createTextNode(' '));
        inputDiv.focus();
        showSuggestions('');
    }

    function constructStatementText(path) {
        if (path.length === 0) return '';
        const flowType = path[0].step;
        if (flowType === 'member') {
            const memberFullName = path.find(p => p.step === 'member')?.value || '';
            const lastName = getLastName(memberFullName);
            const chamberPrefix = isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative';
            const action = path.find(p => p.step === 'action')?.value || '';
            const detail = path.find(p => p.step === 'movedDetail')?.value || '';
            const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
            let text = `${chamberPrefix} ${lastName} - ${action}`;
            if (detail) text += ` ${detail}`;
            if (rerefer) text += ` and Rerefer to ${getShortCommitteeName(rerefer)}`;
            return text;
        } else if (flowType === 'meetingAction') {
            const action = path.find(p => p.step === 'meetingAction')?.value || '';
            const memberFullName = path.find(p => p.step === 'memberOptional')?.value || '';
            let text = action;
            if (memberFullName) {
                const lastName = getLastName(memberFullName);
                const chamberPrefix = isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative';
                text += ` by ${chamberPrefix} ${lastName}`;
            }
            return text;
        } else if (flowType === 'voteAction') {
            const voteType = path.find(p => p.step === 'voteType')?.value || '';
            if (voteType === 'Roll Call Vote') {
                const motionType = path.find(p => p.step === 'rollCallMotionType')?.value || '';
                const asAmended = path.find(p => p.step === 'asAmendedOptional')?.value || '';
                const voteResult = path.find(p => p.step === 'voteModule')?.value || '';
                const outcome = path.find(p => p.step === 'voteOutcome')?.value || '';
                const billCarrierFullName = path.find(p => p.step === 'billCarrier')?.value || '';
                let text = `Roll Call Vote on ${motionType}`;
                if (asAmended) text += ` ${asAmended}`;
                if (voteResult) {
                    const result = JSON.parse(voteResult);
                    text += ` - For: ${result.for}, Against: ${result.against}, Outcome: ${result.outcome}`;
                }
                if (outcome === 'Passed' && billCarrierFullName) {
                    const lastName = getLastName(billCarrierFullName);
                    const chamberPrefix = isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative';
                    text += ` - Bill Carrier: ${chamberPrefix} ${lastName}`;
                }
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

    function createHistoryRow(time, statementText, path, index) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${time.toLocaleTimeString()}</td>
            <td><div class="tags">${path.map(p => `<span class="token">${p.value}</span>`).join(' ')}</div><div>${statementText}</div></td>
            <td><span class="edit-icon" data-index="${index}">✏️</span></td>
            <td><span class="delete-icon" data-index="${index}">🗑️</span></td> <!-- Added delete icon -->
        `;
        row.querySelector('.edit-icon').onclick = (e) => {
            e.stopPropagation();
            editHistoryEntry(index);
        };
        row.querySelector('.delete-icon').onclick = (e) => {
            e.stopPropagation();
            deleteHistoryEntry(index);
        };
        row.onclick = () => {
            navigator.clipboard.writeText(statementText).then(() => {
                console.log('Copied to clipboard:', statementText);
            });
        };
        return row;
    }

    function deleteHistoryEntry(index) {
        history.splice(index, 1); // Remove the entry at the specified index
        localStorage.setItem('historyStatements', serializeHistory(history)); // Update local storage
        updateHistoryTable(); // Refresh the table
    }

    function editHistoryEntry(index) {
        const entry = history[index];
        path = [...entry.path];
        statementStartTime = entry.time;
        editingIndex = index;
    
        currentFlow = null;
        currentStep = null;
    
        path.forEach((part, i) => {
            if (i === 0) {
                const startingPoint = jsonStructure.startingPoints.find(sp => sp.type === part.step);
                if (startingPoint) {
                    currentFlow = jsonStructure.flows[startingPoint.flow];
                    const firstStep = currentFlow.steps[0];
                    if (firstStep.step === part.step) {
                        currentStep = firstStep.next;
                    } else {
                        currentStep = firstStep.step;
                    }
                }
            } else {
                const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
                if (stepConfig && stepConfig.next) {
                    if (typeof stepConfig.next === 'string') {
                        currentStep = stepConfig.next;
                    } else if (typeof stepConfig.next === 'object') {
                        currentStep = stepConfig.next[part.value] || stepConfig.next.default;
                    }
                } else {
                    currentStep = null;
                }
            }
        });
    
        console.log('editHistoryEntry: currentFlow:', currentFlow, 'currentStep:', currentStep, 'path:', path);
        updateInput();
        showSuggestions('');
    }

    function updateHistoryTable() {
        historyTableBody.innerHTML = '';
        history.forEach((entry, index) => {
            const row = createHistoryRow(entry.time, entry.text, entry.path, index);
            historyTableBody.insertBefore(row, historyTableBody.firstChild);
        });
    }

    function updateLegend() {
        const memberList = document.getElementById('memberList');
        memberList.innerHTML = ''; // Clear existing list
        const members = getCommitteeMembers();
        members.forEach((member, index) => {
            const li = document.createElement('li');
            let displayName = member;
            if (index === 0) { // Assume the first member is the chairperson
                const isFemaleChair = isFemale(member);
                const chairTitle = isFemaleChair ? 'Chairwoman' : 'Chairman';
                displayName = `${chairTitle} ${getLastName(member)}`;
            } else {
                displayName = member; // Full name for non-chair members
            }
            li.textContent = displayName;
            li.onclick = () => {
                if (path.length === 0) { // Only allow if no current path is being edited
                    selectOption(member); // Start the flow with this member
                } else {
                    console.log('Cannot select member while editing existing path');
                }
            };
            memberList.appendChild(li);
        });
    }

    function updateMeetingActionsLegend() {
        const meetingActionsList = document.getElementById('meetingActionsList');
        meetingActionsList.innerHTML = ''; // Clear existing list
        const meetingActions = jsonStructure.startingPoints.find(sp => sp.type === "meetingAction").options;
        meetingActions.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action;
            li.onclick = () => {
                if (path.length === 0) {
                    selectOption(action);
                } else {
                    console.log('Cannot select meeting action while editing existing path');
                }
            };
            meetingActionsList.appendChild(li);
        });
    }

    function updateVoteActionsLegend() {
        const voteActionsList = document.getElementById('voteActionsList');
        voteActionsList.innerHTML = ''; // Clear existing list
        const voteActionSP = jsonStructure.startingPoints.find(sp => sp.type === "voteAction");
        if (voteActionSP) {
            const voteActions = voteActionSP.options; // ["Roll Call Vote", "Voice Vote", "Motion Failed"]
            voteActions.forEach(action => {
                const li = document.createElement('li');
                li.textContent = action;
                li.onclick = () => {
                    if (path.length === 0) {
                        selectOption(action); // Start the vote action flow
                    } else {
                        console.log('Cannot select vote action while editing existing path');
                    }
                };
                voteActionsList.appendChild(li);
            });
        } else {
            console.warn('No voteAction starting point found in flows.json');
        }
    }

    // Determine if the committee is a Senate committee
    function isSenateCommittee(committeeName) {
        return committeeName.toLowerCase().includes("senate");
    }

    // Extract the last name from a full name
    function getLastName(fullName) {
        const parts = fullName.split(' ');
        return parts[parts.length - 1];
    }

    // Check if a member is female based on the FEMALE_NAMES array
    function isFemale(fullName) {
        return window.FEMALE_NAMES.includes(fullName);
    }

    // Function to adjust history position and height
    function adjustHistoryLayout() {
        const entryRect = entryWrapper.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const gap = 10; // Gap between entry and history in pixels

        // Calculate top position for history (just below entry)
        const historyTop = entryRect.bottom + gap;
        historyDiv.style.top = `${historyTop}px`;

        // Calculate maximum height for history (from its top to bottom of viewport)
        const maxHistoryHeight = viewportHeight - historyTop - 10; // 10px bottom margin
        historyDiv.style.height = `${maxHistoryHeight}px`;
    }

    // Update the committee selection event listener
    committeeSelect.addEventListener('change', () => {
        currentCommittee = committeeSelect.value;
        localStorage.setItem('selectedCommittee', currentCommittee);
        updateLegend(); // Update the legend when committee changes
    });

    // Event listeners
    inputDiv.addEventListener('input', () => {
        const text = getCurrentText();
        showSuggestions(text);
        tryToTag();
        adjustHistoryLayout(); // Adjust layout on input
    });

    inputDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.collapsed) {
                    const container = range.startContainer;
                    const offset = range.startOffset;
                    if (container === inputDiv.lastChild && offset === inputDiv.lastChild.textContent.length && path.length > 0) {
                        e.preventDefault();
                        removeLastTag();
                    }
                }
            }
        } else if (e.key === 'Tab') {
            const suggestions = modal.querySelectorAll('.option');
            if (suggestions.length > 0) {
                e.preventDefault();
                suggestions[0].click();
            }
        } else if (e.key >= '1' && e.key <= '9') {
            const index = parseInt(e.key) - 1;
            const suggestions = modal.querySelectorAll('.option');
            if (index < suggestions.length) {
                e.preventDefault();
                suggestions[index].click();
                return;
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const text = getCurrentText();
            const options = getCurrentOptions();
            const match = options.find(opt => opt.toLowerCase() === text.toLowerCase());
            if (match) {
                inputDiv.lastChild.textContent = ' ';
                const tag = createTag(match, currentStep || 'startingPoint', path.length);
                inputDiv.insertBefore(tag, inputDiv.lastChild);
                selectOption(match);
            } else {
                finalizeStatement();
            }
        }
    });

    inputDiv.focus();

    inputDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('chevron')) {
            const token = e.target.parentElement;
            const type = token.getAttribute('data-type');
            const index = parseInt(token.getAttribute('data-index'), 10);
            console.log('Chevron clicked - type:', type, 'index:', index);
            showTagOptions(token, type, index);
        }
    });

    // Add this after DOM elements are defined
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    clearHistoryBtn.addEventListener('click', () => {
        history = []; // Clear the history array
        localStorage.removeItem('historyStatements'); // Remove from local storage
        updateHistoryTable(); // Refresh the table
    });

    // Call updateLegend initially to populate it
    updateMeetingActionsLegend();
    updateVoteActionsLegend();
    updateLegend();

    // Call adjustHistoryLayout on load, resize, and input changes
    adjustHistoryLayout();
    window.addEventListener('resize', adjustHistoryLayout);
    inputDiv.addEventListener('input', adjustHistoryLayout);
});