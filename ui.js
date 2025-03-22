// ui.js - Manages UI updates, including input rendering, suggestions, and history table

// Create a tag element for the input div
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

// Update the input div with current path tags
function updateInput() {
    const inputDiv = document.getElementById('input');
    const path = window.path; // From main.js scope
    inputDiv.innerHTML = '';
    path.forEach((part, index) => {
        const displayText = part.display || getTagText(part.step, part.value);
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

// Show suggestions based on current input text
function showSuggestions(text) {
    const modal = document.getElementById('modal');
    if (!text && !window.currentStep) {
        modal.classList.remove('active');
        return;
    }
    if (window.dropdownActive) return;
    const options = getCurrentOptions(); // From flows.js
    if (window.currentStep === 'voteModule') {
        const jsonStructure = window.jsonStructure;
        const stepConfig = window.currentFlow.steps.find(step => step.step === 'voteModule');
        if (stepConfig) handleModule(stepConfig, null);
        return;
    }
    const filtered = text ? options.filter(opt => opt.toLowerCase().includes(text.toLowerCase())) : options;
    modal.innerHTML = '';
    if (filtered.length > 0) {
        filtered.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = 'option';
            div.textContent = `${index + 1}. ${opt}`;
            div.onclick = () => {
                const inputDiv = document.getElementById('input');
                inputDiv.lastChild.textContent = ' ';
                const tag = createTag(opt, window.currentStep || 'startingPoint', window.path.length);
                inputDiv.insertBefore(tag, inputDiv.lastChild);
                selectOption(opt); // From flows.js
            };
            modal.appendChild(div);
        });
        modal.classList.add('active');
    } else {
        modal.classList.remove('active');
    }
    window.selectedSuggestionIndex = -1;
}

// Update highlight for suggestion options
function updateSuggestionHighlight(suggestions) {
    suggestions.forEach((sug, idx) => {
        sug.classList.toggle('highlighted', idx === window.selectedSuggestionIndex);
    });
}

// Update highlight for dropdown options
function updateDropdownHighlight(dropdown) {
    const options = dropdown.querySelectorAll('.dropdown-option');
    options.forEach((opt, idx) => {
        opt.classList.toggle('highlighted', idx === window.selectedDropdownIndex);
    });
}

// Handle module input (e.g., vote counts, amendment text)
function handleModule(stepConfig, existingValues = null) {
    const modal = document.getElementById('modal');
    modal.innerHTML = '';
    const form = document.createElement('div');
    form.className = 'module-form';
    const moduleValues = existingValues ? { ...existingValues } : {};

    stepConfig.fields.forEach(field => {
        const container = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = `${field.name}: `;
        if (field.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `module-${field.name}`;
            input.value = moduleValues[field.name] || 0;
            input.min = '0';
            const decrement = document.createElement('button');
            decrement.textContent = '-';
            decrement.onclick = () => {
                if (moduleValues[field.name] > 0) {
                    moduleValues[field.name]--;
                    input.value = moduleValues[field.name];
                }
            };
            const increment = document.createElement('button');
            increment.textContent = '+';
            increment.onclick = () => {
                moduleValues[field.name]++;
                input.value = moduleValues[field.name];
            };
            container.appendChild(label);
            container.appendChild(decrement);
            container.appendChild(input);
            container.appendChild(increment);
        } else if (field.type === 'text') {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `module-${field.name}`;
            input.value = moduleValues[field.name] || field.default || '';
            container.appendChild(label);
            container.appendChild(input);
        }
        form.appendChild(container);
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
        if (window.currentStep === stepConfig.step) {
            selectOption(resultStr); // From flows.js
        } else {
            const moduleIndex = window.path.findIndex(p => p.step === stepConfig.step);
            if (moduleIndex !== -1) {
                window.path[moduleIndex].value = resultStr;
                window.path[moduleIndex].display = getModuleDisplayText(stepConfig.step, moduleResult);
                updateInput();
                showSuggestions('');
            }
        }
        modal.classList.remove('active');
    };
    form.appendChild(submit);
    modal.appendChild(form);
    modal.classList.add('active');
}

// Get display text for module results (e.g., vote outcome)
function getModuleDisplayText(step, moduleResult) {
    if (step === 'voteModule') {
        const forVotes = moduleResult.for || 0;
        const againstVotes = moduleResult.against || 0;
        const neutralVotes = moduleResult.neutral || 0;
        const outcome = forVotes > againstVotes ? 'Passed' : 'Failed';
        return `Motion ${outcome} ${forVotes}-${againstVotes}-${neutralVotes}`;
    } else if (step === 'lcNumber') {
        return `LC# ${moduleResult.lcNumber || '.00000'}`;
    } else if (step === 'amendmentModule') {
        return `Amendment: ${moduleResult.amendmentText || ''}`;
    }
    return JSON.stringify(moduleResult);
}

// Get display text for a tag based on step and value
function getTagText(step, value) {
    if (step === 'member' || step === 'memberOptional' || step === 'billCarrierOptional') {
        const { name, title } = parseMember(value); // From utils.js
        return title ? `${title} ${name}` : name;
    }
    return value;
}

// Create a history table row
function createHistoryRow(time, statementText, path, index, isNew = false) {
    const row = document.createElement('tr');
    const visibleTags = path.filter(p => p.step !== 'carryBillPrompt' && p.value !== 'Take the Vote');
    const tagsHtml = visibleTags.map(p => `<span class="token">${p.display || getTagText(p.step, p.value)}</span>`).join(' ');
    let statementHtml = '';
    if (path[0].step === 'testimony') {
        const testimonyDetails = path[0].details;
        const techStatement = statementText;
        const proceduralStatement = testimonyDetails.isIntroducingBill ?
            constructProceduralStatement(time, { ...testimonyDetails, introducingBill: true, title: testimonyDetails.title }) : // From testimony.js
            (testimonyDetails.isSenatorRepresentative ?
                `${time.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' })} ${testimonyDetails.title} ${testimonyDetails.lastName} testified in ${testimonyDetails.position.toLowerCase()} and submitted testimony #${testimonyDetails.number}` :
                constructProceduralStatement(time, testimonyDetails)); // From testimony.js
        const link = testimonyDetails.link || '';
        const memberNo = testimonyDetails.memberNo || '';
        statementHtml = `
            <div class="statement-box tech-clerk" data-tech-statement="${techStatement.trim()}" data-link="${link}" data-memberno="${memberNo}" title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">${techStatement.trim()}</div>
            <div class="statement-box procedural-clerk" title="Copy Procedural Clerk Statement">${proceduralStatement}</div>
        `;
    } else if (path[0].step === 'introducedBill') {
        const memberString = path.find(p => p.step === 'member')?.value || '';
        const memberNo = path.find(p => p.step === 'member')?.memberNo || '';
        const { lastName, title } = parseMember(memberString); // From utils.js
        const techStatement = `${title} ${lastName} - Introduced Bill`;
        const proceduralStatement = constructProceduralStatement(time, { lastName, title, introducingBill: true }); // From testimony.js
        statementHtml = `
            <div class="statement-box tech-clerk" data-tech-statement="${techStatement.trim()}" data-memberno="${memberNo}" title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">${techStatement.trim()}</div>
            <div class="statement-box procedural-clerk" title="Copy Procedural Clerk Statement">${proceduralStatement}</div>
        `;
    } else if (path[0].step === 'member') {
        const techStatement = statementText;
        const proceduralStatement = constructMemberActionProceduralStatement(time, path); // From testimony.js
        const memberNo = path.find(p => p.step === 'member')?.memberNo || '';
        statementHtml = `
            <div class="statement-box tech-clerk" data-tech-statement="${techStatement.trim()}" data-link="" data-memberno="${memberNo}" title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">${techStatement.trim()}</div>
            <div class="statement-box procedural-clerk" title="Copy Procedural Clerk Statement">${proceduralStatement}</div>
        `;
    } else {
        statementHtml = `<div class="statement-box">${statementText.trim()}</div>`;
    }

    row.innerHTML = `
        <td>${time.toLocaleTimeString()}</td>
        <td><div class="tags">${tagsHtml}</div>${statementHtml}</td>
        <td><span class="edit-icon" data-index="${index}">✏️</span></td>
        <td><span class="delete-icon" data-index="${index}">🗑️</span></td>
    `;
    row.setAttribute('data-index', index);
    if (isNew) row.classList.add('new-entry');

    const statementBoxes = row.querySelectorAll('.statement-box');
    statementBoxes.forEach(box => {
        box.addEventListener('click', (e) => {
            e.stopPropagation();
            let textToCopy;
            if (box.classList.contains('tech-clerk') && e.ctrlKey) {
                const techStatement = box.getAttribute('data-tech-statement');
                const link = box.getAttribute('data-link') || '';
                const memberNo = box.getAttribute('data-memberno') || '';
                const formattedTime = time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                let memberNoFormatted = memberNo ? `member-no:${memberNo};Mic:` : '';
                let specialFormat = `${formattedTime} | ${techStatement} | ${memberNoFormatted} |${link ? ` ${link}` : ''}`;
                textToCopy = specialFormat;
                box.classList.add('special-copied');
                setTimeout(() => box.classList.remove('special-copied'), 500);
            } else {
                textToCopy = box.textContent.trim();
                box.classList.add('copied');
                setTimeout(() => box.classList.remove('copied'), 500);
            }
            navigator.clipboard.writeText(textToCopy);
        });
    });

    row.querySelector('.edit-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        editHistoryEntry(window.history[index]); // From main.js scope
    });

    row.querySelector('.delete-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        window.history.splice(index, 1);
        localStorage.setItem('historyStatements', serializeHistory(window.history)); // From utils.js
        updateHistoryTable();
    });

    return row;
}

