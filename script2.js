document.addEventListener('DOMContentLoaded', async () => {
    const committees = window.DEFAULT_COMMITTEES || {};
    let currentCommittee = "Senate Judiciary Committee";
    let jsonStructure;
    try {
        const response = await fetch('flows.json');
        jsonStructure = await response.json();
        console.log('flows.json loaded:', jsonStructure);
    } catch (error) {
        console.error('Error loading flows.json:', error);
        return;
    }

    const suggestMotionType = () => ["Do Pass", "Do Not Pass", "Without Committee Recommendation"];
    const suggestFailedReason = () => ["for lack of a second"];

    let path = [];
    let currentFlow = null;
    let currentStep = null;
    let statementStartTime = null;
    let history = [];
    let editingIndex = null;
    let dropdownActive = false;
    let selectedSuggestionIndex = -1;
    let selectedDropdownIndex = -1;
    let lastAction = null; // Track the last action for smarter suggestions

    const inputDiv = document.getElementById('input');
    const modal = document.getElementById('modal');
    const historyTableBody = document.querySelector('#historyTable tbody');
    const committeeSelect = document.getElementById('committeeSelect');
    const historyDiv = document.getElementById('history');
    const entryWrapper = document.querySelector('.entry-wrapper');

    Object.keys(committees).forEach(committee => {
        const option = document.createElement('option');
        option.value = committee;
        option.textContent = committee;
        committeeSelect.appendChild(option);
    });

    const savedCommittee = localStorage.getItem('selectedCommittee');
    if (savedCommittee && committees[savedCommittee]) {
        currentCommittee = savedCommittee;
    }
    committeeSelect.value = currentCommittee;

    committeeSelect.addEventListener('change', () => {
        currentCommittee = committeeSelect.value;
        localStorage.setItem('selectedCommittee', currentCommittee);
        updateLegend();
        console.log('Committee changed to:', currentCommittee);
    });

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

    const savedHistory = localStorage.getItem('historyStatements');
    if (savedHistory) {
        history = deserializeHistory(savedHistory);
        updateHistoryTable();
        console.log('History loaded from local storage:', history);
    }

    function getCommitteeMembers() {
        return committees[currentCommittee] || [];
    }

    function getOtherCommittees() {
        const isHouse = currentCommittee.toLowerCase().includes("house");
        return Object.keys(committees).filter(c => 
            isHouse ? c.toLowerCase().includes("house") : c.toLowerCase().includes("senate")
        ).filter(c => c !== currentCommittee);
    }

    function getOptionsForStep(stepType, flow) {
        const stepConfig = flow.steps.find(step => step.step === stepType);
        if (!stepConfig) return [];
        let options = [];
        if (stepConfig.options === "committeeMembers") {
            options = getCommitteeMembers();
        } else if (stepConfig.options === "otherCommittees") {
            options = getOtherCommittees();
        } else if (stepConfig.options === "suggestMotionType") {
            options = suggestMotionType();
        } else if (stepConfig.options === "suggestFailedReason") {
            options = suggestFailedReason();
        } else if (Array.isArray(stepConfig.options)) {
            options = stepConfig.options;
        }
        return options;
    }

    function getCurrentOptions() {
        console.log('getCurrentOptions - currentFlow:', currentFlow, 'currentStep:', currentStep);
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
            let options = getOptionsForStep(currentStep, currentFlow);
            // Reorder options for 'action' step in committeeMemberFlow based on lastAction
            if (currentFlow === jsonStructure.flows.committeeMemberFlow && currentStep === 'action' && lastAction) {
                if (lastAction === 'Moved') {
                    // Prioritize "Seconded" after "Moved"
                    options = ['Seconded', ...options.filter(opt => opt !== 'Seconded')];
                } else if (lastAction === 'Seconded' || lastAction === 'Withdrew') {
                    // Prioritize "Moved" after "Seconded" or "Withdrew"
                    options = ['Moved', ...options.filter(opt => opt !== 'Moved')];
                }
                // For other actions, keep default order
                console.log('Reordered action options based on lastAction:', lastAction, 'new options:', options);
            }
            return options;
        }
    }

    function getCurrentText() {
        let text = '';
        for (let i = inputDiv.childNodes.length - 1; i >= 0; i--) {
            const node = inputDiv.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE) {
                text = node.textContent + text;
            } else if (node.classList && node.classList.contains('token')) {
                break;
            }
        }
        return text.trim();
    }

    function showTagOptions(tagElement, stepType, pathIndex) {
        console.log('showTagOptions - stepType:', stepType, 'pathIndex:', pathIndex);
        const flow = currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === stepType)?.flow];
        const options = getOptionsForStep(stepType, flow);
        
        console.log('Tag options:', options);
        modal.classList.remove('active');
        
        const existingDropdown = document.querySelector('.dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }
    
        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';
        
        options.forEach((opt, idx) => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = opt;
            div.onclick = (e) => {
                e.stopPropagation();
                const oldValue = path[pathIndex].value;
                path[pathIndex].value = opt;
                console.log('Tag updated at index', pathIndex, 'from', oldValue, 'to:', opt);
                smartInvalidateSubsequentTags(pathIndex, oldValue, opt);
                updateInput();
                dropdown.remove();
                dropdownActive = false;
                setTimeout(() => showSuggestions(getCurrentText()), 0);
            };
            dropdown.appendChild(div);
        });
        
        // Append to body instead of inputDiv
        document.body.appendChild(dropdown);
        const tagRect = tagElement.getBoundingClientRect();
        dropdown.style.position = 'absolute'; // Ensure absolute positioning
        dropdown.style.left = `${tagRect.left}px`;
        dropdown.style.top = `${tagRect.bottom}px`;
        dropdown.style.zIndex = '10001'; // Explicitly set high z-index
        dropdownActive = true;
        selectedDropdownIndex = -1;
    
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target) && e.target !== tagElement.querySelector('.chevron')) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
                dropdownActive = false;
                setTimeout(() => showSuggestions(getCurrentText()), 0);
            }
        };
        document.addEventListener('click', closeDropdown);
    }

    function smartInvalidateSubsequentTags(changedIndex, oldValue, newValue) {
        console.log('smartInvalidateSubsequentTags - changedIndex:', changedIndex, 'oldValue:', oldValue, 'newValue:', newValue);
        const part = path[changedIndex];
        const flow = currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === part.step)?.flow];
        const stepConfig = flow.steps.find(step => step.step === part.step);
        
        if (stepConfig && stepConfig.next && typeof stepConfig.next === 'object') {
            const oldNextStep = stepConfig.next[oldValue] || stepConfig.next.default;
            const newNextStep = stepConfig.next[newValue] || stepConfig.next.default;
            if (oldNextStep !== newNextStep) {
                console.log('Flow path changed, invalidating subsequent tags');
                path = path.slice(0, changedIndex + 1);
                currentStep = newNextStep;
                currentFlow = flow;
            } else {
                console.log('Flow path unchanged, no invalidation needed');
            }
        } else {
            console.log('Non-critical step or no branching, no invalidation');
        }
    }

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
                    console.log('tryToTag - Matched:', match);
                    const tag = createTag(match, currentStep || 'startingPoint', path.length);
                    lastTextNode.textContent = text.slice(0, -lastWord.length).trim() + ' ';
                    inputDiv.insertBefore(tag, lastTextNode);
                    selectOption(match);
                }
            }
        }
    }

    function selectOption(option) {
        console.log('selectOption - option:', option);
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
                console.log('Flow set to:', startingPoint.flow);
                const firstStep = currentFlow.steps[0];
                let stepOptions = firstStep.options === "committeeMembers" ? getCommitteeMembers() : firstStep.options;
                if (stepOptions.includes(option)) {
                    path.push({ step: firstStep.step, value: option });
                    currentStep = typeof firstStep.next === 'string' ? firstStep.next : firstStep.next?.default;
                } else {
                    path.push({ step: startingPoint.type, value: option });
                    currentStep = firstStep.step;
                }
                console.log('Initial path:', path, 'currentStep:', currentStep);
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
                console.log('Next currentStep:', currentStep);
            } else {
                currentStep = null;
                console.log('No next step, currentStep set to null');
            }
        }
        if (path.length === 1) statementStartTime = new Date();
        updateInput();
        showSuggestions('');
    }

    function handleModule(stepConfig, triggerOption) {
        console.log('handleModule - stepConfig:', stepConfig);
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
            console.log('Module submitted - path:', path, 'currentStep:', currentStep);
            updateInput();
            modal.classList.remove('active');
        };
        form.appendChild(submit);
        modal.appendChild(form);
        modal.classList.add('active');
        positionModal();
    }

    function updateInput() {
        console.log('updateInput - path:', path);
        inputDiv.innerHTML = '';
        path.forEach((part, index) => {
            const displayText = getTagText(part.step, part.value);
            const tag = createTag(displayText, part.step, index);
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

    function showSuggestions(text) {
        console.log('showSuggestions - text:', text, 'currentStep:', currentStep, 'currentFlow:', currentFlow);
        if (!text && !currentStep) {
            modal.classList.remove('active');
            console.log('Modal hidden: no text and no current step');
            return;
        }
        if (dropdownActive) {
            console.log('Suggestions skipped: dropdown is active');
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
                    inputDiv.lastChild.textContent = ' ';
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
        selectedSuggestionIndex = -1;
    }

    function positionModal() {
        // Positioned via CSS
    }

    function updateSuggestionHighlight(suggestions) {
        suggestions.forEach((sug, idx) => {
            sug.classList.toggle('highlighted', idx === selectedSuggestionIndex);
        });
    }

    function updateDropdownHighlight(dropdown) {
        const options = dropdown.querySelectorAll('.dropdown-option');
        options.forEach((opt, idx) => {
            opt.classList.toggle('highlighted', idx === selectedDropdownIndex);
        });
    }

    function removeLastTag() {
        if (path.length > 0) {
            path.pop();
            console.log('removeLastTag - After pop, path:', path);
            if (path.length > 0) {
                const firstStep = path[0].step;
                const startingPoint = jsonStructure.startingPoints.find(sp => sp.type === firstStep);
                if (startingPoint) {
                    currentFlow = jsonStructure.flows[startingPoint.flow];
                    console.log('currentFlow set to:', startingPoint.flow);
                    if (path.length === 1) {
                        const firstStepConfig = currentFlow.steps[0];
                        currentStep = firstStepConfig.next;
                        console.log('Path has one tag, currentStep set to:', currentStep);
                    } else {
                        const lastPart = path[path.length - 1];
                        const stepConfig = currentFlow.steps.find(step => step.step === lastPart.step);
                        if (stepConfig && stepConfig.next) {
                            if (typeof stepConfig.next === 'string') {
                                currentStep = stepConfig.next;
                            } else if (typeof stepConfig.next === 'object') {
                                currentStep = stepConfig.next[lastPart.value] || stepConfig.next.default || null;
                            }
                            console.log('Path has multiple tags, currentStep set to:', currentStep);
                        } else {
                            currentStep = null;
                            console.log('No next step found, currentStep set to null');
                        }
                    }
                } else {
                    currentFlow = null;
                    currentStep = null;
                    console.log('No starting point found, currentFlow and currentStep set to null');
                }
            } else {
                currentFlow = null;
                currentStep = null;
                console.log('Path is empty, currentFlow and currentStep set to null');
            }
            updateInput();
            const text = getCurrentText();
            showSuggestions(text);
        }
    }

    function finalizeStatement() {
        if (path.length === 0) return;
        
        const statementText = constructStatementText(path);

        // Update lastAction for committeeMemberFlow
        if (currentFlow === jsonStructure.flows.committeeMemberFlow) {
            const actionPart = path.find(p => p.step === 'action');
            if (actionPart) {
                lastAction = actionPart.value;
                console.log('Updated lastAction to:', lastAction);
            }
        }

        const startTime = statementStartTime || new Date();
        
        if (editingIndex !== null) {
            history[editingIndex] = { time: startTime, path: [...path], text: statementText };
            console.log('Edited history entry at index', editingIndex, ':', history[editingIndex]);
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
            console.log('Added new history entry:', history[history.length - 1]);
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
            const memberString = path.find(p => p.step === 'member')?.value || '';
            const { lastName, title } = parseMember(memberString);
            const action = path.find(p => p.step === 'action')?.value || '';
            const detail = path.find(p => p.step === 'movedDetail')?.value || '';
            const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
            let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
            let text = `${memberText} - ${action}`;
            if (detail) text += ` ${detail}`;
            if (rerefer) text += ` and Rerefer to ${getShortCommitteeName(rerefer)}`;
            return text;
        } else if (flowType === 'meetingAction') {
            const action = path.find(p => p.step === 'meetingAction')?.value || '';
            const memberString = path.find(p => p.step === 'memberOptional')?.value || '';
            let text = action;
            if (memberString) {
                const { lastName, title } = parseMember(memberString);
                let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
                text += ` by ${memberText}`;
            }
            return text;
        } else if (flowType === 'voteAction') {
            const voteType = path.find(p => p.step === 'voteType')?.value || '';
            if (voteType === 'Roll Call Vote') {
                const motionType = path.find(p => p.step === 'rollCallMotionType')?.value || '';
                const asAmended = path.find(p => p.step === 'asAmendedOptional')?.value || '';
                const voteResult = path.find(p => p.step === 'voteModule')?.value || '';
                const outcome = path.find(p => p.step === 'voteOutcome')?.value || '';
                const billCarrierString = path.find(p => p.step === 'billCarrier')?.value || '';
                let text = `Roll Call Vote on ${motionType}`;
                if (asAmended) text += ` ${asAmended}`;
                if (voteResult) {
                    const result = JSON.parse(voteResult);
                    text += ` - For: ${result.for}, Against: ${result.against}, Outcome: ${result.outcome}`;
                }
                if (outcome === 'Passed' && billCarrierString) {
                    const { lastName, title } = parseMember(billCarrierString);
                    let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
                    text += ` - Bill Carrier: ${memberText}`;
                }
                return text;
            } else if (voteType === 'Voice Vote') {
                const onWhat = path.find(p => p.step === 'voiceVoteOn')?.value || '';
                const outcome = path.find(p => p.step === 'voteOutcome')?.value || '';
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

    function parseMember(memberString) {
        const parts = memberString.split(' - ');
        if (parts.length === 2) {
            const name = parts[0];
            let baseTitle = parts[1];
            const isFemaleMember = isFemale(name);
            if (baseTitle === 'Chairman') baseTitle = isFemaleMember ? 'Chairwoman' : 'Chairman';
            else if (baseTitle === 'Vice Chairman') baseTitle = isFemaleMember ? 'Vice Chairwoman' : 'Vice Chairman';
            const lastName = name.split(' ').pop();
            return { name, lastName, title: baseTitle };
        } else {
            const name = memberString;
            const lastName = name.split(' ').pop();
            return { name, lastName, title: null };
        }
    }

    function getTagText(step, value) {
        if (step === 'member' || step === 'memberOptional' || step === 'billCarrier') {
            const { name, title } = parseMember(value);
            return title ? `${title} ${name}` : name;
        }
        return value;
    }

    function createHistoryRow(time, statementText, path, index) {
        const row = document.createElement('tr');
        const tagsHtml = path.map(p => `<span class="token">${getTagText(p.step, p.value)}</span>`).join(' ');
        row.innerHTML = `
            <td>${time.toLocaleTimeString()}</td>
            <td><div class="tags">${tagsHtml}</div><div>${statementText}</div></td>
            <td><span class="edit-icon" data-index="${index}">✏️</span></td>
            <td><span class="delete-icon" data-index="${index}">🗑️</span></td>
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
        history.splice(index, 1);
        localStorage.setItem('historyStatements', serializeHistory(history));
        updateHistoryTable();
        console.log('Deleted history entry at index:', index);
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
                        currentStep = typeof firstStep.next === 'string' ? firstStep.next : firstStep.next?.default;
                    } else {
                        currentStep = firstStep.step;
                    }
                    console.log('editHistoryEntry - Initial flow:', startingPoint.flow, 'currentStep:', currentStep);
                }
            } else {
                const stepConfig = currentFlow.steps.find(step => step.step === part.step);
                if (stepConfig && stepConfig.next) {
                    if (typeof stepConfig.next === 'string') {
                        currentStep = stepConfig.next;
                    } else if (typeof stepConfig.next === 'object') {
                        currentStep = stepConfig.next[part.value] || stepConfig.next.default;
                    }
                    console.log('editHistoryEntry - Step:', part.step, 'currentStep updated to:', currentStep);
                } else {
                    currentStep = null;
                    console.log('editHistoryEntry - No next step, currentStep set to null');
                }
            }
        });
    
        console.log('editHistoryEntry - Final state - path:', path, 'currentFlow:', currentFlow, 'currentStep:', currentStep);
        updateInput();
        showSuggestions('');
    }

    function updateHistoryTable() {
        historyTableBody.innerHTML = '';
        history.forEach((entry, index) => {
            const row = createHistoryRow(entry.time, entry.text, entry.path, index);
            historyTableBody.insertBefore(row, historyTableBody.firstChild);
        });
        console.log('History table updated');
    }

    function updateLegend() {
        const memberList = document.getElementById('memberList');
        memberList.innerHTML = '';
        const members = getCommitteeMembers();
        
        const parsedMembers = members.map(member => ({
            original: member,
            parsed: parseMember(member)
        }));
        
        const chairperson = parsedMembers.find(m => m.parsed.title === "Chairwoman" || m.parsed.title === "Chairman");
        const viceChairperson = parsedMembers.find(m => m.parsed.title === "Vice Chairwoman" || m.parsed.title === "Vice Chairman");
        const otherMembers = parsedMembers.filter(m => m !== chairperson && m !== viceChairperson);
        
        const createLi = (member) => {
            const li = document.createElement('li');
            const displayName = member.parsed.title ? `${member.parsed.title} ${member.parsed.name}` : member.parsed.name;
            li.textContent = displayName;
            li.onclick = () => {
                if (path.length === 0) {
                    selectOption(member.original);
                } else {
                    console.log('Cannot select member while editing existing path');
                }
            };
            return li;
        };
        
        if (chairperson) {
            memberList.appendChild(createLi(chairperson));
            memberList.appendChild(document.createElement('hr'));
        }
        
        if (viceChairperson) {
            memberList.appendChild(createLi(viceChairperson));
            memberList.appendChild(document.createElement('hr'));
        }
        
        otherMembers.forEach(member => {
            memberList.appendChild(createLi(member));
        });
        console.log('Legend updated');
    }

    function updateMeetingActionsLegend() {
        const meetingActionsList = document.getElementById('meetingActionsList');
        meetingActionsList.innerHTML = '';
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
        console.log('Meeting actions legend updated');
    }

    function updateVoteActionsLegend() {
        const voteActionsList = document.getElementById('voteActionsList');
        voteActionsList.innerHTML = '';
        const voteActionSP = jsonStructure.startingPoints.find(sp => sp.type === "voteAction");
        if (voteActionSP) {
            const voteActions = voteActionSP.options;
            voteActions.forEach(action => {
                const li = document.createElement('li');
                li.textContent = action;
                li.onclick = () => {
                    if (path.length === 0) {
                        selectOption(action);
                    } else {
                        console.log('Cannot select vote action while editing existing path');
                    }
                };
                voteActionsList.appendChild(li);
            });
            console.log('Vote actions legend updated');
        } else {
            console.warn('No voteAction starting point found in flows.json');
        }
    }

    function isSenateCommittee(committeeName) {
        return committeeName.toLowerCase().includes("senate");
    }

    function isFemale(fullName) {
        return window.FEMALE_NAMES.includes(fullName);
    }

    function adjustHistoryLayout() {
        const entryRect = entryWrapper.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const gap = 10;
        const historyTop = entryRect.bottom + gap;
        historyDiv.style.top = `${historyTop}px`;
        const maxHistoryHeight = viewportHeight - historyTop - 10;
        historyDiv.style.height = `${maxHistoryHeight}px`;
    }

    inputDiv.addEventListener('input', () => {
        const text = getCurrentText();
        showSuggestions(text);
        tryToTag();
        adjustHistoryLayout();
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
            } else {
                finalizeStatement();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (dropdownActive) {
                const dropdown = document.querySelector('.dropdown');
                if (dropdown) {
                    const options = dropdown.querySelectorAll('.dropdown-option');
                    if (options.length > 0) {
                        selectedDropdownIndex = Math.min(selectedDropdownIndex + 1, options.length - 1);
                        updateDropdownHighlight(dropdown);
                    }
                }
            } else if (modal.classList.contains('active')) {
                const suggestions = modal.querySelectorAll('.option');
                if (suggestions.length > 0) {
                    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                    updateSuggestionHighlight(suggestions);
                }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (dropdownActive) {
                const dropdown = document.querySelector('.dropdown');
                if (dropdown) {
                    const options = dropdown.querySelectorAll('.dropdown-option');
                    if (options.length > 0) {
                        selectedDropdownIndex = selectedDropdownIndex <= 0 ? -1 : selectedDropdownIndex - 1;
                        updateDropdownHighlight(dropdown);
                    }
                }
            } else if (modal.classList.contains('active')) {
                const suggestions = modal.querySelectorAll('.option');
                if (suggestions.length > 0) {
                    selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? -1 : selectedSuggestionIndex - 1;
                    updateSuggestionHighlight(suggestions);
                }
            }
        } else if (e.key === 'Escape' && dropdownActive) {
            document.dispatchEvent(new MouseEvent('click'));
            e.preventDefault();
        }
    });

    inputDiv.focus();

    inputDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('chevron')) {
            e.stopPropagation();
            const token = e.target.parentElement;
            const type = token.getAttribute('data-type');
            const index = parseInt(token.getAttribute('data-index'), 10);
            console.log('Chevron clicked - type:', type, 'index:', index);
            showTagOptions(token, type, index);
        }
    });

    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    clearHistoryBtn.addEventListener('click', () => {
        history = [];
        localStorage.removeItem('historyStatements');
        updateHistoryTable();
        console.log('History cleared');
    });

    updateMeetingActionsLegend();
    updateVoteActionsLegend();
    updateLegend();

    adjustHistoryLayout();
    window.addEventListener('resize', adjustHistoryLayout);
    inputDiv.addEventListener('input', adjustHistoryLayout);
});