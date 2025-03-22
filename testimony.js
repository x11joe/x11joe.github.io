// testimony.js - Manages testimony-related functionality, including modal and prompts

// Handle testimony prompts (e.g., Senator/Representative check, bill introduction)
function handleTestimonyPrompts(index) {
    return new Promise((resolve) => {
        const history = window.history; // From main.js scope
        const entry = history[index];
        if (entry.path[0].step !== 'testimony') {
            resolve();
            return;
        }

        const testimonyDetails = entry.path[0].details;
        const roleLower = testimonyDetails.role ? testimonyDetails.role.toLowerCase() : '';
        const organizationLower = testimonyDetails.organization ? testimonyDetails.organization.toLowerCase() : '';
        const keywordsRegex = /representative|representatives|senator|senators|house|senate/i;

        if ((keywordsRegex.test(roleLower) || keywordsRegex.test(organizationLower)) && !testimonyDetails.promptedForSenatorRepresentative) {
            showCustomConfirm("Is this a senator or representative?").then((isSenRep) => {
                testimonyDetails.promptedForSenatorRepresentative = true;

                if (isSenRep) {
                    testimonyDetails.isSenatorRepresentative = true;
                    let title = /representative/.test(roleLower) ? "Representative" :
                                /senator/.test(roleLower) ? "Senator" :
                                determineTitle(testimonyDetails.organization); // From utils.js

                    if (title) {
                        testimonyDetails.title = title;
                        const memberNo = findMemberNo(testimonyDetails.lastName, title, testimonyDetails.firstName?.charAt(0)); // From utils.js
                        if (memberNo) testimonyDetails.memberNo = memberNo;

                        showCustomConfirm("Are they introducing a bill?").then((isIntroducing) => {
                            testimonyDetails.isIntroducingBill = isIntroducing;
                            const lastName = testimonyDetails.lastName;
                            entry.text = isIntroducing ?
                                `${title} ${lastName} - Introduced Bill - Testimony#${testimonyDetails.number}` :
                                `${title} ${lastName} - ${testimonyDetails.position} - Testimony#${testimonyDetails.number}`;
                            entry.path[0].value = entry.text;
                            entry.path[0].details = { ...testimonyDetails };
                            localStorage.setItem('historyStatements', serializeHistory(history)); // From utils.js
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                } else {
                    testimonyDetails.isSenatorRepresentative = false;
                    entry.path[0].details = { ...testimonyDetails };
                    localStorage.setItem('historyStatements', serializeHistory(history)); // From utils.js
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
}

// Reset the testimony modal fields
function resetTestimonyModal() {
    document.getElementById('testimonyFirstName').value = '';
    document.getElementById('testimonyLastName').value = '';
    document.getElementById('testimonyRole').value = '';
    document.getElementById('testimonyOrganization').value = '';
    document.getElementById('testimonyPosition').value = '';
    document.getElementById('testimonyNumber').value = '';
    document.getElementById('testimonyLink').value = '';
    const formatSelect = document.getElementById('testimonyFormat');
    if (formatSelect) formatSelect.value = 'Written';
}

// Populate the testimony modal with existing data
function populateTestimonyModal(part) {
    setTimeout(() => {
        let testimonyDetails = part.details || parseTestimonyString(part.value);
        const inputs = {
            firstName: document.getElementById('testimonyFirstName'),
            lastName: document.getElementById('testimonyLastName'),
            role: document.getElementById('testimonyRole'),
            organization: document.getElementById('testimonyOrganization'),
            position: document.getElementById('testimonyPosition'),
            number: document.getElementById('testimonyNumber'),
            link: document.getElementById('testimonyLink'),
            format: document.getElementById('testimonyFormat')
        };
        if (inputs.firstName) inputs.firstName.value = testimonyDetails.firstName || '';
        if (inputs.lastName) inputs.lastName.value = testimonyDetails.lastName || '';
        if (inputs.role) inputs.role.value = testimonyDetails.role || '';
        if (inputs.organization) inputs.organization.value = testimonyDetails.organization || '';
        if (inputs.position) inputs.position.value = testimonyDetails.position || '';
        if (inputs.number) inputs.number.value = testimonyDetails.number || '';
        if (inputs.link) inputs.link.value = testimonyDetails.link || '';
        if (inputs.format) inputs.format.value = testimonyDetails.format || 'Online';
    }, 0);
}

// Open the testimony modal
function openTestimonyModal(testimonyDetails = null, isEditing = false) {
    const submitTestimonyButton = document.getElementById('submitTestimonyButton');
    submitTestimonyButton.textContent = isEditing ? 'Save Testimony' : 'Add Testimony';
    if (testimonyDetails) {
        const nameParts = testimonyDetails.name ? testimonyDetails.name.split(', ').map(s => s.trim()) : [];
        setTimeout(() => {
            const inputs = {
                firstName: document.getElementById('testimonyFirstName'),
                lastName: document.getElementById('testimonyLastName'),
                role: document.getElementById('testimonyRole'),
                organization: document.getElementById('testimonyOrganization'),
                position: document.getElementById('testimonyPosition'),
                number: document.getElementById('testimonyNumber'),
                link: document.getElementById('testimonyLink'),
                format: document.getElementById('testimonyFormat')
            };
            if (inputs.firstName) inputs.firstName.value = nameParts.slice(1).join(', ') || '';
            if (inputs.lastName) inputs.lastName.value = nameParts[0] || '';
            if (inputs.role) inputs.role.value = testimonyDetails.role || '';
            if (inputs.organization) inputs.organization.value = testimonyDetails.org || '';
            if (inputs.position) inputs.position.value = testimonyDetails.position || '';
            if (inputs.number) inputs.number.value = testimonyDetails.testimonyNo || '';
            if (inputs.link) inputs.link.value = testimonyDetails.link || '';
            if (inputs.format) inputs.format.value = mapFormat(testimonyDetails.format);
        }, 0);
    } else if (!isEditing) {
        resetTestimonyModal();
    }
    document.getElementById('testimonyModal').classList.add('active');
}

// Close the testimony modal and reset state
function closeTestimonyModal() {
    const testimonyModal = document.getElementById('testimonyModal');
    if (window.editingTestimonyIndex !== null) {
        window.path = [];
        window.currentFlow = null;
        window.currentStep = null;
        window.statementStartTime = null;
        window.editingIndex = null;
        const inputDiv = document.getElementById('input');
        inputDiv.innerHTML = '';
        inputDiv.appendChild(document.createTextNode(' '));
        inputDiv.focus();
        showSuggestions(''); // From ui.js
    }
    testimonyModal.classList.remove('active');
    window.editingTestimonyIndex = null;
    document.getElementById('submitTestimonyButton').textContent = 'Add Testimony';
}

// Submit testimony from the modal
function submitTestimonyModal() {
    const testimonyDetails = {
        firstName: document.getElementById('testimonyFirstName').value.trim(),
        lastName: document.getElementById('testimonyLastName').value.trim(),
        role: document.getElementById('testimonyRole').value.trim(),
        organization: document.getElementById('testimonyOrganization').value.trim(),
        position: document.getElementById('testimonyPosition').value,
        number: document.getElementById('testimonyNumber').value.trim(),
        link: document.getElementById('testimonyLink').value.trim(),
        format: document.getElementById('testimonyFormat').value
    };

    if (!testimonyDetails.position) {
        alert('Position is required.');
        return;
    }

    const parts = [];
    if (testimonyDetails.firstName || testimonyDetails.lastName) parts.push(`${testimonyDetails.firstName} ${testimonyDetails.lastName}`.trim());
    if (testimonyDetails.role) parts.push(testimonyDetails.role);
    if (testimonyDetails.organization) parts.push(testimonyDetails.organization);
    parts.push(testimonyDetails.position);
    if (testimonyDetails.number) parts.push(`Testimony#${testimonyDetails.number}`);
    const testimonyString = parts.join(' - ');

    if (window.editingTestimonyIndex !== null) {
        const existingDetails = window.path[window.editingTestimonyIndex].details || {};
        window.path[window.editingTestimonyIndex].value = testimonyString;
        window.path[window.editingTestimonyIndex].details = {
            ...existingDetails,
            ...testimonyDetails,
            promptedForSenatorRepresentative: false,
            isSenatorRepresentative: false,
            isIntroducingBill: false,
            title: null
        };
        if (window.editingIndex !== null) {
            // finalizeStatement() should be called from main.js context
            window.finalizeStatement();
        } else {
            updateInput(); // From ui.js
            showSuggestions(''); // From ui.js
        }
        closeTestimonyModal();
    } else {
        const testimonyObject = {
            ...testimonyDetails,
            promptedForSenatorRepresentative: false,
            isSenatorRepresentative: false,
            isIntroducingBill: false,
            title: null
        };
        const startTime = window.markedTime || new Date();
        if (window.markedTime) {
            window.markedTime = null;
            document.querySelector('.page-wrapper').classList.remove('marking-time');
        }
        const pathEntry = { step: 'testimony', value: testimonyString, details: testimonyObject };
        const newEntry = { time: startTime, path: [pathEntry], text: testimonyString, link: testimonyDetails.link, bill: window.currentBill };
        window.history.push(newEntry);
        handleTestimonyPrompts(window.history.length - 1).then(() => {
            updateHistoryTable(newEntry); // From ui.js
            setTimeout(() => document.getElementById('historyWrapper').scrollTop = 0, 0);
            localStorage.setItem('historyStatements', serializeHistory(window.history)); // From utils.js
            closeTestimonyModal();
        });
    }
}

// Parse a testimony string into an object
function parseTestimonyString(str) {
    const parts = str.split(' - ').map(p => p.trim());
    let testimonyDetails = {};
    const positionIndex = parts.findIndex(p => p === 'In Favor' || p === 'In Opposition' || p === 'Neutral');
    if (positionIndex >= 0) {
        testimonyDetails.position = parts[positionIndex];
        if (positionIndex + 1 < parts.length && parts[positionIndex + 1].startsWith('Testimony#')) {
            testimonyDetails.number = parts[positionIndex + 1].replace('Testimony#', '');
            if (positionIndex + 2 < parts.length) testimonyDetails.format = parts[positionIndex + 2];
        } else if (positionIndex + 1 < parts.length) {
            testimonyDetails.format = parts[positionIndex + 1];
        }
        const beforeParts = parts.slice(0, positionIndex);
        if (beforeParts.length >= 1) {
            const nameParts = beforeParts[0].split(' ');
            testimonyDetails.firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : beforeParts[0];
            testimonyDetails.lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        }
        if (beforeParts.length >= 2) testimonyDetails.role = beforeParts[1];
        if (beforeParts.length >= 3) testimonyDetails.organization = beforeParts[2];
    }
    return testimonyDetails;
}

// Construct a procedural statement for testimony or bill introduction
function constructProceduralStatement(time, testimonyDetails) {
    const { firstName, lastName, role, organization, position, number, format, introducingBill, title } = testimonyDetails;
    const fullName = `${firstName} ${lastName}`.trim();
    const hours = time.getHours();
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'p.m.' : 'a.m.';
    const formattedHours = hours % 12 || 12;
    const formattedTime = `${formattedHours}:${minutes} ${period}`;

    if (introducingBill && title) {
        let statement = `${formattedTime} ${title} ${lastName} introduced the bill`;
        if (number) {
            const positionPhrase = position === 'Neutral' ? 'as neutral' : position.toLowerCase();
            statement += ` and submitted testimony ${positionPhrase} #${number}`;
        }
        return statement;
    } else {
        let nameSection = fullName;
        let descriptors = [];
        if (role) descriptors.push(role);
        if (organization) descriptors.push(organization);
        if (descriptors.length > 0) nameSection += ', ' + descriptors.join(', ');

        const action = format === 'Written' && number ? `submitted testimony #${number}` : 'testified';
        const positionPhrase = position === 'Neutral' ? 'as neutral' : position.toLowerCase();
        let statement = `${formattedTime} ${nameSection}${descriptors.length > 0 ? ', ' : ' '}${action} ${positionPhrase}`;
        if (format !== 'Written' && number) statement += ` and submitted testimony #${number}`;
        return statement;
    }
}

// Construct a procedural statement for member actions
function constructMemberActionProceduralStatement(time, path) {
    const memberString = path.find(p => p.step === 'member')?.value || '';
    const { lastName, title } = parseMember(memberString); // From utils.js
    const action = path.find(p => p.step === 'action')?.value || '';
    const detail = path.find(p => p.step === 'movedDetail')?.value || '';
    const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
    const amendmentText = path.find(p => p.step === 'amendmentModule')?.value || '';

    const hours = time.getHours();
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'p.m.' : 'a.m.';
    const formattedHours = hours % 12 || 12;
    const formattedTime = `${formattedHours}:${minutes} ${period}`;

    let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(document.getElementById('committeeSelect').value) ? 'Senator' : 'Representative'} ${lastName}`;
    let statement = `${formattedTime} ${memberText}`;

    if (action === 'Moved') {
        if (detail === 'Amendment') {
            const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
            if (amendmentType === 'Verbal') {
                statement += ` moved verbal amendment`;
            } else if (amendmentType === 'LC#') {
                const lcNumber = path.find(p => p.step === 'lcNumber') ? JSON.parse(path.find(p => p.step === 'lcNumber').value).lcNumber : '.00000';
                statement += ` moved Amendment LC# ${lcNumber}`;
            }
        } else {
            const motionTypesRequiringArticle = suggestMotionType(); // From flows.js
            statement += motionTypesRequiringArticle.includes(detail) ? ` moved a ${detail}` : ` moved ${detail}`;
        }
        if (rerefer) statement += ` and rereferred to ${getShortCommitteeName(rerefer)}`; // From flows.js
    } else if (action === 'Seconded') {
        statement += ` seconded the motion`;
    } else if (action === 'Withdrew') {
        statement += ` withdrew the motion`;
    } else if (action === 'Proposed Amendment') {
        statement += ` proposed an amendment: ${amendmentText}`;
    } else if (action === 'Introduced Bill') {
        statement += ` introduced the bill`;
    } else {
        statement += ` performed action: ${action}`;
    }
    return statement;
}

// Show a custom confirmation dialog
function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10002;';
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
        dialog.innerHTML = `<p>${message}</p>`;
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; justify-content: space-between; margin-top: 10px;';

        const yesButton = document.createElement('button');
        yesButton.textContent = 'Yes';
        yesButton.style.cssText = 'padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
        yesButton.onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };

        const noButton = document.createElement('button');
        noButton.textContent = 'No';
        noButton.style.cssText = 'padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;';
        noButton.onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };

        buttonContainer.appendChild(yesButton);
        buttonContainer.appendChild(noButton);
        dialog.appendChild(buttonContainer);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
    });
}

// Map testimony format from external data to modal options
function mapFormat(format) {
    if (format?.includes('In-Person')) return 'In-Person';
    if (format?.includes('Online')) return 'Online';
    return 'Written';
}