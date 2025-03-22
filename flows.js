// flows.js - Manages flow logic based on flows.json, including option selection and step navigation

// Suggest motion types for voting actions
function suggestMotionType() {
    return ["Do Pass", "Do Not Pass", "Without Committee Recommendation"];
}

// Suggest reason for a failed motion
function suggestFailedReason() {
    return ["for lack of a second"];
}

// Get members of the current committee (from main.js scope)
function getCommitteeMembers() {
    const committees = window.DEFAULT_COMMITTEES || {};
    return committees[document.getElementById('committeeSelect').value] || [];
}

// Get other committees in the same chamber (House or Senate)
function getOtherCommittees() {
    const currentCommittee = document.getElementById('committeeSelect').value;
    const isHouse = currentCommittee.toLowerCase().includes("house");
    const committees = window.DEFAULT_COMMITTEES || {};
    return Object.keys(committees).filter(c =>
        (isHouse ? c.toLowerCase().includes("house") : c.toLowerCase().includes("senate")) && c !== currentCommittee
    );
}

// Get available options for a given step in the current flow
function getOptionsForStep(stepType, flow) {
    const stepConfig = flow.steps.find(step => step.step === stepType);
    if (!stepConfig) return [];
    let options = [];
    switch (stepConfig.options) {
        case "committeeMembers":
            options = getCommitteeMembers();
            break;
        case "otherCommittees":
            options = getOtherCommittees();
            break;
        case "allMembers":
            options = allMembers.map(member => member.fullName); // allMembers from main.js
            break;
        case "suggestMotionType":
            options = suggestMotionType();
            break;
        case "suggestFailedReason":
            options = suggestFailedReason();
            break;
        default:
            if (Array.isArray(stepConfig.options)) {
                options = stepConfig.options;
                // Customize options based on context (e.g., amendments, rereferrals)
                if (stepType === 'motionModifiers') {
                    const amendmentPassed = window.amendmentPassed; // Assume global from main.js
                    const lastRereferCommittee = window.lastRereferCommittee; // Assume global
                    if (amendmentPassed && lastRereferCommittee) {
                        options = ['as Amended', 'and Rereferred', 'Take the Vote'].filter(opt => stepConfig.options.includes(opt));
                    } else if (amendmentPassed) {
                        options = ['as Amended', 'Take the Vote', 'and Rereferred'].filter(opt => stepConfig.options.includes(opt));
                    } else if (lastRereferCommittee) {
                        options = ['and Rereferred', 'Take the Vote', 'as Amended'].filter(opt => stepConfig.options.includes(opt));
                    } else {
                        options = ['Take the Vote', 'as Amended', 'and Rereferred'];
                    }
                } else if (stepType === 'afterAmended') {
                    options = lastRereferCommittee ? ['and Rereferred', 'Take the Vote'] : ['Take the Vote', 'and Rereferred'];
                } else if (stepType === 'rollCallBaseMotionType' && window.lastMovedDetail) {
                    options = [window.lastMovedDetail, ...options.filter(opt => opt !== window.lastMovedDetail)];
                }
            }
    }
    return options;
}

// Get current options based on flow and step (used by UI suggestions)
function getCurrentOptions() {
    const jsonStructure = window.jsonStructure; // Assume loaded in main.js
    const currentFlow = window.currentFlow; // From main.js scope
    const currentStep = window.currentStep; // From main.js scope
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
        if (currentFlow === jsonStructure.flows.committeeMemberFlow && currentStep === 'action' && window.lastAction) {
            if (window.lastAction === 'Moved') {
                options = ['Seconded', ...options.filter(opt => opt !== 'Seconded')];
            } else if (window.lastAction === 'Seconded' || window.lastAction === 'Withdrew') {
                options = ['Moved', ...options.filter(opt => opt !== 'Moved')];
            }
        }
        return options;
    }
}

