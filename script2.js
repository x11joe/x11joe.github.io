// === Global Variables and Initialization ===
let allMembers = []; // Global array to store all members parsed from allMember.xml
let markedTime = null; // Global variable to store a marked time for timestamping events

// DOMContentLoaded event listener to initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    // Load default committees from window object
    const committees = window.DEFAULT_COMMITTEES || {};
    
    // Set default committee and initialize JSON structure
    let currentCommittee = "Senate Judiciary Committee";
    let jsonStructure;

    // Application state variables
    let path = []; // Tracks the current sequence of steps in a flow
    let currentFlow = null; // Current flow from flows.json
    let currentStep = null; // Current step within the flow
    let statementStartTime = null; // Start time of the current statement
    let history = []; // Array of past statements
    let editingIndex = null; // Index of history entry being edited
    let dropdownActive = false; // Tracks if a dropdown is active
    let selectedSuggestionIndex = -1; // Index of highlighted suggestion
    let selectedDropdownIndex = -1; // Index of highlighted dropdown option
    let lastAction = null; // Last action performed by a member
    let lastMovedDetail = null; // Last motion detail moved
    let lastRereferCommittee = null; // Last committee a bill was rereferred to
    let amendmentPassed = false; // Tracks if an amendment has passed
    let pendingAmendment = false; // Tracks if an amendment is moved but not yet voted on
    let editingTestimonyIndex = null; // Index of testimony being edited
    let currentBill = localStorage.getItem('currentBill') || 'Uncategorized'; // Current bill identifier
    let currentBillType = localStorage.getItem('billType') || "Hearing"; // Type of bill (e.g., Hearing, Committee work)
    

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

    try {
        // Fetch and parse flows.json
        const response = await fetch('flows.json');
        jsonStructure = await response.json();
        console.log('flows.json loaded:', jsonStructure);

        // Fetch and parse allMember.xml
        const xmlResponse = await fetch('allMember.xml');
        const xmlText = await xmlResponse.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        allMembers = parseMembersFromXML(xmlDoc);
        console.log('All members loaded:', allMembers);
    } catch (error) {
        console.error('Error loading flows.json or allMember.xml:', error);
        return;
    }

    // Populate committee dropdown
    Object.keys(committees).forEach(committee => {
        const option = document.createElement('option');
        option.value = committee;
        option.textContent = committee;
        committeeSelect.appendChild(option);
    });

    // Load saved committee and bill type
    const savedCommittee = localStorage.getItem('selectedCommittee');
    if (savedCommittee && committees[savedCommittee]) {
        currentCommittee = savedCommittee;
    }
    committeeSelect.value = currentCommittee;
    document.querySelector(`input[name="billType"][value="${currentBillType}"]`).checked = true;

    // Load saved history
    const savedHistory = localStorage.getItem('historyStatements');
    if (savedHistory) {
        history = deserializeHistory(savedHistory);
        // Ensure bill is an object for backward compatibility
        history.forEach(entry => {
            if (typeof entry.bill === 'string') {
                entry.bill = { name: entry.bill, type: 'Hearing' }; // Default to 'Hearing' for old data
            }
        });
        updateHistoryTable();
        console.log('History loaded from local storage:', history);
    }

    // Load state variables from localStorage
    lastAction = localStorage.getItem('lastAction') || null;
    lastMovedDetail = localStorage.getItem('lastMovedDetail') || null;
    lastRereferCommittee = localStorage.getItem('lastRereferCommittee') || null;
    amendmentPassed = localStorage.getItem('amendmentPassed') === 'true';
    pendingAmendment = localStorage.getItem('pendingAmendment') === 'true';
    console.log('Loaded state variables from localStorage:', {
        lastAction,
        lastMovedDetail,
        lastRereferCommittee,
        amendmentPassed,
        pendingAmendment
    });

    // Set lastAction from the most recent member action in history (optional override)
    if (history.length > 0) {
        const lastEntry = history[history.length - 1];
        if (lastEntry.path[0].step === 'member') {
            const actionPart = lastEntry.path.find(p => p.step === 'action');
            if (actionPart) {
                lastAction = actionPart.value;
                console.log('Set lastAction from history to:', lastAction);
                localStorage.setItem('lastAction', lastAction); // Sync with localStorage
            }
        }
    }

    // === Utility Functions ===

    // Suggest motion types for voting actions
    function suggestMotionType() {
        return ["Do Pass", "Do Not Pass", "Without Committee Recommendation"];
    }

    // Suggest reasons a motion failed
    function suggestFailedReason() {
        return ["for lack of a second"];
    }

    function performSpecialCopy(box) {
        const techStatement = box.getAttribute('data-tech-statement');
        const link = box.getAttribute('data-link') || '';
        const memberNo = box.getAttribute('data-memberno') || '';
        const timeStr = box.getAttribute('data-time');
        const time = new Date(timeStr);
        const formattedTime = time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let memberNoFormatted = memberNo ? `member-no:${memberNo};Mic:` : '';
        let specialFormat = `${formattedTime} | ${techStatement} | ${memberNoFormatted} |`;
        if (link) specialFormat += ` ${link}`;
        navigator.clipboard.writeText(specialFormat).then(() => {
            console.log('Copied to clipboard:', specialFormat);
            box.classList.add('special-copied');
            setTimeout(() => box.classList.remove('special-copied'), 500);
        });
    }

    function countDigitsBefore(value, pos) {
        return value.substring(0, pos).replace(/\D/g, '').length;
    }

    function formatLcNumber(event) {
        const input = event.target;
        const oldValue = input.value;
        const oldPos = input.selectionStart;
        const rawDigits = oldValue.replace(/\D/g, '');
        const digitsBefore = countDigitsBefore(oldValue, oldPos);
        let formatted = '';
        if (rawDigits.length > 0) {
            formatted += rawDigits.substring(0, 2);
        }
        if (rawDigits.length > 2) {
            formatted += '.' + rawDigits.substring(2, 6);
        }
        if (rawDigits.length > 6) {
            formatted += '.' + rawDigits.substring(6, 11);
        }
        input.value = formatted;
        // Calculate new cursor position
        let newPos = 0;
        let digitCount = 0;
        for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
                digitCount++;
                if (digitCount > digitsBefore) {
                    newPos = i;
                    break;
                }
            } else {
                if (digitCount === digitsBefore) {
                    newPos = i + 1;
                }
            }
        }
        if (digitCount <= digitsBefore) {
            newPos = formatted.length;
        }
        input.setSelectionRange(newPos, newPos);
    }

    // Determine legislative title (Senator/Representative) based on organization
    function determineTitle(org) {
        const orgLower = org.toLowerCase();
        if (/house/.test(orgLower)) return "Representative";
        else if (/senate/.test(orgLower)) return "Senator";
        return null;
    }

    // Extract the last name from an option string (e.g., "John Doe - Chairman" -> "Doe")
    function extractLastName(option) {
        const parts = option.split(' - ');
        if (parts.length > 1) {
            const namePart = parts[0];
            const nameParts = namePart.split(' ');
            return nameParts[nameParts.length - 1];
        }
        const nameParts = option.split(' ');
        return nameParts[nameParts.length - 1];
    }

    // Parse member data from XML document
    function parseMembersFromXML(xmlDoc) {
        const hotKeys = xmlDoc.getElementsByTagName('HotKey');
        const members = [];
        for (let i = 0; i < hotKeys.length; i++) {
            const hotKey = hotKeys[i];
            const nameElem = hotKey.getElementsByTagName('Name')[0];
            const firstNameElem = hotKey.getElementsByTagName('FirstName')[0];
            const fields = hotKey.getElementsByTagName('Fields')[0];
            if (nameElem && fields) {
                const lastName = nameElem.textContent.trim();
                const firstName = firstNameElem ? firstNameElem.textContent.trim() : '';
                const fullName = firstName ? `${firstName} ${lastName}` : lastName;
                const memberNoField = Array.from(fields.getElementsByTagName('Field')).find(f => f.getElementsByTagName('Key')[0].textContent === 'member-no');
                const memberNo = memberNoField ? memberNoField.getElementsByTagName('Value')[0].textContent.trim() : null;
                if (memberNo) {
                    members.push({ lastName, firstName, fullName, memberNo });
                }
            }
        }
        return members;
    }

    // Find a member's number based on last name, title, and optional first initial
    function findMemberNo(lastName, title, firstInitial = null) {
        const candidates = allMembers.filter(member => 
            member.lastName.toLowerCase() === lastName.toLowerCase() &&
            member.firstName.startsWith(title)
        );
        if (candidates.length === 1) return candidates[0].memberNo;
        if (candidates.length > 1 && firstInitial) {
            const matchingMember = candidates.find(member => member.firstName.includes(firstInitial + '.'));
            return matchingMember ? matchingMember.memberNo : null;
        }
        return null;
    }

    // Get members of the current committee
    function getCommitteeMembers() {
        return committees[currentCommittee] || [];
    }

    // Get other committees of the same type (House/Senate) excluding the current one
    function getOtherCommittees() {
        const isHouse = currentCommittee.toLowerCase().includes("house");
        return Object.keys(committees).filter(c => 
            isHouse ? c.toLowerCase().includes("house") : c.toLowerCase().includes("senate")
        ).filter(c => c !== currentCommittee);
    }

    // Get available options for a specific step in a flow
    function getOptionsForStep(stepType, flow) {
        const stepConfig = flow.steps.find(step => step.step === stepType);
        if (!stepConfig) return [];
        let options = [];
        if (stepConfig.options === "committeeMembers") options = getCommitteeMembers();
        else if (stepConfig.options === "otherCommittees") options = getOtherCommittees();
        else if (stepConfig.options === "allMembers") options = allMembers.map(member => member.fullName);
        else if (stepConfig.options === "suggestMotionType") options = suggestMotionType();
        else if (stepConfig.options === "suggestFailedReason") options = suggestFailedReason();
        else if (Array.isArray(stepConfig.options)) {
            options = stepConfig.options.slice(); // Copy the array to avoid mutating the original
            if (stepType === 'motionModifiers') {
                if (amendmentPassed && lastRereferCommittee) options = ['as Amended', 'and Rereferred', 'Take the Vote'].filter(opt => stepConfig.options.includes(opt));
                else if (amendmentPassed) options = ['as Amended', 'Take the Vote', 'and Rereferred'].filter(opt => stepConfig.options.includes(opt));
                else if (lastRereferCommittee) options = ['and Rereferred', 'Take the Vote', 'as Amended'].filter(opt => stepConfig.options.includes(opt));
                else options = ['Take the Vote', 'as Amended', 'and Rereferred'];
            } else if (stepType === 'afterAmended') {
                options = lastRereferCommittee ? ['and Rereferred', 'Take the Vote'] : ['Take the Vote', 'and Rereferred'];
            } else if (stepType === 'rollCallBaseMotionType') {
                if (pendingAmendment && options.includes('Amendment')) {
                    options = ['Amendment', ...options.filter(opt => opt !== 'Amendment')];
                } else if (lastMovedDetail && options.includes(lastMovedDetail)) {
                    options = [lastMovedDetail, ...options.filter(opt => opt !== lastMovedDetail)];
                }
            }
        }
        return options;
    }

    // Get current options based on the flow and step
    function getCurrentOptions() {
        console.log('getCurrentOptions - currentFlow:', currentFlow, 'currentStep:', currentStep);
        if (!currentFlow) {
            let allOptions = [];
            jsonStructure.startingPoints.forEach(sp => {
                if (sp.options === "committeeMembers") allOptions = allOptions.concat(getCommitteeMembers());
                else if (Array.isArray(sp.options)) allOptions = allOptions.concat(sp.options);
            });
            return allOptions;
        }
        let options = getOptionsForStep(currentStep, currentFlow);
        if (currentFlow === jsonStructure.flows.committeeMemberFlow && currentStep === 'action' && lastAction) {
            if (lastAction === 'Moved') options = ['Seconded', ...options.filter(opt => opt !== 'Seconded')];
            else if (lastAction === 'Seconded' || lastAction === 'Withdrew') options = ['Moved', ...options.filter(opt => opt !== 'Moved')];
            console.log('Reordered action options based on lastAction:', lastAction, 'new options:', options);
        }
        if (currentFlow === jsonStructure.flows.committeeMemberFlow && currentStep === 'movedDetail' && (lastAction === 'Proposed Amendment' || lastAction === 'Introduced Amendment')) {
            if (options.includes('Amendment')) {
                options = ['Amendment', ...options.filter(opt => opt !== 'Amendment')];
                console.log('Reordered movedDetail options based on lastAction:', lastAction, 'new options:', options);
            }
        }
        if (currentFlow === jsonStructure.flows.voteActionFlow && currentStep === 'voiceVoteOn' && lastMovedDetail === 'Reconsider') {
            if (options.includes('Reconsider')) {
                options = ['Reconsider', ...options.filter(opt => opt !== 'Reconsider')];
                console.log('Reordered voiceVoteOn options based on lastMovedDetail:', lastMovedDetail, 'new options:', options);
            }
        }
        return options;
    }

    // Serialize history array to a JSON string for storage
    function serializeHistory(history) {
        return JSON.stringify(history.map(entry => ({
            time: entry.time.toISOString(),
            path: entry.path,
            text: entry.text,
            link: entry.link || '',
            bill: entry.bill ? { name: entry.bill.name, type: entry.bill.type } : { name: 'Uncategorized', type: 'Hearing' }
        })));
    }

    // Deserialize history from a JSON string back to an array
    function deserializeHistory(serialized) {
        const parsed = JSON.parse(serialized);
        return parsed.map(entry => ({
            time: new Date(entry.time),
            path: entry.path,
            text: entry.text,
            link: entry.link || '',
            bill: entry.bill ? { name: entry.bill.name, type: entry.bill.type } : { name: 'Uncategorized', type: 'Hearing' }
        }));
    }

    // Check if a committee is a Senate committee
    function isSenateCommittee(committeeName) {
        return committeeName.toLowerCase().includes("senate");
    }

    // Check if a name is in the list of female names
    function isFemale(fullName) {
        return window.FEMALE_NAMES.includes(fullName);
    }

    // Map testimony format to a simplified category
    function mapFormat(format) {
        if (format && format.includes('In-Person')) return 'In-Person';
        if (format && format.includes('Online')) return 'Online';
        return 'Written';
    }

    // === UI Interaction Functions ===

    // Get the current text input from the input div
    function getCurrentText() {
        let text = '';
        for (let i = inputDiv.childNodes.length - 1; i >= 0; i--) {
            const node = inputDiv.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE) text = node.textContent + text;
            else if (node.classList && node.classList.contains('token')) break;
        }
        return text.trim();
    }

    // Create a tag element for display in the input div
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

    // Attempt to tag the last word in the input as a selectable option
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

    // Select an option and update the path accordingly
    function selectOption(option) {
        console.log('selectOption - option:', option, 'currentStep:', currentStep, 'currentFlow:', currentFlow);
        if (!currentFlow) {
            const startingPoint = jsonStructure.startingPoints.find(sp => {
                if (sp.options === "committeeMembers") return getCommitteeMembers().includes(option);
                else if (Array.isArray(sp.options)) return sp.options.includes(option);
                return false;
            });
            if (startingPoint) {
                currentFlow = jsonStructure.flows[startingPoint.flow];
                console.log('Flow set to:', startingPoint.flow);
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
                        if (firstStep.options === "committeeMembers" || firstStep.options === "allMembers") {
                            const lastName = extractLastName(option);
                            const member = allMembers.find(m => m.lastName === lastName && (m.firstName === 'Senator' || m.firstName === 'Representative'));
                            if (member) {
                                console.log('Member found:', member);
                                path.push({ step: firstStep.step, value: option, memberNo: member.memberNo });
                            } else {
                                console.warn('No member found for option:', option);
                                path.push({ step: firstStep.step, value: option });
                            }
                        } else {
                            path.push({ step: firstStep.step, value: option });
                        }
                        currentStep = typeof firstStep.next === 'string' ? firstStep.next : firstStep.next?.default;
                    } else {
                        path.push({ step: startingPoint.type, value: option });
                        currentStep = firstStep.step;
                    }
                }
                console.log('Initial path:', path, 'currentStep:', currentStep);
            }
        } else {
            const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
            if (stepConfig.type === 'module') {
                const moduleResult = JSON.parse(option);
                const displayText = getModuleDisplayText(currentStep, moduleResult);
                path.push({ step: currentStep, value: option, display: displayText });
                if (currentStep === 'voteModule') {
                    const motionType = path.find(p => p.step === 'rollCallBaseMotionType')?.value;
                    currentStep = (motionType === 'Reconsider' || motionType === 'Amendment') ? null : 'carryBillPrompt';
                } else {
                    currentStep = stepConfig.next;
                }
            } else if (currentStep === 'carryBillPrompt') {
                path.push({ step: currentStep, value: option });
                currentStep = option === 'X Carried the Bill' ? 'billCarrierOptional' : null;
            } else if (currentStep === 'rereferCommittee') {
                path.push({ step: currentStep, value: option });
                currentStep = 'voteModule';
                console.log('Selected committee:', option, 'transitioning to voteModule');
                console.log('Current path after selection:', path);
            } else {
                if (stepConfig.options === "committeeMembers" || stepConfig.options === "allMembers") {
                    const lastName = extractLastName(option);
                    const member = allMembers.find(m => m.lastName === lastName && (m.firstName === 'Senator' || m.firstName === 'Representative'));
                    if (member) {
                        console.log('Member found:', member);
                        path.push({ step: currentStep, value: option, memberNo: member.memberNo });
                    } else {
                        console.warn('No member found for option:', option);
                        path.push({ step: currentStep, value: option });
                    }
                } else {
                    path.push({ step: currentStep, value: option });
                }
                if (stepConfig.next) {
                    if (typeof stepConfig.next === 'string') {
                        currentStep = stepConfig.next;
                    } else {
                        currentStep = stepConfig.next[option];
                    }
                } else {
                    currentStep = null;
                }
            }
        }
        if (path.length === 1) statementStartTime = new Date();
        updateInput();
        setTimeout(() => showSuggestions(''), 0);
    }

    // Show options for editing a tag in the input
    function showTagOptions(tagElement, stepType, pathIndex) {
        console.log('showTagOptions - stepType:', stepType, 'pathIndex:', pathIndex);
        const stepConfig = currentFlow.steps.find(step => step.step === stepType);
        if (stepConfig && stepConfig.type === 'module') {
            const moduleResult = JSON.parse(path[pathIndex].value);
            handleModule(stepConfig, moduleResult);
        } else if (stepType === 'testimony') {
            const part = path[pathIndex];
            populateTestimonyModal(part);
            openTestimonyModal(null, true);
            editingTestimonyIndex = pathIndex;
        } else {
            const flow = currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === stepType)?.flow];
            const options = getOptionsForStep(stepType, flow);
            console.log('Tag options:', options);
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
                    console.log('Tag updated at index', pathIndex, 'from', oldValue, 'to:', opt);
                    smartInvalidateSubsequentTags(pathIndex, oldValue, opt);
                    updateInput();
                    dropdown.remove();
                    dropdownActive = false;
                    setTimeout(() => showSuggestions(getCurrentText()), 0);
                };
                dropdown.appendChild(div);
            });
            document.body.appendChild(dropdown);
            const tagRect = tagElement.getBoundingClientRect();
            dropdown.style.position = 'absolute';
            dropdown.style.left = `${tagRect.left}px`;
            dropdown.style.top = `${tagRect.bottom}px`;
            dropdown.style.zIndex = '10001';
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
    }

    // Invalidate subsequent tags after a change to maintain flow consistency
    function smartInvalidateSubsequentTags(changedIndex, oldValue, newValue) {
        console.log('smartInvalidateSubsequentTags - changedIndex:', changedIndex, 'oldValue:', oldValue, 'newValue:', newValue);
        const part = path[changedIndex];
        const flow = currentFlow || jsonStructure.flows[jsonStructure.startingPoints.find(sp => sp.type === part.step)?.flow];
        const stepConfig = flow.steps.find(step => step.step === part.step);
        if (stepConfig && stepConfig.next && typeof stepConfig.next === 'object') {
            const oldNextStep = stepConfig.next[oldValue] || stepConfig.next.default;
            const newNextStep = stepConfig.next[newValue] || stepConfig.next.default;
            if (oldNextStep !== newNextStep) {
                console.log('Flow path changed from', oldNextStep, 'to', newNextStep);
                const subsequentPath = path.slice(changedIndex + 1);
                path = path.slice(0, changedIndex + 1);
                currentStep = newNextStep;
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
                        const remainingSteps = subsequentPath.slice(voteModuleIndex);
                        path.push(...remainingSteps);
                        currentStep = remainingSteps.length > 1 ? flow.steps.find(step => step.step === remainingSteps[0].step).next : null;
                        console.log('Preserved voteModule and subsequent steps:', remainingSteps);
                    } else {
                        console.log('Could not preserve subsequent steps; truncated path');
                    }
                } else {
                    console.log('No preservation logic applied; truncated path');
                }
            } else {
                console.log('Flow path unchanged, no invalidation needed');
            }
        } else {
            console.log('Non-critical step or no branching, no invalidation');
        }
    }

    // Update the input div with current path tags
    function updateInput() {
        console.log('updateInput - path:', path);
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
        console.log('showSuggestions called with text:', text, 'currentStep:', currentStep, 'currentFlow:', currentFlow);
        if (!text && !currentStep) {
            modal.classList.remove('active');
            console.log('Modal hidden: no text and no current step');
            return;
        }
        if (dropdownActive) {
            console.log('Suggestions skipped: dropdown is active');
            return;
        }
        if (currentFlow && currentStep) {
            const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
            if (stepConfig && stepConfig.type === 'module') {
                console.log('Opening module for step:', currentStep);
                // Check if editing an existing module value
                const currentPathStep = path.find(p => p.step === currentStep);
                const existingValues = currentPathStep ? JSON.parse(currentPathStep.value) : null;
                handleModule(stepConfig, existingValues);
                return;
            }
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

    // Position the suggestion modal dynamically
    function positionModal() {
        const inputRect = inputDiv.getBoundingClientRect();
        const containerRect = document.querySelector('.container').getBoundingClientRect();
        const modalHeight = modal.offsetHeight;
    
        // Check if there's enough space above the input field in the viewport
        if (inputRect.top >= modalHeight) {
            // Place above the input
            modal.style.top = (inputRect.top - containerRect.top - modalHeight) + 'px';
        } else {
            // Place below the input
            modal.style.top = (inputRect.bottom - containerRect.top) + 'px';
        }
    
        // Align modal with the input field's left edge and match its width
        modal.style.left = '0';
        modal.style.width = inputRect.width + 'px';
    }

    // Update highlighting for suggestion options
    function updateSuggestionHighlight(suggestions) {
        suggestions.forEach((sug, idx) => {
            sug.classList.toggle('highlighted', idx === selectedSuggestionIndex);
        });
    }

    // Update highlighting for dropdown options
    function updateDropdownHighlight(dropdown) {
        const options = dropdown.querySelectorAll('.dropdown-option');
        options.forEach((opt, idx) => {
            opt.classList.toggle('highlighted', idx === selectedDropdownIndex);
        });
    }

    // Remove the last tag from the input and update the flow
    function removeLastTag() {
        if (path.length > 0) {
            path.pop();
            console.log('removeLastTag - After pop, path:', path);
            if (path.length > 0) {
                const firstValue = path[0].value;
                const startingPoint = jsonStructure.startingPoints.find(sp => {
                    if (sp.options === "committeeMembers") return getCommitteeMembers().includes(firstValue);
                    else if (Array.isArray(sp.options)) return sp.options.includes(firstValue);
                    return false;
                });
                if (startingPoint) {
                    currentFlow = jsonStructure.flows[startingPoint.flow];
                    console.log('currentFlow set to:', startingPoint.flow);
                    const lastPart = path[path.length - 1];
                    const stepConfig = currentFlow.steps.find(step => step.step === lastPart.step);
                    if (stepConfig && stepConfig.next) {
                        currentStep = typeof stepConfig.next === 'string' ? stepConfig.next : stepConfig.next[lastPart.value] || stepConfig.next.default || null;
                        console.log('currentStep set to:', currentStep);
                    } else {
                        currentStep = null;
                        console.log('No next step found, currentStep set to null');
                    }
                    // Special logic for modules
                    if (stepConfig && stepConfig.type === 'module' && currentStep === null) {
                        if (lastPart.step === 'voteModule') {
                            const motionType = path.find(p => p.step === 'rollCallBaseMotionType')?.value;
                            if (motionType && motionType !== 'Reconsider' && motionType !== 'Amendment') {
                                currentStep = 'carryBillPrompt';
                                console.log('Special logic for voteModule: set currentStep to carryBillPrompt');
                            }
                        }
                        // Add similar logic for other modules if needed
                    }
                } else {
                    currentFlow = null;
                    currentStep = null;
                    console.log('No starting point found for first value:', firstValue);
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

    // Handle module input (e.g., vote counts, amendment text)
    function handleModule(stepConfig, existingValues = null) {
        modal.innerHTML = '';
        const form = document.createElement('div');
        form.className = 'module-form';
        const moduleValues = existingValues ? { ...existingValues } : {};
    
        stepConfig.fields.forEach(field => {
            const container = document.createElement('div');
            const label = document.createElement('label');
            label.textContent = field.label || `${field.name}: `;
    
            if (field.type === 'text') {
                const input = document.createElement('input');
                input.type = 'text';
                input.id = `module-${field.name}`;
                let defaultValue = field.default || '';
                if (defaultValue.includes("current_year")) {
                    const currentYear = new Date().getFullYear().toString().slice(-2);
                    defaultValue = defaultValue.replace("current_year", currentYear);
                }
                input.value = moduleValues[field.name] || defaultValue;
                input.placeholder = field.placeholder || '';
                if (field.maxlength) input.maxLength = field.maxlength;
                if (field.name === 'lcNumber') {
                    input.classList.add('lc-number-input');
                    input.addEventListener('input', formatLcNumber);
                    label.style.width = 'auto'; // Ensure the full label is visible
                    // Set initial cursor position after the first period
                    setTimeout(() => {
                        const firstPeriodIndex = input.value.indexOf('.');
                        if (firstPeriodIndex !== -1) {
                            input.setSelectionRange(firstPeriodIndex + 1, firstPeriodIndex + 1);
                        } else {
                            input.setSelectionRange(0, 0);
                        }
                        input.focus();
                    }, 0);
                    // Add keydown listener for Tab and Shift+Tab navigation
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            const currentPos = input.selectionStart;
                            const periods = [];
                            let index = -1;
                            while ((index = input.value.indexOf('.', index + 1)) !== -1) {
                                periods.push(index);
                            }
                            const nextPeriod = periods.find(p => p > currentPos - 1);
                            if (nextPeriod !== undefined) {
                                input.setSelectionRange(nextPeriod + 1, nextPeriod + 1);
                            } else {
                                // In the last section, submit the form
                                const submitButton = document.getElementById('module-submit');
                                if (submitButton) {
                                    submitButton.click();
                                }
                            }
                        } else if (e.key === 'Tab' && e.shiftKey) {
                            e.preventDefault();
                            const currentPos = input.selectionStart;
                            const periods = [];
                            let index = -1;
                            while ((index = input.value.indexOf('.', index + 1)) !== -1) {
                                periods.push(index);
                            }
                            const previousPeriod = periods.reverse().find(p => p < currentPos - 1);
                            if (previousPeriod !== undefined) {
                                input.setSelectionRange(previousPeriod + 1, previousPeriod + 1);
                            } else {
                                // No previous period, move to start
                                input.setSelectionRange(0, 0);
                            }
                        }
                    });
                }
                container.appendChild(label);
                container.appendChild(input);
            } else if (field.type === 'number') {
                const input = document.createElement('input');
                input.type = 'number';
                input.id = `module-${field.name}`;
                if (moduleValues[field.name] === undefined) {
                    moduleValues[field.name] = 0;
                }
                input.value = moduleValues[field.name];
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
                input.addEventListener('input', () => {
                    const value = parseInt(input.value, 10);
                    if (isNaN(value) || value < 0) {
                        input.value = 0;
                        moduleValues[field.name] = 0;
                    } else {
                        moduleValues[field.name] = value;
                    }
                });
                container.appendChild(label);
                container.appendChild(decrement);
                container.appendChild(input);
                container.appendChild(increment);
            }
            form.appendChild(container);
        });
    
        const submit = document.createElement('button');
        submit.id = 'module-submit';
        submit.textContent = 'Submit';
        submit.onclick = () => {
            const moduleResult = {};
            stepConfig.fields.forEach(field => {
                const input = document.getElementById(`module-${field.name}`);
                if (field.type === 'number') {
                    const value = parseInt(input.value, 10);
                    moduleResult[field.name] = isNaN(value) ? 0 : value;
                } else if (field.type === 'text') {
                    moduleResult[field.name] = input.value;
                }
            });
            const resultStr = JSON.stringify(moduleResult);
            if (currentStep === stepConfig.step) {
                selectOption(resultStr);
            } else {
                const moduleIndex = path.findIndex(p => p.step === stepConfig.step);
                if (moduleIndex !== -1) {
                    path[moduleIndex].value = resultStr;
                    path[moduleIndex].display = getModuleDisplayText(stepConfig.step, moduleResult);
                    updateInput();
                    showSuggestions('');
                }
            }
            modal.classList.remove('active');
        };
        form.appendChild(submit);
        modal.appendChild(form);
        modal.classList.add('active');
        positionModal();
    }

    // Adjust the layout of the history section based on window size
    function adjustHistoryLayout() {
        const entryRect = entryWrapper.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const gap = 10;
        const historyTop = entryRect.bottom + gap;
        historyDiv.style.top = `${historyTop}px`;
        const maxHistoryHeight = viewportHeight - historyTop - 10;
        historyDiv.style.height = `${maxHistoryHeight}px`;
    }

    // === Testimony Management ===

    // Reset the testimony modal to default values
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

    // Open the testimony modal, optionally pre-filling with details
    function openTestimonyModal(testimonyDetails = null, isEditing = false) {
        console.log('openTestimonyModal called, isEditing:', isEditing);
        submitTestimonyButton.textContent = isEditing ? 'Save Testimony' : 'Add Testimony';
        if (testimonyDetails) {
            const nameParts = testimonyDetails.name ? testimonyDetails.name.split(', ').map(s => s.trim()) : [];
            const lastName = nameParts[0] || '';
            const firstName = nameParts.slice(1).join(', ') || '';
            setTimeout(() => {
                document.getElementById('testimonyFirstName').value = firstName;
                document.getElementById('testimonyLastName').value = lastName;
                document.getElementById('testimonyRole').value = testimonyDetails.role || '';
                document.getElementById('testimonyOrganization').value = testimonyDetails.org || '';
                document.getElementById('testimonyPosition').value = testimonyDetails.position || '';
                document.getElementById('testimonyNumber').value = testimonyDetails.testimonyNo || '';
                document.getElementById('testimonyLink').value = testimonyDetails.link || '';
                const formatSelect = document.getElementById('testimonyFormat');
                if (formatSelect) formatSelect.value = mapFormat(testimonyDetails.format);
            }, 0);
        } else if (!isEditing) {
            resetTestimonyModal();
        }
        testimonyModal.classList.add('active');
        console.log('Modal opened, isEditing:', isEditing, 'button text:', submitTestimonyButton.textContent);
    }

    // Close the testimony modal and reset state if editing
    function closeTestimonyModal() {
        if (editingTestimonyIndex !== null) {
            path = [];
            currentFlow = null;
            currentStep = null;
            statementStartTime = null;
            editingIndex = null;
            inputDiv.innerHTML = '';
            inputDiv.appendChild(document.createTextNode(' '));
            inputDiv.focus();
            showSuggestions('');
        }
        testimonyModal.classList.remove('active');
        editingTestimonyIndex = null;
        submitTestimonyButton.textContent = 'Add Testimony';
    }

    // Populate the testimony modal with existing data
    function populateTestimonyModal(part) {
        setTimeout(() => {
            console.log('populateTestimonyModal called with:', part);
            let testimonyDetails = part.details || parseTestimonyString(part.value);
            console.log('Populating modal with:', testimonyDetails);
            document.getElementById('testimonyFirstName').value = testimonyDetails.firstName || '';
            document.getElementById('testimonyLastName').value = testimonyDetails.lastName || '';
            document.getElementById('testimonyRole').value = testimonyDetails.role || '';
            document.getElementById('testimonyOrganization').value = testimonyDetails.organization || '';
            document.getElementById('testimonyPosition').value = testimonyDetails.position || '';
            document.getElementById('testimonyNumber').value = testimonyDetails.number || '';
            document.getElementById('testimonyLink').value = testimonyDetails.link || '';
            const formatSelect = document.getElementById('testimonyFormat');
            if (formatSelect) {
                formatSelect.value = testimonyDetails.format || 'Online';
                console.log('Set testimonyFormat to:', formatSelect.value);
            }
        }, 0);
    }

    // Submit testimony from the modal and add to history or update existing entry
    function submitTestimonyModal() {
        const firstName = document.getElementById('testimonyFirstName').value.trim();
        const lastName = document.getElementById('testimonyLastName').value.trim();
        const role = document.getElementById('testimonyRole').value.trim();
        const organization = document.getElementById('testimonyOrganization').value.trim();
        const position = document.getElementById('testimonyPosition').value;
        const number = document.getElementById('testimonyNumber').value.trim();
        const link = document.getElementById('testimonyLink').value.trim();
        const format = document.getElementById('testimonyFormat').value;
        if (!position) {
            alert('Position is required.');
            return;
        }
        const parts = [];
        if (firstName || lastName) parts.push(`${firstName} ${lastName}`.trim());
        if (role) parts.push(role);
        if (organization) parts.push(organization);
        parts.push(position);
        if (number) parts.push(`Testimony#${number}`);
        const testimonyString = parts.join(' - ');
        if (editingTestimonyIndex !== null) {
            const existingDetails = path[editingTestimonyIndex].details || {};
            const updatedDetails = {
                ...existingDetails,
                firstName,
                lastName,
                role,
                organization,
                position,
                number,
                format,
                link,
                promptedForSenatorRepresentative: false,
                isSenatorRepresentative: false,
                isIntroducingBill: false,
                title: null
            };
            path[editingTestimonyIndex].value = testimonyString;
            path[editingTestimonyIndex].details = updatedDetails;
            if (editingIndex !== null) finalizeStatement();
            else {
                updateInput();
                showSuggestions('');
            }
            closeTestimonyModal();
        } else {
            const testimonyObject = {
                firstName,
                lastName,
                role,
                organization,
                position,
                number,
                format,
                link,
                promptedForSenatorRepresentative: false,
                isSenatorRepresentative: false,
                isIntroducingBill: false,
                title: null
            };
            const startTime = markedTime || new Date();
            console.log('Adding testimony - markedTime is:', markedTime ? 'true' : 'false', 'value:', markedTime, 'startTime used:', startTime);
            if (markedTime) {
                markedTime = null;
                document.querySelector('.page-wrapper').classList.remove('marking-time');
                console.log('Used markedTime for testimony, reset marking - markedTime is now:', markedTime ? 'true' : 'false', 'value:', markedTime);
            }
            const pathEntry = { step: 'testimony', value: testimonyString, details: testimonyObject };
            const newEntry = { 
                time: startTime, 
                path: [pathEntry], 
                text: testimonyString, 
                link: link, 
                bill: { name: currentBill, type: currentBillType } 
            };
            history.push(newEntry);
            handleTestimonyPrompts(history.length - 1).then(() => {
                updateHistoryTable(newEntry);
                setTimeout(() => {
                    document.getElementById('historyWrapper').scrollTop = 0;
                    console.log('Scrolled to top after adding new testimony');
                }, 0);
                localStorage.setItem('historyStatements', serializeHistory(history));
                console.log('Added testimony to history:', newEntry.text);
                closeTestimonyModal();
            });
        }
    }

    // Parse a testimony string into structured details
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
                if (nameParts.length > 1) {
                    testimonyDetails.firstName = nameParts.slice(0, -1).join(' ');
                    testimonyDetails.lastName = nameParts[nameParts.length - 1];
                } else {
                    testimonyDetails.firstName = beforeParts[0];
                    testimonyDetails.lastName = '';
                }
            }
            if (beforeParts.length >= 2) testimonyDetails.role = beforeParts[1];
            if (beforeParts.length >= 3) testimonyDetails.organization = beforeParts[2];
        }
        return testimonyDetails;
    }

    // Prompt user for additional testimony details (e.g., Senator/Representative status)
    function handleTestimonyPrompts(index) {
        return new Promise((resolve) => {
            const entry = history[index];
            if (entry.path[0].step !== 'testimony') {
                resolve();
                return;
            }
            const testimonyDetails = entry.path[0].details;
            const roleLower = testimonyDetails.role ? testimonyDetails.role.toLowerCase() : '';
            const organizationLower = testimonyDetails.organization ? testimonyDetails.organization.toLowerCase() : '';
            const keywordsRegex = /representative|representatives|senator|senators|house|senate/i;
            console.log('Checking prompts for testimony:', testimonyDetails);
            if ((keywordsRegex.test(roleLower) || keywordsRegex.test(organizationLower)) && !testimonyDetails.promptedForSenatorRepresentative) {
                showCustomConfirm("Is this a senator or representative?").then((isSenRep) => {
                    testimonyDetails.promptedForSenatorRepresentative = true;
                    if (isSenRep) {
                        testimonyDetails.isSenatorRepresentative = true;
                        let title = /representative/.test(roleLower) ? "Representative" : (/senator/.test(roleLower) ? "Senator" : determineTitle(testimonyDetails.organization));
                        if (title) {
                            testimonyDetails.title = title;
                            const firstInitial = testimonyDetails.firstName ? testimonyDetails.firstName.charAt(0) : null;
                            const memberNo = findMemberNo(testimonyDetails.lastName, title, firstInitial);
                            if (memberNo) testimonyDetails.memberNo = memberNo;
                            else console.warn('Could not find memberNo for', title, testimonyDetails.lastName);
                            showCustomConfirm("Are they introducing a bill?").then((isIntroducing) => {
                                testimonyDetails.isIntroducingBill = isIntroducing;
                                const lastName = testimonyDetails.lastName;
                                if (isIntroducing) {
                                    entry.text = `${title} ${lastName} - Introduced Bill`;
                                    if (testimonyDetails.number) {
                                        entry.text += ` - Testimony#${testimonyDetails.number}`;
                                    }
                                } else {
                                    entry.text = `${title} ${lastName} - ${testimonyDetails.position}`;
                                    if (testimonyDetails.number) {
                                        entry.text += ` - Testimony#${testimonyDetails.number}`;
                                    }
                                }
                                entry.path[0].value = entry.text;
                                entry.path[0].details = { ...testimonyDetails };
                                localStorage.setItem('historyStatements', serializeHistory(history));
                                resolve();
                            });
                        } else {
                            console.warn('Could not determine title from role or organization:', testimonyDetails.role, testimonyDetails.organization);
                            resolve();
                        }
                    } else {
                        testimonyDetails.isSenatorRepresentative = false;
                        entry.path[0].details = { ...testimonyDetails };
                        localStorage.setItem('historyStatements', serializeHistory(history));
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // === Statement and History Management ===

    // Construct a procedural statement for testimony entries
    function constructProceduralStatement(time, testimonyDetails) {
        const { firstName, lastName, role, organization, position, number, format, introducingBill, title } = testimonyDetails;
        const fullName = `${firstName} ${lastName}`.trim();
        const hours = time.getHours();
        const minutes = time.getMinutes().toString().padStart(2, '0');
        const period = hours >= 12 ? 'p.m.' : 'a.m.';
        const formattedHours = hours % 12 || 12;
        const formattedTime = `${formattedHours}:${minutes} ${period}`;
        let statement;
        if (introducingBill && title) {
            statement = `${formattedTime} ${title} ${lastName} introduced the bill`;
            if (number) {
                const positionPhrase = position === 'Neutral' ? 'as neutral' : position.toLowerCase();
                statement += ` and submitted testimony ${positionPhrase} #${number}`;
            }
        } else {
            let nameSection = fullName;
            const descriptors = [];
            if (role) descriptors.push(role);
            if (organization) descriptors.push(organization);
            if (descriptors.length > 0) nameSection += ', ' + descriptors.join(', ');
            const action = format === 'Written' ? (number ? `submitted testimony #${number}` : 'testified') : 'testified';
            const positionPhrase = position === 'Neutral' ? 'as neutral' : position.toLowerCase();
            statement = descriptors.length > 0 ? 
                `${formattedTime} ${nameSection}, ${action} ${positionPhrase}` : 
                `${formattedTime} ${nameSection} ${action} ${positionPhrase}`;
            if (format !== 'Written' && number) statement += ` and submitted testimony #${number}`;
        }
        return statement;
    }

    // Construct a procedural statement for member actions
    function constructMemberActionProceduralStatement(time, path) {
        const memberString = path.find(p => p.step === 'member')?.value || '';
        const { lastName, title } = parseMember(memberString);
        const action = path.find(p => p.step === 'action')?.value || '';
        const hours = time.getHours();
        const minutes = time.getMinutes().toString().padStart(2, '0');
        const period = hours >= 12 ? 'p.m.' : 'a.m.';
        const formattedHours = hours % 12 || 12;
        const formattedTime = `${formattedHours}:${minutes} ${period}`;
        let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
        let statement = `${formattedTime} ${memberText}`;
        if (action === 'Proposed Amendment' || action === 'Introduced Amendment') {
            const verb = action.split(' ')[0].toLowerCase();
            const amendmentProvider = path.find(p => p.step === 'amendmentProvider')?.value;
            if (amendmentProvider === 'Self') {
                const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
                if (amendmentType === 'Verbal') {
                    statement += ` ${verb} verbal amendment`;
                } else if (amendmentType === 'LC#') {
                    const lcNumberStr = path.find(p => p.step === 'lcNumber') ? JSON.parse(path.find(p => p.step === 'lcNumber').value).lcNumber : '00.0000.00000';
                    statement += ` ${verb} amendment LC# ${lcNumberStr}`;
                }
            } else if (amendmentProvider === 'Provided By') {
                const providerType = path.find(p => p.step === 'providerType')?.value;
                let providerText = '';
                if (providerType === 'Senator or Representative') {
                    const providerMember = path.find(p => p.step === 'providerMember')?.value || '';
                    const { lastName: providerLastName, title: providerTitle } = parseMember(providerMember);
                    providerText = providerTitle ? `${providerTitle} ${providerLastName}` : providerLastName;
                } else if (providerType === 'External Source') {
                    const provider = path.find(p => p.step === 'providerText') ? JSON.parse(path.find(p => p.step === 'providerText').value).provider : '';
                    providerText = provider;
                }
                const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
                if (amendmentType === 'Verbal') {
                    statement += ` ${verb} verbal amendment provided by ${providerText}`;
                } else if (amendmentType === 'LC#') {
                    const lcNumberStr = path.find(p => p.step === 'lcNumber') ? JSON.parse(path.find(p => p.step === 'lcNumber').value).lcNumber : '00.0000.00000';
                    statement += ` ${verb} amendment LC# ${lcNumberStr} provided by ${providerText}`;
                }
            }
        } else {
            const detail = path.find(p => p.step === 'movedDetail')?.value || '';
            const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
            if (action === 'Moved') {
                if (detail === 'Amendment') {
                    const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
                    if (amendmentType === 'Verbal') statement += ` moved verbal amendment`;
                    else if (amendmentType === 'LC#') {
                        const lcNumberStr = path.find(p => p.step === 'lcNumber') ? JSON.parse(path.find(p => p.step === 'lcNumber').value).lcNumber : '00.0000.00000';
                        statement += ` moved amendment LC# ${lcNumberStr}`;
                    }
                } else if (detail === 'Reconsider') {
                    statement += ` moved to reconsider`;
                } else if (detail === 'Without Committee Recommendation') {
                    statement += ` moved without committee recommendation`;
                } else {
                    const motionTypesRequiringArticle = suggestMotionType();
                    statement += motionTypesRequiringArticle.includes(detail) ? ` moved a ${detail}` : ` moved ${detail}`;
                }
                if (rerefer) statement += ` and rereferred to ${getShortCommitteeName(rerefer)}`;
            } else if (action === 'Seconded') statement += ` seconded the motion`;
            else if (action === 'Withdrew') statement += ` withdrew the motion`;
            else if (action === 'Introduced Bill') statement += ` introduced the bill`;
            else statement += ` performed action: ${action}`;
        }
        return statement;
    }

    function constructMeetingActionProceduralStatement(time, path) {
        const action = path.find(p => p.step === 'meetingAction')?.value || '';
        const memberString = path.find(p => p.step === 'memberOptional')?.value || '';
        const hours = time.getHours();
        const minutes = time.getMinutes().toString().padStart(2, '0');
        const period = hours >= 12 ? 'p.m.' : 'a.m.';
        const formattedHours = hours % 12 || 12;
        const formattedTime = `${formattedHours}:${minutes} ${period}`;
        const actionWords = action.split(' ');
        const verb = actionWords[0].toLowerCase();
        const noun = actionWords[1].toLowerCase();
        const actionPhrase = `${verb} the ${noun}`;
        if (memberString) {
            const { lastName, title } = parseMember(memberString);
            let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
            return `${formattedTime} ${memberText} ${actionPhrase}`;
        } else {
            return `${formattedTime} ${actionPhrase.charAt(0).toUpperCase() + actionPhrase.slice(1)}`;
        }
    }

    // Construct display text for a vote tag
    function constructVoteTagText(voteResult) {
        const forVotes = voteResult.for || 0;
        const againstVotes = voteResult.against || 0;
        const neutralVotes = voteResult.neutral || 0;
        const outcome = forVotes > againstVotes ? 'Passed' : 'Failed';
        return `Motion ${outcome} ${forVotes}-${againstVotes}-${neutralVotes}`;
    }

    // Construct the full statement text based on the path
    function constructStatementText(path) {
        if (path.length === 0) return '';
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
                    const forVotes = result.for || 0;
                    const againstVotes = result.against || 0;
                    const neutralVotes = result.neutral || 0;
                    const outcome = forVotes > againstVotes ? 'Passed' : 'Failed';
                    let motionText = baseMotionType;
                    if (modifiers.includes('as Amended')) motionText += ' as Amended';
                    if (modifiers.includes('and Rereferred')) {
                        motionText += rereferCommittee ? ` and Rereferred to ${getShortCommitteeName(rereferCommittee)}` : ' and Rereferred';
                    }
                    text = `Roll Call Vote on ${motionText} - Motion ${outcome} ${forVotes}-${againstVotes}-${neutralVotes}`;
                    if (billCarrier && path.find(p => p.step === 'carryBillPrompt')?.value === 'X Carried the Bill') {
                        const { lastName, title } = parseMember(billCarrier);
                        const memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
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
            const { lastName, title } = parseMember(memberString);
            const action = path.find(p => p.step === 'action')?.value || '';
            let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
            if (action === 'Proposed Amendment' || action === 'Introduced Amendment') {
                const verb = action.split(' ')[0].toLowerCase();
                const amendmentProvider = path.find(p => p.step === 'amendmentProvider')?.value;
                if (amendmentProvider === 'Self') {
                    const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
                    if (amendmentType === 'Verbal') {
                        return `${memberText} ${verb} Verbal Amendment`;
                    } else if (amendmentType === 'LC#') {
                        const lcNumberStr = path.find(p => p.step === 'lcNumber') ? JSON.parse(path.find(p => p.step === 'lcNumber').value).lcNumber : '00.0000.00000';
                        const version = lcNumberStr.split('.')[2] || '00000';
                        return `${memberText} ${verb} Amendment LC# .${version}`;
                    }
                } else if (amendmentProvider === 'Provided By') {
                    const providerType = path.find(p => p.step === 'providerType')?.value;
                    let providerText = '';
                    if (providerType === 'Senator or Representative') {
                        const providerMember = path.find(p => p.step === 'providerMember')?.value || '';
                        const { lastName: providerLastName, title: providerTitle } = parseMember(providerMember);
                        providerText = providerTitle ? `${providerTitle} ${providerLastName}` : providerLastName;
                    } else if (providerType === 'External Source') {
                        const provider = path.find(p => p.step === 'providerText') ? JSON.parse(path.find(p => p.step === 'providerText').value).provider : '';
                        providerText = provider;
                    }
                    const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
                    if (amendmentType === 'Verbal') {
                        return `${memberText} ${verb} Verbal Amendment provided by ${providerText}`;
                    } else if (amendmentType === 'LC#') {
                        const lcNumberStr = path.find(p => p.step === 'lcNumber') ? JSON.parse(path.find(p => p.step === 'lcNumber').value).lcNumber : '00.0000.00000';
                        const version = lcNumberStr.split('.')[2] || '00000';
                        return `${memberText} ${verb} Amendment LC# .${version} provided by ${providerText}`;
                    }
                }
            } else {
                const detail = path.find(p => p.step === 'movedDetail')?.value || '';
                const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
                let text = `${memberText} ${action.toLowerCase()}`;
                if (detail) {
                    if (detail === 'Amendment') {
                        const amendmentType = path.find(p => p.step === 'amendmentType')?.value;
                        if (amendmentType === 'Verbal') text += ' verbal amendment';
                        else if (amendmentType === 'LC#') {
                            const lcNumberStr = path.find(p => p.step === 'lcNumber') ? JSON.parse(path.find(p => p.step === 'lcNumber').value).lcNumber : '00.0000.00000';
                            const version = lcNumberStr.split('.')[2] || '00000';
                            text += ` amendment LC# .${version}`;
                        }
                    } else {
                        text += ` ${detail}`;
                    }
                }
                if (rerefer) text += ` and rereferred to ${getShortCommitteeName(rerefer)}`;
                return text;
            }
        } else if (flowType === 'meetingAction') {
            const action = path.find(p => p.step === 'meetingAction')?.value || '';
            return action;
        } else if (flowType === 'introducedBill') {
            const memberString = path.find(p => p.step === 'member')?.value || '';
            const { lastName, title } = parseMember(memberString);
            let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
            return `${memberText} - Introduced Bill`;
        }
        return path.map(p => p.value).join(' - ');
    }

    // Finalize a statement and add it to history
    function finalizeStatement() {
        if (path.length === 0) return;
        const statementText = constructStatementText(path);
        if (currentFlow === jsonStructure.flows.committeeMemberFlow) {
            const actionPart = path.find(p => p.step === 'action');
            if (actionPart) {
                lastAction = actionPart.value;
                console.log('Updated lastAction to:', lastAction);
                localStorage.setItem('lastAction', lastAction);
                if (lastAction === 'Moved') {
                    const detailPart = path.find(p => p.step === 'movedDetail');
                    if (detailPart) {
                        lastMovedDetail = detailPart.value;
                        console.log('Updated lastMovedDetail to:', lastMovedDetail);
                        localStorage.setItem('lastMovedDetail', lastMovedDetail);
                        if (lastMovedDetail === 'Amendment') {
                            pendingAmendment = true;
                            console.log('Set pendingAmendment to true');
                            localStorage.setItem('pendingAmendment', 'true');
                        }
                    }
                    const rereferPart = path.find(p => p.step === 'rereferOptional');
                    if (rereferPart) {
                        lastRereferCommittee = rereferPart.value;
                        console.log('Updated lastRereferCommittee to:', lastRereferCommittee);
                        localStorage.setItem('lastRereferCommittee', lastRereferCommittee);
                    } else {
                        lastRereferCommittee = null;
                        localStorage.removeItem('lastRereferCommittee');
                    }
                }
            }
        } else if (currentFlow === jsonStructure.flows.voteActionFlow) {
            const voteType = path.find(p => p.step === 'voteType')?.value;
            if (voteType === 'Voice Vote') {
                const onWhat = path.find(p => p.step === 'voiceVoteOn')?.value;
                const outcome = path.find(p => p.step === 'voiceVoteOutcome')?.value;
                if (onWhat === 'Amendment') {
                    pendingAmendment = false;
                    console.log('Voice Vote on Amendment finalized, set pendingAmendment to false');
                    localStorage.setItem('pendingAmendment', 'false');
                    if (outcome === 'Passed') {
                        amendmentPassed = true;
                        console.log('Amendment passed, setting amendmentPassed to true');
                        localStorage.setItem('amendmentPassed', 'true');
                    } else {
                        amendmentPassed = false;
                        console.log('Amendment failed, setting amendmentPassed to false');
                        localStorage.setItem('amendmentPassed', 'false');
                    }
                }
            } else if (voteType === 'Roll Call Vote') {
                const motionType = path.find(p => p.step === 'rollCallBaseMotionType')?.value;
                if (motionType === 'Amendment') {
                    pendingAmendment = false;
                    console.log('Vote on Amendment finalized, set pendingAmendment to false');
                    localStorage.setItem('pendingAmendment', 'false');
                    const voteResultPart = path.find(p => p.step === 'voteModule');
                    if (voteResultPart) {
                        const result = JSON.parse(voteResultPart.value);
                        const forVotes = result.for || 0;
                        const againstVotes = result.against || 0;
                        if (forVotes > againstVotes) {
                            amendmentPassed = true;
                            console.log('Roll Call Vote on Amendment passed, setting amendmentPassed to true');
                            localStorage.setItem('amendmentPassed', 'true');
                        } else {
                            amendmentPassed = false;
                            console.log('Roll Call Vote on Amendment failed, setting amendmentPassed to false');
                            localStorage.setItem('amendmentPassed', 'false');
                        }
                    }
                } else {
                    // Reset amendment and rerefer tracking for non-Amendment motions
                    amendmentPassed = false;
                    lastRereferCommittee = null;
                    console.log('Non-Amendment motion finalized, reset amendmentPassed and lastRereferCommittee');
                    localStorage.setItem('amendmentPassed', 'false');
                    localStorage.removeItem('lastRereferCommittee');
                }
            }
        }
        const startTime = markedTime || statementStartTime || new Date();
        console.log('Finalizing statement - markedTime is:', markedTime ? 'true' : 'false', 'value:', markedTime, 'startTime used:', startTime);
        if (markedTime) {
            markedTime = null;
            document.querySelector('.page-wrapper').classList.remove('marking-time');
            console.log('Used markedTime for event, reset marking - markedTime is now:', markedTime ? 'true' : 'false', 'value:', markedTime);
        }
        if (editingIndex !== null) {
            history[editingIndex] = { 
                time: startTime, 
                path: [...path], 
                text: statementText, 
                link: history[editingIndex].link || '', 
                bill: history[editingIndex].bill // Preserve existing bill object
            };
            console.log('Edited history entry at index', editingIndex, ':', history[editingIndex]);
            if (path[0].step === 'testimony') {
                handleTestimonyPrompts(editingIndex).then(() => {
                    updateHistoryTable();
                    localStorage.setItem('historyStatements', serializeHistory(history));
                });
            } else {
                updateHistoryTable();
                localStorage.setItem('historyStatements', serializeHistory(history));
            }
        } else {
            const newEntry = { 
                time: startTime, 
                path: [...path], 
                text: statementText, 
                link: '', 
                bill: { name: currentBill, type: currentBillType } 
            };
            history.push(newEntry);
            updateHistoryTable(newEntry);
            setTimeout(() => {
                document.getElementById('historyWrapper').scrollTop = 0;
                console.log('Scrolled to top after adding new entry');
            }, 0);
            console.log('Added new history entry:', newEntry);
            localStorage.setItem('historyStatements', serializeHistory(history));
        }
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

    // Get display text for a module step (e.g., vote results, LC number)
    function getModuleDisplayText(step, moduleResult) {
        if (step === 'voteModule') return constructVoteTagText(moduleResult);
        else if (step === 'lcNumber') {
            const lcNumberStr = moduleResult.lcNumber || '00.0000.00000';
            const version = lcNumberStr.split('.')[2] || '00000';
            return `LC# .${version}`;
        }
        else if (step === 'providerText') return `Provided by ${moduleResult.provider || ''}`;
        else if (step === 'amendmentModule') return `Amendment: ${moduleResult.amendmentText || ''}`;
        return JSON.stringify(moduleResult);
    }

    // Get display text for a tag based on step and value
    function getTagText(step, value) {
        if (step === 'member' || step === 'memberOptional' || step === 'billCarrierOptional') {
            const { name, title } = parseMember(value);
            return title ? `${title} ${name}` : name;
        }
        return value;
    }

    // Parse member string into name and title components
    function parseMember(memberString) {
        const titleMatch = memberString.match(/^(Senator|Representative)\s+/);
        if (titleMatch) {
            const title = titleMatch[0].trim();
            const name = memberString.replace(title, '').trim();
            const lastName = name.split(' ').pop();
            return { name, lastName, title };
        }
        const parts = memberString.split(' - ');
        if (parts.length === 2) {
            const name = parts[0];
            let baseTitle = parts[1];
            const isFemaleMember = isFemale(name);
            if (baseTitle === 'Chairman') baseTitle = isFemaleMember ? 'Chairwoman' : 'Chairman';
            else if (baseTitle === 'Vice Chairman') baseTitle = isFemaleMember ? 'Vice Chairwoman' : 'Vice Chairman';
            const lastName = name.split(' ').pop();
            return { name, lastName, title: baseTitle };
        }
        const name = memberString;
        const lastName = name.split(' ').pop();
        return { name, lastName, title: null };
    }

    // Get a shortened version of a committee name
    function getShortCommitteeName(fullName) {
        const match = fullName.match(/(\w+)\s+Committee$/);
        return match ? match[1] : fullName;
    }

    // Create a history table row for display
    function createHistoryRow(time, statementText, path, index, isNew = false) {
        const row = document.createElement('tr');
        const visibleTags = path.filter(p => p.step !== 'carryBillPrompt' && p.value !== 'Take the Vote');
        const tagsHtml = visibleTags.map(p => `<span class="token">${p.display || getTagText(p.step, p.value)}</span>`).join(' ');
        let statementHtml = '';
        if (path[0].step === 'testimony') {
            const testimonyDetails = path[0].details;
            let techStatement = statementText;
            let proceduralStatement;
            if (testimonyDetails.isIntroducingBill) {
                proceduralStatement = constructProceduralStatement(time, { ...testimonyDetails, introducingBill: true, title: testimonyDetails.title });
            } else if (testimonyDetails.isSenatorRepresentative) {
                const positionLower = testimonyDetails.position.toLowerCase();
                const positionPhrase = positionLower === "neutral" ? "as neutral" : positionLower;
                const formattedTime = time.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
                proceduralStatement = `${formattedTime} ${testimonyDetails.title} ${testimonyDetails.lastName} testified ${positionPhrase}`;
                if (testimonyDetails.number) {
                    proceduralStatement += ` and submitted testimony #${testimonyDetails.number}`;
                }
            } else {
                proceduralStatement = constructProceduralStatement(time, testimonyDetails);
            }
            const link = testimonyDetails.link || '';
            const memberNo = testimonyDetails.memberNo || '';
            statementHtml = `
                <div class="statement-box tech-clerk" 
                    data-tech-statement="${techStatement.trim()}" 
                    data-link="${link}" 
                    data-memberno="${memberNo}" 
                    data-time="${time.toISOString()}"
                    title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">
                    ${techStatement.trim()}
                </div>
                <div class="statement-box procedural-clerk" title="Copy Procedural Clerk Statement">${proceduralStatement}</div>
            `;
        } else if (path[0].step === 'introducedBill') {
            const memberString = path.find(p => p.step === 'member')?.value || '';
            const memberNo = path.find(p => p.step === 'member')?.memberNo || '';
            const { lastName, title } = parseMember(memberString);
            const techStatement = `${title} ${lastName} - Introduced Bill`;
            const proceduralStatement = constructProceduralStatement(time, { lastName, title, introducingBill: true });
            statementHtml = `
                <div class="statement-box tech-clerk" 
                    data-tech-statement="${techStatement.trim()}" 
                    data-memberno="${memberNo}" 
                    data-time="${time.toISOString()}"
                    title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">
                    ${techStatement.trim()}
                </div>
                <div class="statement-box procedural-clerk" title="Copy Procedural Clerk Statement">${proceduralStatement}</div>
            `;
        } else if (path[0].step === 'member') {
            const techStatement = statementText;
            const proceduralStatement = constructMemberActionProceduralStatement(time, path);
            const memberNo = path.find(p => p.step === 'member')?.memberNo || '';
            const link = '';
            statementHtml = `
                <div class="statement-box tech-clerk" 
                    data-tech-statement="${techStatement.trim()}" 
                    data-link="${link}" 
                    data-memberno="${memberNo}" 
                    data-time="${time.toISOString()}"
                    title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">
                    ${techStatement.trim()}
                </div>
                <div class="statement-box procedural-clerk" title="Copy Procedural Clerk Statement">${proceduralStatement}</div>
            `;
        } else if (path[0].step === 'meetingAction') {
            const techStatement = statementText;
            const proceduralStatement = constructMeetingActionProceduralStatement(time, path);
            const memberPart = path.find(p => p.step === 'memberOptional');
            const memberNo = memberPart ? memberPart.memberNo || '' : '';
            const link = '';
            statementHtml = `
                <div class="statement-box tech-clerk" 
                    data-tech-statement="${techStatement.trim()}" 
                    data-link="${link}" 
                    data-memberno="${memberNo}" 
                    data-time="${time.toISOString()}"
                    title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">
                    ${techStatement.trim()}
                </div>
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
                if (box.classList.contains('tech-clerk') && e.ctrlKey) {
                    performSpecialCopy(box);
                } else {
                    const textToCopy = box.textContent.trim();
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        console.log('Copied to clipboard:', textToCopy);
                        box.classList.add('copied');
                        setTimeout(() => box.classList.remove('copied'), 500);
                    });
                }
            });
        });
        const techClerkBox = row.querySelector('.statement-box.tech-clerk');
        if (techClerkBox) {
            techClerkBox.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                performSpecialCopy(techClerkBox);
            });
        }
        const editIcon = row.querySelector('.edit-icon');
        editIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('Edit button clicked for index:', index);
            editHistoryEntry(index);
        });
        row.querySelector('.delete-icon').onclick = (e) => {
            e.stopPropagation();
            deleteHistoryEntry(index);
        };
        return row;
    }

    // Update the history table with grouped entries by bill
    function updateHistoryTable(newEntry = null) {
        history.sort((a, b) => b.time - a.time);
        historyTableBody.innerHTML = '';
        const groupedHistory = history.reduce((acc, entry) => {
            const billName = entry.bill.name || 'Uncategorized';
            if (!acc[billName]) acc[billName] = [];
            acc[billName].push(entry);
            return acc;
        }, {});
        const billGroupsWithTimes = Object.keys(groupedHistory).map(billName => ({
            billName,
            earliestTime: Math.min(...groupedHistory[billName].map(entry => entry.time.getTime()))
        }));
        billGroupsWithTimes.sort((a, b) => b.earliestTime - a.earliestTime);
        billGroupsWithTimes.forEach(({ billName }) => {
            const firstEntry = groupedHistory[billName][0];
            const billType = firstEntry.bill.type;
            const headerRow = document.createElement('tr');
            headerRow.className = 'bill-header';
            headerRow.innerHTML = `<td colspan="4">${billName} - ${billType} [click to collapse/expand]</td>`;
            headerRow.setAttribute('data-bill-name', billName);
            headerRow.addEventListener('click', () => {
                let nextRow = headerRow.nextElementSibling;
                while (nextRow && !nextRow.classList.contains('bill-header')) {
                    nextRow.style.display = nextRow.style.display === 'none' ? '' : 'none';
                    nextRow = nextRow.nextElementSibling;
                }
            });
            headerRow.addEventListener('dblclick', () => editBillName(headerRow, billName));
            historyTableBody.appendChild(headerRow);
            groupedHistory[billName].forEach((entry) => {
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
                    let specialFormat = `${formattedTime} | ${techStatement} | ${memberNoFormatted} |`;
                    if (link) specialFormat += ` ${link}`;
                    navigator.clipboard.writeText(specialFormat).then(() => {
                        console.log('Automatically copied to clipboard:', specialFormat);
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
        console.log('History table updated with bill grouping sorted by earliest time');
    }

    // Edit the name of a bill in the history table
    function editBillName(headerRow, oldBillName) {
        const firstEntry = history.find(entry => entry.bill.name === oldBillName);
        const oldType = firstEntry ? firstEntry.bill.type : 'Hearing';
        
        // Create input for bill name
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = oldBillName;
        nameInput.style.width = '60%'; // Adjust width to fit alongside select
        
        // Create select dropdown for bill type
        const typeSelect = document.createElement('select');
        const options = ['Hearing', 'Committee Work', 'Conference Committee'];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            if (opt === oldType) option.selected = true;
            typeSelect.appendChild(option);
        });
        typeSelect.style.width = '35%'; // Adjust width
        typeSelect.style.marginLeft = '5px';
        
        // Create a wrapper div to contain editing elements
        const editingWrapper = document.createElement('div');
        editingWrapper.className = 'editing-wrapper';
        editingWrapper.appendChild(nameInput);
        editingWrapper.appendChild(typeSelect);
        
        // Append wrapper to the table cell and clear existing content
        const td = headerRow.querySelector('td');
        td.innerHTML = '';
        td.appendChild(editingWrapper);
        
        // Stop click event propagation from the wrapper
        editingWrapper.addEventListener('click', (e) => e.stopPropagation());
        
        // Focus on the input field
        nameInput.focus();
        
        // Save function to update bill name and type
        const saveNewBill = () => {
            const newBillName = nameInput.value.trim() || 'Uncategorized';
            const newType = typeSelect.value;
            history.forEach(entry => {
                if (entry.bill.name === oldBillName) {
                    entry.bill.name = newBillName;
                    entry.bill.type = newType;
                }
            });
            localStorage.setItem('historyStatements', serializeHistory(history));
            updateHistoryTable();
        };
        
        // Event listeners for saving changes
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveNewBill();
        });
        typeSelect.addEventListener('change', saveNewBill);
    }

    // Delete a history entry
    function deleteHistoryEntry(index) {
        history.splice(index, 1);
        localStorage.setItem('historyStatements', serializeHistory(history));
        updateHistoryTable();
        console.log('Deleted history entry at index:', index);
    }

    // Edit an existing history entry
    function editHistoryEntry(index) {
        const entry = history[index];
        console.log('Editing entry at index:', index, 'entry:', entry);
        path = [...entry.path];
        statementStartTime = entry.time;
        editingIndex = index;
        const firstStep = path[0].step;
        const startingPoint = jsonStructure.startingPoints.find(sp => sp.options.includes(path[0].value) || sp.type === 'voteAction' || sp.type === firstStep);
        if (startingPoint) {
            currentFlow = jsonStructure.flows[startingPoint.flow];
            const initialStepConfig = currentFlow.steps.find(step => step.step === firstStep);
            currentStep = initialStepConfig && initialStepConfig.next ? 
                (typeof initialStepConfig.next === 'string' ? initialStepConfig.next : initialStepConfig.next[path[0].value] || initialStepConfig.next.default) : null;
        } else {
            currentFlow = null;
            currentStep = null;
        }
        path.forEach((part, i) => {
            if (i > 0 && currentFlow) {
                const stepConfig = currentFlow.steps.find(step => step.step === part.step);
                if (stepConfig && stepConfig.next) {
                    currentStep = typeof stepConfig.next === 'string' ? stepConfig.next : stepConfig.next[part.value] || stepConfig.next.default;
                } else {
                    currentStep = null;
                }
            }
        });
        // New logic to set currentStep based on the last part
        if (path.length > 0) {
            const lastPart = path[path.length - 1];
            const stepConfig = currentFlow.steps.find(step => step.step === lastPart.step);
            if (stepConfig) {
                if (stepConfig.type === 'module') {
                    if (lastPart.step === 'voteModule') {
                        const motionType = path.find(p => p.step === 'rollCallBaseMotionType')?.value;
                        currentStep = (motionType === 'Reconsider' || motionType === 'Amendment') ? null : 'carryBillPrompt';
                    } else {
                        currentStep = stepConfig.next;
                    }
                } else if (stepConfig.next) {
                    if (typeof stepConfig.next === 'string') {
                        currentStep = stepConfig.next;
                    } else {
                        currentStep = stepConfig.next[lastPart.value] || stepConfig.next.default;
                    }
                } else {
                    currentStep = null;
                }
            } else {
                currentStep = null;
            }
        }
        console.log('editHistoryEntry - Final state - path:', path, 'currentFlow:', currentFlow, 'currentStep:', currentStep);
        updateInput();
        showSuggestions('');
        if (path.length === 1 && path[0].step === 'testimony') {
            console.log('Testimony entry detected. Path[0]:', path[0]);
            populateTestimonyModal(path[0]);
            openTestimonyModal(null, true);
            editingTestimonyIndex = 0;
        } else {
            console.log('Not a testimony entry. Path:', path);
        }
    }

    // === Legend Management ===

    // Update the member legend with current committee members
    function updateLegend() {
        const memberList = document.getElementById('memberList');
        memberList.innerHTML = '';
        const members = getCommitteeMembers();
        const parsedMembers = members.map(member => ({ original: member, parsed: parseMember(member) }));
        const chairperson = parsedMembers.find(m => m.parsed.title === "Chairwoman" || m.parsed.title === "Chairman");
        const viceChairperson = parsedMembers.find(m => m.parsed.title === "Vice Chairwoman" || m.parsed.title === "Vice Chairman");
        const otherMembers = parsedMembers.filter(m => m !== chairperson && m !== viceChairperson);
        const createLi = (member) => {
            const li = document.createElement('li');
            const displayName = member.parsed.title ? `${member.parsed.title} ${member.parsed.name}` : member.parsed.name;
            li.textContent = displayName;
            li.onclick = () => {
                if (path.length === 0) selectOption(member.original);
                else console.log('Cannot select member while editing existing path');
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
        console.log('Legend updated');
    }

    // Update the meeting actions legend
    function updateMeetingActionsLegend() {
        const meetingActionsList = document.getElementById('meetingActionsList');
        meetingActionsList.innerHTML = '';
        const meetingActions = jsonStructure.startingPoints.find(sp => sp.type === "meetingAction").options;
        meetingActions.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action;
            li.onclick = () => {
                if (path.length === 0) selectOption(action);
                else console.log('Cannot select meeting action while editing existing path');
            };
            meetingActionsList.appendChild(li);
        });
        console.log('Meeting actions legend updated');
    }

    // Update the vote actions legend
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
                    if (path.length === 0) selectOption(action);
                    else console.log('Cannot select vote action while editing existing path');
                };
                voteActionsList.appendChild(li);
            });
            console.log('Vote actions legend updated');
        } else {
            console.warn('No voteAction starting point found in flows.json');
        }
    }

    // Update the external actions legend (e.g., Add Testimony)
    function updateExternalActionsLegend() {
        const externalActionsList = document.getElementById('externalActionsList');
        externalActionsList.innerHTML = '';
        const externalActions = [
            { name: "Introduced Bill", handler: () => selectOption("Introduced Bill") },
            { name: "Add Testimony", handler: () => openTestimonyModal() }
        ];
        externalActions.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action.name;
            li.onclick = () => {
                if (path.length === 0) action.handler();
                else console.log('Cannot perform external action while editing existing path');
            };
            externalActionsList.appendChild(li);
        });
        console.log('External actions legend updated');
    }

    // === Miscellaneous UI Helpers ===

    // Show a custom confirmation dialog
    function showCustomConfirm(message) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10002;';
            const dialog = document.createElement('div');
            dialog.style.cssText = 'background-color: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';
            const messageText = document.createElement('p');
            messageText.textContent = message;
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; justify-content: space-between; margin-top: 10px;';
            const yesButton = document.createElement('button');
            yesButton.textContent = 'Yes';
            yesButton.style.cssText = 'padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;';
            yesButton.onclick = () => {
                document.body.removeChild(modal);
                resolve(true);
            };
            const noButton = document.createElement('button');
            noButton.textContent = 'No';
            noButton.style.cssText = 'padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;';
            noButton.onclick = () => {
                document.body.removeChild(modal);
                resolve(false);
            };
            buttonContainer.appendChild(yesButton);
            buttonContainer.appendChild(noButton);
            dialog.appendChild(messageText);
            dialog.appendChild(buttonContainer);
            modal.appendChild(dialog);
            document.body.appendChild(modal);
        });
    }

    // Show a time editor for adjusting an entry's timestamp
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
        editor.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; z-index: 10002;`;
        document.getElementById('edit-hour').focus();
        document.getElementById('save-time').addEventListener('click', () => {
            let hour = parseInt(document.getElementById('edit-hour').value);
            const period = document.getElementById('edit-period').value;
            if (period === 'PM' && hour < 12) hour += 12;
            else if (period === 'AM' && hour === 12) hour = 0;
            const minute = parseInt(document.getElementById('edit-minute').value);
            const second = parseInt(document.getElementById('edit-second').value);
            const newTime = new Date(entry.time);
            newTime.setHours(hour, minute, second);
            entry.time = newTime;
            history.sort((a, b) => a.time - b.time);
            updateHistoryTable();
            localStorage.setItem('historyStatements', serializeHistory(history));
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

    // === Event Listeners ===

    // Handle input changes in the input div
    inputDiv.addEventListener('input', () => {
        const text = getCurrentText();
        showSuggestions(text);
        tryToTag();
        adjustHistoryLayout();
    });

    // Handle key presses in the input div
    inputDiv.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (range.collapsed && range.startContainer === inputDiv.lastChild && range.startOffset === inputDiv.lastChild.textContent.length && path.length > 0) {
                    e.preventDefault();
                    removeLastTag();
                }
            }
        } else if (e.key === 'Tab' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (modal.classList.contains('active')) {
                const suggestions = modal.querySelectorAll('.option');
                if (suggestions.length > 0) suggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0].click();
            } else if (dropdownActive) {
                const dropdown = document.querySelector('.dropdown');
                if (dropdown) {
                    const options = dropdown.querySelectorAll('.dropdown-option');
                    if (options.length > 0) options[selectedDropdownIndex >= 0 ? selectedDropdownIndex : 0].click();
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
                if (dropdown && selectedDropdownIndex >= 0) dropdown.querySelectorAll('.dropdown-option')[selectedDropdownIndex].click();
            } else if (currentStep && currentFlow.steps.find(step => step.step === currentStep).optional) {
                const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
                currentStep = stepConfig.next;
                updateInput();
                showSuggestions('');
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
                    if (options.length > 0) selectedDropdownIndex = selectedDropdownIndex <= 0 ? -1 : selectedDropdownIndex - 1;
                    updateDropdownHighlight(dropdown);
                }
            } else if (modal.classList.contains('active')) {
                const suggestions = modal.querySelectorAll('.option');
                if (suggestions.length > 0) selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? -1 : selectedSuggestionIndex - 1;
                updateSuggestionHighlight(suggestions);
            }
        } else if (e.key === 'Escape' && dropdownActive) {
            document.dispatchEvent(new MouseEvent('click'));
            e.preventDefault();
        }
    });

    // Focus the input div on load
    inputDiv.focus();

    // Handle clicks on tag chevrons for editing
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

    // Clear history button
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        history = [];
        lastAction = null;
        lastMovedDetail = null;
        lastRereferCommittee = null;
        amendmentPassed = false;
        pendingAmendment = false;
        localStorage.removeItem('historyStatements');
        localStorage.removeItem('lastAction');
        localStorage.removeItem('lastMovedDetail');
        localStorage.removeItem('lastRereferCommittee');
        localStorage.removeItem('amendmentPassed');
        localStorage.removeItem('pendingAmendment');
        updateHistoryTable();
        console.log('History cleared and state variables reset');
    });

    // Submit testimony button
    document.getElementById('submitTestimonyButton').addEventListener('click', submitTestimonyModal);

    // Cancel testimony button
    cancelTestimonyButton.addEventListener('click', closeTestimonyModal);

    // Edit time on double-click in history table
    historyTableBody.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (target.tagName === 'TD' && target.cellIndex === 0) {
            const row = target.closest('tr');
            const indexAttr = row.getAttribute('data-index');
            if (indexAttr !== null) {
                const index = parseInt(indexAttr, 10);
                if (!isNaN(index) && history[index]) {
                    showTimeEditor(history[index], target);
                }
            }
        }
    });

    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('active') && currentFlow && currentStep) {
            const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
            if (stepConfig && stepConfig.type === 'module') {
                if (currentStep === 'voteModule') {
                    const inputFor = document.getElementById('module-for');
                    const inputAgainst = document.getElementById('module-against');
                    const inputNeutral = document.getElementById('module-neutral');
                    if (inputFor && inputAgainst && inputNeutral) {
                        let targetInput;
                        if (e.key === '1') targetInput = inputFor;
                        else if (e.key === '2') targetInput = inputAgainst;
                        else if (e.key === '3') targetInput = inputNeutral;
                        if (targetInput) {
                            e.preventDefault();
                            const currentValue = parseInt(targetInput.value, 10) || 0;
                            if (e.ctrlKey) {
                                if (currentValue > 0) targetInput.value = currentValue - 1;
                            } else {
                                targetInput.value = currentValue + 1;
                            }
                        }
                    }
                }
                if (e.key === 'Tab' && currentStep !== 'lcNumber') {
                    e.preventDefault();
                    const submitButton = document.getElementById('module-submit');
                    if (submitButton) {
                        submitButton.click();
                    }
                }
            }
        }
    });

    // Mark time with backtick key
    document.addEventListener('keydown', (e) => {
        if (e.key === '`') {
            console.log('Backtick key pressed');
            e.preventDefault();
            const pageWrapper = document.querySelector('.page-wrapper');
            if (!pageWrapper) {
                console.error('Error: .page-wrapper not found');
                return;
            }
            markedTime = markedTime ? null : new Date();
            pageWrapper.classList.toggle('marking-time', !!markedTime);
            console.log('Marking time toggled - markedTime is now:', markedTime ? 'true' : 'false', 'value:', markedTime);
        }
    });

    // Set current bill
    document.getElementById('setBillBtn').addEventListener('click', () => {
        const billInput = document.getElementById('billInput').value.trim();
        currentBill = billInput || 'Uncategorized';
        localStorage.setItem('currentBill', currentBill);
        document.getElementById('currentBillDisplay').textContent = 'Current Bill: ' + currentBill;
        console.log('Current bill set to:', currentBill);
    });

    // Committee selection change
    committeeSelect.addEventListener('change', () => {
        currentCommittee = committeeSelect.value;
        localStorage.setItem('selectedCommittee', currentCommittee);
        updateLegend();
        console.log('Committee changed to:', currentCommittee);
    });

    // Bill type radio button change
    document.querySelectorAll('input[name="billType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            currentBillType = document.querySelector('input[name="billType"]:checked').value;
            localStorage.setItem('billType', currentBillType);
            console.log('Bill type changed to:', currentBillType);
        });
    });

    // Handle messages from extensions
    window.addEventListener("message", function (event) {
        console.log('Message received:', event.data);
        if (event.source !== window || !event.data || event.data.source !== "CLERK_EXTENSION") return;
        if (event.data.type === "HEARING_STATEMENT") {
            console.log('HEARING_STATEMENT received:', event.data.payload);
            const payload = event.data.payload;
            if (typeof payload === 'object' && payload.testimonyNo) {
                console.log('Processing testimony payload:', payload);
                openTestimonyModal(payload);
            } else {
                console.log('Adding custom statement:', payload);
                const startTime = new Date();
                const statementText = String(payload);
                const path = [{ step: 'custom', value: statementText }];
                history.push({ time: startTime, path: path, text: statementText });
                const row = createHistoryRow(startTime, statementText, path, history.length - 1);
                historyTableBody.insertBefore(row, historyTableBody.firstChild);
                localStorage.setItem('historyStatements', serializeHistory(history));
            }
        }
    });

    // Window resize handling
    window.addEventListener('resize', adjustHistoryLayout);
    inputDiv.addEventListener('input', adjustHistoryLayout);

    // Initialize legends and layout
    updateMeetingActionsLegend();
    updateVoteActionsLegend();
    updateExternalActionsLegend();
    updateLegend();
    adjustHistoryLayout();
});