// Update the history table with grouped entries by bill
function updateHistoryTable(newEntry = null) {
    const historyTableBody = document.querySelector('#historyTable tbody');
    const history = window.appState.history; // Use the shared history array
    history.sort((a, b) => b.time - a.time);
    historyTableBody.innerHTML = '';

    const groupedHistory = history.reduce((acc, entry) => {
        const bill = entry.bill || 'Uncategorized';
        acc[bill] = acc[bill] || [];
        acc[bill].push(entry);
        return acc;
    }, {});

    const billGroupsWithTimes = Object.keys(groupedHistory).map(bill => ({
        bill,
        earliestTime: Math.min(...groupedHistory[bill].map(entry => entry.time.getTime()))
    }));
    billGroupsWithTimes.sort((a, b) => b.earliestTime - a.earliestTime);

    billGroupsWithTimes.forEach(({ bill }) => {
        const headerRow = document.createElement('tr');
        headerRow.className = 'bill-header';
        headerRow.innerHTML = `<td colspan="4">${bill} [click to collapse/expand]</td>`;
        headerRow.addEventListener('click', () => {
            let nextRow = headerRow.nextElementSibling;
            while (nextRow && !nextRow.classList.contains('bill-header')) {
                nextRow.style.display = nextRow.style.display === 'none' ? '' : 'none';
                nextRow = nextRow.nextElementSibling;
            }
        });
        headerRow.addEventListener('dblclick', () => {
            editBillName(headerRow, bill);
        });
        historyTableBody.appendChild(headerRow);

        groupedHistory[bill].forEach(entry => {
            const isNew = (entry === newEntry);
            const row = createHistoryRow(entry.time, entry.text, entry.path, history.indexOf(entry), isNew);
            historyTableBody.appendChild(row);
        });
    });

    if (newEntry) {
        const newRow = historyTableBody.querySelector('tr.new-entry');
        if (newRow) {
            const techBox = newRow.querySelector('.statement-box.tech-clerk');
            if (techBox) {
                const time = newEntry.time;
                const formattedTime = time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                const techStatement = techBox.getAttribute('data-tech-statement');
                const link = techBox.getAttribute('data-link') || '';
                const memberNo = techBox.getAttribute('data-memberno') || '';
                let memberNoFormatted = memberNo ? `member-no:${memberNo};Mic:` : '';
                let specialFormat = `${formattedTime} | ${techStatement} | ${memberNoFormatted} |${link ? ` ${link}` : ''}`;
                navigator.clipboard.writeText(specialFormat).then(() => {
                    techBox.classList.add('special-copied');
                    setTimeout(() => {
                        techBox.classList.remove('special-copied');
                        newRow.classList.remove('new-entry');
                    }, 500);
                });
            } else {
                newRow.classList.remove('new-entry');
            }
        }
    }
}