// Get the current text entered in the input div (after tags)
function getCurrentText() {
    const inputDiv = document.getElementById('input');
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

// Construct a statement text from the path (used when finalizing)
function constructStatementText(path) {
    if (path.length === 0) return '';
    const jsonStructure = window.jsonStructure;
    const flowType = path[0].step;
    if (flowType === 'voteType') {
        const voteType = path.find(p => p.step === 'voteType').value;
        if (voteType === 'Roll Call Vote') {
            const baseMotionType = path.find(p => p.step === 'rollCallBaseMotionType')?.value || '';
            const modifiers = path.filter(p => p.step === 'motionModifiers' || p.step === 'afterAmended')
                .map(p => p.value)
                .filter(val => val !== 'Take the Vote');
            const rereferCommittee = path.find(p => p.step === 'rereferCommittee')?.value;
            const voteResultPart = path.find(p => p.step === 'voteModule');
            const billCarrier = path.find(p => p.step === 'billCarrierOptional')?.value;
            let text = '';
            if (voteResultPart) {
                const result = JSON.parse(voteResultPart.value);
                const outcome = result.for > result.against ? 'Passed' : 'Failed';
                let motionText = baseMotionType;
                if (modifiers.includes('as Amended')) motionText += ' as Amended';
                if (modifiers.includes('and Rereferred')) {
                    motionText += rereferCommittee ? ` and Rereferred to ${getShortCommitteeName(rereferCommittee)}` : ' and Rereferred';
                }
                text = `Roll Call Vote on ${motionText} - Motion ${outcome} ${result.for}-${result.against}-${result.neutral}`;
                if (billCarrier && path.find(p => p.step === 'carryBillPrompt')?.value === 'X Carried the Bill') {
                    const { lastName, title } = parseMember(billCarrier); // From utils.js
                    const memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(document.getElementById('committeeSelect').value) ? 'Senator' : 'Representative'} ${lastName}`;
                    text += ` - ${memberText} Carried the Bill`;
                }
            } else {
                text = `Roll Call Vote on ${baseMotionType}`;
                if (modifiers.includes('as Amended')) text += ' as Amended';
                if (modifiers.includes('and Rereferred')) {
                    text += rereferCommittee ? ` and Rereferred to ${getShortCommitteeName(rereferCommittee)}` : ' and Rereferred';
                }
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
    } else if (flowType === 'member') {
        const memberString = path.find(p => p.step === 'member')?.value || '';
        const { lastName, title } = parseMember(memberString); // From utils.js
        const action = path.find(p => p.step === 'action')?.value || '';
        const detail = path.find(p => p.step === 'movedDetail')?.value || '';
        const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
        let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(document.getElementById('committeeSelect').value) ? 'Senator' : 'Representative'} ${lastName}`;
        let text = `${memberText} ${action.toLowerCase()}`;
        if (detail) {
            if (detail === 'Amendment') {
                const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
                if (amendmentType === 'Verbal') {
                    text += ' verbal amendment';
                } else if (amendmentType === 'LC#') {
                    const lcNumberStep = path.find(p => p.step === 'lcNumber');
                    const lcNumber = lcNumberStep ? JSON.parse(lcNumberStep.value).lcNumber : '.00000';
                    text += ` amendment LC# ${lcNumber}`;
                }
            } else {
                text += ` ${detail}`;
            }
        }
        if (rerefer) text += ` and rereferred to ${getShortCommitteeName(rerefer)}`;
        return text;
    } else if (flowType === 'meetingAction') {
        const action = path.find(p => p.step === 'meetingAction')?.value || '';
        const memberString = path.find(p => p.step === 'memberOptional')?.value || '';
        let text = action;
        if (memberString) {
            const { lastName, title } = parseMember(memberString); // From utils.js
            let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(document.getElementById('committeeSelect').value) ? 'Senator' : 'Representative'} ${lastName}`;
            text += ` by ${memberText}`;
        }
        return text;
    } else if (flowType === 'introducedBill') {
        const memberString = path.find(p => p.step === 'member')?.value || '';
        const { lastName, title } = parseMember(memberString); // From utils.js
        let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(document.getElementById('committeeSelect').value) ? 'Senator' : 'Representative'} ${lastName}`;
        return `${memberText} - Introduced Bill`;
    }
    return path.map(p => p.value).join(' - ');
}

// Select an option and update the path and flow state
function selectOption(option) {
    const jsonStructure = window.jsonStructure;
    let path = window.path; // Assume global from main.js
    let currentFlow = window.currentFlow;
    let currentStep = window.currentStep;
    let statementStartTime = window.statementStartTime;

    if (!currentFlow) {
        const startingPoint = jsonStructure.startingPoints.find(sp => {
            if (sp.options === "committeeMembers") return getCommitteeMembers().includes(option);
            if (Array.isArray(sp.options)) return sp.options.includes(option);
            return false;
        });
        if (startingPoint) {
            currentFlow = jsonStructure.flows[startingPoint.flow];
            if (startingPoint.type === 'voteAction') {
                path.push({ step: 'voteType', value: option });
                currentStep = jsonStructure.flows.voteActionFlow.steps.find(step => step.step === 'voteType').next[option];
            } else if (startingPoint.type === 'introducedBill') {
                path.push({ step: 'introducedBill', value: option });
                currentStep = 'member';
            } else {
                const firstStep = currentFlow.steps[0];
                let stepOptions = firstStep.options === "committeeMembers" ? getCommitteeMembers() : (firstStep.options === "allMembers" ? allMembers.map(m => m.fullName) : firstStep.options);
                if (stepOptions.includes(option)) {
                    const member = allMembers.find(m => m.fullName === option);
                    path.push({ step: firstStep.step, value: option, memberNo: member ? member.memberNo : null });
                    currentStep = typeof firstStep.next === 'string' ? firstStep.next : firstStep.next?.default;
                } else {
                    path.push({ step: startingPoint.type, value: option });
                    currentStep = firstStep.step;
                }
            }
        }
    } else {
        const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
        if (stepConfig.type === 'module') {
            const moduleResult = JSON.parse(option);
            const displayText = getModuleDisplayText(currentStep, moduleResult); // From ui.js
            path.push({ step: currentStep, value: option, display: displayText });
            if (currentStep === 'voteModule') {
                const motionType = path.find(p => p.step === 'rollCallBaseMotionType')?.value;
                currentStep = motionType === 'Reconsider' ? null : 'carryBillPrompt';
            } else {
                currentStep = stepConfig.next;
            }
        } else if (currentStep === 'carryBillPrompt') {
            path.push({ step: currentStep, value: option });
            currentStep = option === 'X Carried the Bill' ? 'billCarrierOptional' : null;
        } else if (currentStep === 'rereferCommittee') {
            path.push({ step: currentStep, value: option });
            currentStep = 'voteModule';
        } else {
            const member = (stepConfig.options === "committeeMembers" || stepConfig.options === "allMembers") ? allMembers.find(m => m.fullName === option) : null;
            path.push({ step: currentStep, value: option, memberNo: member ? member.memberNo : null });
            currentStep = stepConfig.next ? (typeof stepConfig.next === 'string' ? stepConfig.next : stepConfig.next[option] || stepConfig.next.default) : null;
        }
    }

    if (path.length === 1) statementStartTime = new Date();
    window.path = path;
    window.currentFlow = currentFlow;
    window.currentStep = currentStep;
    window.statementStartTime = statementStartTime;
    updateInput(); // From ui.js
    setTimeout(() => showSuggestions(''), 0); // From ui.js
}

// Attempt to convert the last word in input to a tag
function tryToTag() {
    const inputDiv = document.getElementById('input');
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
                const tag = createTag(match, window.currentStep || 'startingPoint', window.path.length); // From ui.js
                lastTextNode.textContent = text.slice(0, -lastWord.length).trim() + ' ';
                inputDiv.insertBefore(tag, lastTextNode);
                selectOption(match);
            }
        }
    }
}

// Show options to edit an existing tag
function showTagOptions(tagElement, stepType, pathIndex) {
    const jsonStructure = window.jsonStructure;
    const currentFlow = window.currentFlow;
    const path = window.path;
    const stepConfig = currentFlow?.steps.find(step => step.step === stepType);
    if (stepConfig && stepConfig.type === 'module') {
        const moduleResult = JSON.parse(path[pathIndex].value);
        handleModule(stepConfig, moduleResult); // From ui.js
    } else if (stepType === 'testimony') {
        populateTestimonyModal(path[pathIndex]); // From testimony.js
        openTestimonyModal(null, true); // From testimony.js
        window.editingTestimonyIndex = pathIndex;
    } else {
        const flow = currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === stepType)?.flow];
        const options = getOptionsForStep(stepType, flow);
        const modal = document.getElementById('modal');
        modal.classList.remove('active');

        const existingDropdown = document.querySelector('.dropdown');
        if (existingDropdown) existingDropdown.remove();

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
                smartInvalidateSubsequentTags(pathIndex, oldValue, opt);
                updateInput(); // From ui.js
                dropdown.remove();
                window.dropdownActive = false;
                setTimeout(() => showSuggestions(getCurrentText()), 0); // From ui.js
            };
            dropdown.appendChild(div);
        });

        document.body.appendChild(dropdown);
        const tagRect = tagElement.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.left = `${tagRect.left}px`;
        dropdown.style.top = `${tagRect.bottom}px`;
        dropdown.style.zIndex = '10001';
        window.dropdownActive = true;
        window.selectedDropdownIndex = -1;

        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target) && e.target !== tagElement.querySelector('.chevron')) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
                window.dropdownActive = false;
                setTimeout(() => showSuggestions(getCurrentText()), 0); // From ui.js
            }
        };
        document.addEventListener('click', closeDropdown);
    }
}