// Edit the bill name for a group of history entries
function editBillName(headerRow, oldBillName) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldBillName;
    input.style.width = '100%';
    const td = headerRow.querySelector('td');
    td.innerHTML = '';
    td.appendChild(input);
    input.focus();

    const saveNewBillName = () => {
        const newBillName = input.value.trim() || 'Uncategorized';
        window.history.forEach(entry => {
            if (entry.bill === oldBillName) entry.bill = newBillName;
        });
        localStorage.setItem('historyStatements', serializeHistory(window.history)); // From utils.js
        updateHistoryTable();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveNewBillName();
    });
    input.addEventListener('blur', saveNewBillName);
}

// Update the committee members legend
function updateLegend() {
    const memberList = document.getElementById('memberList');
    memberList.innerHTML = '';
    const members = getCommitteeMembers(); // From flows.js
    const parsedMembers = members.map(member => ({ original: member, parsed: parseMember(member) })); // From utils.js
    const chairperson = parsedMembers.find(m => m.parsed.title === "Chairwoman" || m.parsed.title === "Chairman");
    const viceChairperson = parsedMembers.find(m => m.parsed.title === "Vice Chairwoman" || m.parsed.title === "Vice Chairman");
    const otherMembers = parsedMembers.filter(m => m !== chairperson && m !== viceChairperson);

    const createLi = (member) => {
        const li = document.createElement('li');
        const displayName = member.parsed.title ? `${member.parsed.title} ${member.parsed.name}` : member.parsed.name;
        li.textContent = displayName;
        li.onclick = () => {
            if (window.path.length === 0) selectOption(member.original); // From flows.js
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
    otherMembers.forEach(member => memberList.appendChild(createLi(member)));
}

// Update the meeting actions legend
function updateMeetingActionsLegend() {
    const meetingActionsList = document.getElementById('meetingActionsList');
    meetingActionsList.innerHTML = '';
    const jsonStructure = window.jsonStructure;
    const meetingActions = jsonStructure.startingPoints.find(sp => sp.type === "meetingAction").options;
    meetingActions.forEach(action => {
        const li = document.createElement('li');
        li.textContent = action;
        li.onclick = () => {
            if (window.path.length === 0) selectOption(action); // From flows.js
        };
        meetingActionsList.appendChild(li);
    });
}

// Update the vote actions legend
function updateVoteActionsLegend() {
    const voteActionsList = document.getElementById('voteActionsList');
    voteActionsList.innerHTML = '';
    const jsonStructure = window.jsonStructure;
    const voteActionSP = jsonStructure.startingPoints.find(sp => sp.type === "voteAction");
    if (voteActionSP) {
        voteActionSP.options.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action;
            li.onclick = () => {
                if (window.path.length === 0) selectOption(action); // From flows.js
            };
            voteActionsList.appendChild(li);
        });
    }
}

// Update the external actions legend
function updateExternalActionsLegend() {
    const externalActionsList = document.getElementById('externalActionsList');
    externalActionsList.innerHTML = '';
    const externalActions = [
        { name: "Introduced Bill", handler: () => selectOption("Introduced Bill") }, // From flows.js
        { name: "Add Testimony", handler: () => openTestimonyModal() } // From testimony.js
    ];
    externalActions.forEach(action => {
        const li = document.createElement('li');
        li.textContent = action.name;
        li.onclick = () => {
            if (window.path.length === 0) action.handler();
        };
        externalActionsList.appendChild(li);
    });
}