// Invalidate subsequent tags in path if a tag change alters the flow
function smartInvalidateSubsequentTags(changedIndex, oldValue, newValue) {
    const jsonStructure = window.jsonStructure;
    const path = window.path;
    const currentFlow = window.currentFlow;
    const part = path[changedIndex];
    const flow = currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === part.step)?.flow];
    const stepConfig = flow.steps.find(step => step.step === part.step);

    if (stepConfig && stepConfig.next && typeof stepConfig.next === 'object') {
        const oldNextStep = stepConfig.next[oldValue] || stepConfig.next.default;
        const newNextStep = stepConfig.next[newValue] || stepConfig.next.default;

        if (oldNextStep !== newNextStep) {
            const subsequentPath = path.slice(changedIndex + 1);
            path.splice(changedIndex + 1);
            window.currentStep = newNextStep;

            if (flow === jsonStructure.flows.voteActionFlow && (part.step === 'motionModifiers' || part.step === 'afterAmended')) {
                let nextStepConfig = flow.steps.find(step => step.step === newNextStep);
                let expectedNext = newNextStep;
                while (nextStepConfig && expectedNext !== 'voteModule') {
                    if (nextStepConfig.next && typeof nextStepConfig.next === 'object') {
                        if (expectedNext === 'rereferCommittee' && !subsequentPath.some(p => p.step === 'rereferCommittee')) {
                            path.push({ step: 'rereferCommittee', value: 'Senate Appropriations Committee' });
                        }
                        expectedNext = Object.values(nextStepConfig.next)[0] || nextStepConfig.next.default;
                    } else {
                        expectedNext = nextStepConfig.next;
                    }
                    nextStepConfig = flow.steps.find(step => step.step === expectedNext);
                }
                const voteModuleIndex = subsequentPath.findIndex(p => p.step === 'voteModule');
                if (voteModuleIndex !== -1 && expectedNext === 'voteModule') {
                    path.push(...subsequentPath.slice(voteModuleIndex));
                    window.currentStep = path.length > changedIndex + 2 ? flow.steps.find(step => step.step === path[changedIndex + 1].step).next : null;
                }
            }
        }
    }
    window.path = path;
}

// Remove the last tag from the path and update flow state
function removeLastTag() {
    const jsonStructure = window.jsonStructure;
    let path = window.path;
    if (path.length > 0) {
        path.pop();
        if (path.length > 0) {
            const firstValue = path[0].value;
            const startingPoint = jsonStructure.startingPoints.find(sp => {
                if (sp.options === "committeeMembers") return getCommitteeMembers().includes(firstValue);
                if (Array.isArray(sp.options)) return sp.options.includes(firstValue);
                return false;
            });
            if (startingPoint) {
                window.currentFlow = jsonStructure.flows[startingPoint.flow];
                const lastPart = path[path.length - 1];
                const stepConfig = window.currentFlow.steps.find(step => step.step === lastPart.step);
                window.currentStep = stepConfig && stepConfig.next ? (typeof stepConfig.next === 'string' ? stepConfig.next : stepConfig.next[lastPart.value] || stepConfig.next.default) : null;
            } else {
                window.currentFlow = null;
                window.currentStep = null;
            }
        } else {
            window.currentFlow = null;
            window.currentStep = null;
        }
        window.path = path;
        updateInput(); // From ui.js
        showSuggestions(getCurrentText()); // From ui.js
    }
}

// Get a shortened committee name (e.g., "Appropriations" from "Senate Appropriations Committee")
function getShortCommitteeName(fullName) {
    const match = fullName.match(/(\w+)\s+Committee$/);
    return match ? match[1] : fullName;
}

// Check if a committee is a Senate committee
function isSenateCommittee(committeeName) {
    return committeeName.toLowerCase().includes("senate");
}