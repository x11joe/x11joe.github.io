let allMembers = []; // Global array to store all members from XML
let markedTime = null; // Global variable to store the marked time

document.addEventListener('DOMContentLoaded', async () => {
    const committees = window.DEFAULT_COMMITTEES || {};
    let currentCommittee = "Senate Judiciary Committee";
    let jsonStructure;
    try {
        const response = await fetch('flows.json');
        jsonStructure = await response.json();
        console.log('flows.json loaded:', jsonStructure);

        // Load and parse allMember.xml
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
    let lastAction = null;
    let lastMovedDetail = null;
    let lastRereferCommittee = null;
    let amendmentPassed = false;
    let editingTestimonyIndex = null; // Track if we're editing a testimony entry
    
    

    const inputDiv = document.getElementById('input');
    const modal = document.getElementById('modal');
    const historyTableBody = document.querySelector('#historyTable tbody');
    const committeeSelect = document.getElementById('committeeSelect');
    const historyDiv = document.getElementById('history');
    const entryWrapper = document.querySelector('.entry-wrapper');
    const submitTestimonyButton = document.getElementById('submitTestimonyButton');

    // **New Variables Added for Testimony Modal**
    const testimonyModal = document.getElementById('testimonyModal');
    const cancelTestimonyButton = document.getElementById('cancelTestimonyButton');

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

    function determineTitle(org) {
        const orgLower = org.toLowerCase();
        if (/house/.test(orgLower)) {
            return "Representative";
        } else if (/senate/.test(orgLower)) {
            return "Senator";
        } else {
            return null;
        }
    }

    function extractLastName(option) {
        const parts = option.split(' - ');
        if (parts.length > 1) {
            // If there's a title like " - Chairman", take the name part
            const namePart = parts[0];
            const nameParts = namePart.split(' ');
            return nameParts[nameParts.length - 1]; // Last word of the name part
        } else {
            // No title, just split the name
            const nameParts = option.split(' ');
            return nameParts[nameParts.length - 1];
        }
    }

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
            console.log('roleLower:', roleLower);
            console.log('organizationLower:', organizationLower);
            console.log('keywordsRegex.test(roleLower):', keywordsRegex.test(roleLower));
            console.log('keywordsRegex.test(organizationLower):', keywordsRegex.test(organizationLower));
            console.log('!testimonyDetails.promptedForSenatorRepresentative:', !testimonyDetails.promptedForSenatorRepresentative);
    
            if ((keywordsRegex.test(roleLower) || keywordsRegex.test(organizationLower)) && !testimonyDetails.promptedForSenatorRepresentative) {
                showCustomConfirm("Is this a senator or representative?").then((isSenRep) => {
                    testimonyDetails.promptedForSenatorRepresentative = true;
    
                    if (isSenRep) {
                        testimonyDetails.isSenatorRepresentative = true;
                        const title = determineTitle(testimonyDetails.organization);
                        if (title) {
                            testimonyDetails.title = title;
                            // Find memberNo for all senators/representatives
                            const firstInitial = testimonyDetails.firstName ? testimonyDetails.firstName.charAt(0) : null;
                            const memberNo = findMemberNo(testimonyDetails.lastName, title, firstInitial);
                            if (memberNo) {
                                testimonyDetails.memberNo = memberNo;
                            } else {
                                console.warn('Could not find memberNo for', title, testimonyDetails.lastName);
                            }
    
                            showCustomConfirm("Are they introducing a bill?").then((isIntroducing) => {
                                testimonyDetails.isIntroducingBill = isIntroducing;
                                const lastName = testimonyDetails.lastName;
    
                                if (isIntroducing) {
                                    // Introducing a bill: standard format
                                    entry.text = `${title} ${lastName} - Introduced Bill - Testimony#${testimonyDetails.number}`;
                                } else {
                                    // Not introducing a bill: custom format with position
                                    entry.text = `${title} ${lastName} - ${testimonyDetails.position} - Testimony#${testimonyDetails.number}`;
                                }
    
                                entry.path[0].value = entry.text;
                                entry.path[0].details = { ...testimonyDetails };
                                localStorage.setItem('historyStatements', serializeHistory(history));
                                resolve();
                            });
                        } else {
                            console.warn('Could not determine title from organization:', testimonyDetails.organization);
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

    function resetTestimonyModal() {
        document.getElementById('testimonyFirstName').value = '';
        document.getElementById('testimonyLastName').value = '';
        document.getElementById('testimonyRole').value = '';
        document.getElementById('testimonyOrganization').value = '';
        document.getElementById('testimonyPosition').value = '';
        document.getElementById('testimonyNumber').value = '';
        document.getElementById('testimonyLink').value = '';
        const formatSelect = document.getElementById('testimonyFormat');
        if (formatSelect) formatSelect.value = 'Written'; // Default to 'Written'
    }

    function serializeHistory(history) {
        return JSON.stringify(history.map(entry => ({
            time: entry.time.toISOString(),
            path: entry.path,
            text: entry.text,
            link: entry.link || ''
        })));
    }

    function deserializeHistory(serialized) {
        const parsed = JSON.parse(serialized);
        return parsed.map(entry => ({
            time: new Date(entry.time),
            path: entry.path,
            text: entry.text,
            link: entry.link || ''
        }));
    }

    const savedHistory = localStorage.getItem('historyStatements');
    if (savedHistory) {
        history = deserializeHistory(savedHistory);
        updateHistoryTable();
        console.log('History loaded from local storage:', history);
    }

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

    function parseMembersFromXML(xmlDoc) {
        const hotKeys = xmlDoc.getElementsByTagName('HotKey');
        const members = [];
        for (let i = 0; i < hotKeys.length; i++) {
            const hotKey = hotKeys[i];
            const nameElem = hotKey.getElementsByTagName('Name')[0];
            const firstNameElem = hotKey.getElementsByTagName('FirstName')[0];
            const fields = hotKey.getElementsByTagName('Fields')[0];
            if (nameElem && fields) { // Removed firstNameElem requirement
                const lastName = nameElem.textContent.trim();
                const firstName = firstNameElem ? firstNameElem.textContent.trim() : '';
                const fullName = firstName ? `${firstName} ${lastName}` : lastName;
                const memberNoField = Array.from(fields.getElementsByTagName('Field')).find(f => f.getElementsByTagName('Key')[0].textContent === 'member-no');
                const memberNo = memberNoField ? memberNoField.getElementsByTagName('Value')[0].textContent.trim() : null;
                // Optionally adjust the title check if needed
                if (memberNo) { // Removed fullName title check for flexibility
                    members.push({ lastName, firstName, fullName, memberNo });
                }
            }
        }
        return members;
    }

    function findMemberNo(lastName, title, firstInitial = null) {
        const candidates = allMembers.filter(member => 
            member.lastName.toLowerCase() === lastName.toLowerCase() &&
            member.firstName.startsWith(title)
        );
        if (candidates.length === 1) {
            return candidates[0].memberNo;
        } else if (candidates.length > 1 && firstInitial) {
            const matchingMember = candidates.find(member => 
                member.firstName.includes(firstInitial + '.')
            );
            return matchingMember ? matchingMember.memberNo : null;
        }
        return null;
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
        } else if (stepConfig.options === "allMembers") {
            options = allMembers.map(member => member.fullName); // Return array of full names
        } else if (stepConfig.options === "suggestMotionType") {
            options = suggestMotionType();
        } else if (stepConfig.options === "suggestFailedReason") {
            options = suggestFailedReason();
        } else if (Array.isArray(stepConfig.options)) {
            options = stepConfig.options;
            if (stepType === 'motionModifiers') {
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
                if (lastRereferCommittee) {
                    options = ['and Rereferred', 'Take the Vote'];
                } else {
                    options = ['Take the Vote', 'and Rereferred'];
                }
            } else if (stepType === 'rollCallBaseMotionType' && lastMovedDetail && options.includes(lastMovedDetail)) {
                options = [lastMovedDetail, ...options.filter(opt => opt !== lastMovedDetail)];
            }
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
            if (currentFlow === jsonStructure.flows.committeeMemberFlow && currentStep === 'action' && lastAction) {
                if (lastAction === 'Moved') {
                    options = ['Seconded', ...options.filter(opt => opt !== 'Seconded')];
                } else if (lastAction === 'Seconded' || lastAction === 'Withdrew') {
                    options = ['Moved', ...options.filter(opt => opt !== 'Moved')];
                }
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

    // Function to construct the Procedural Clerk statement
    function constructProceduralStatement(time, testimonyDetails) {
        const { firstName, lastName, role, organization, position, number, format, introducingBill, title } = testimonyDetails;
        const fullName = `${firstName} ${lastName}`.trim();
        
        // Format time to 12-hour format without seconds (e.g., "4:10 p.m.")
        const hours = time.getHours();
        const minutes = time.getMinutes().toString().padStart(2, '0');
        const period = hours >= 12 ? 'p.m.' : 'a.m.';
        const formattedHours = hours % 12 || 12;
        const formattedTime = `${formattedHours}:${minutes} ${period}`;
        
        let statement;
        
        if (introducingBill && title) {
            statement = `${formattedTime} ${title} ${lastName} introduced the bill`;
            if (number) {
                let positionPhrase;
                if (position === 'Neutral') {
                    positionPhrase = 'as neutral';
                } else {
                    positionPhrase = position.toLowerCase(); // "in favor" or "in opposition"
                }
                statement += ` and submitted testimony ${positionPhrase} #${number}`;
            }
        } else {
            statement = `${formattedTime} ${fullName}`;
            if (format === 'Written') {
                if (organization) statement += `, ${organization}`;
                statement += `, submitted testimony`;
                let positionPhrase;
                if (position === 'Neutral') {
                    positionPhrase = 'as neutral';
                } else {
                    positionPhrase = position.toLowerCase(); // "in favor" or "in opposition"
                }
                statement += ` ${positionPhrase}`;
                if (number) statement += ` #${number}`;
            } else {
                // In-Person or Online
                if (role) statement += `, ${role}`;
                if (organization) statement += `, ${organization}`;
                statement += `, testified`;
                let positionPhrase;
                if (position === 'Neutral') {
                    positionPhrase = 'as neutral';
                } else {
                    positionPhrase = position.toLowerCase(); // "in favor" or "in opposition"
                }
                statement += ` ${positionPhrase}`;
                if (number) statement += ` and submitted testimony #${number}`;
            }
        }
        
        return statement;
    }

    function constructMemberActionProceduralStatement(time, path) {
        const memberString = path.find(p => p.step === 'member')?.value || '';
        const { lastName, title } = parseMember(memberString);
        const action = path.find(p => p.step === 'action')?.value || '';
        const detail = path.find(p => p.step === 'movedDetail')?.value || '';
        const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
        const amendmentText = path.find(p => p.step === 'amendmentModule')?.value || '';
        
        // Format time to 12-hour format without seconds (e.g., "4:10 p.m.")
        const hours = time.getHours();
        const minutes = time.getMinutes().toString().padStart(2, '0');
        const period = hours >= 12 ? 'p.m.' : 'a.m.';
        const formattedHours = hours % 12 || 12;
        const formattedTime = `${formattedHours}:${minutes} ${period}`;
        
        let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
        
        let statement = `${formattedTime} ${memberText}`;
        
        if (action === 'Moved') {
            statement += ` moved ${detail}`;
            if (rerefer) statement += ` and rereferred to ${getShortCommitteeName(rerefer)}`;
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

    // **New Function to Close Testimony Modal**
    function closeTestimonyModal() {
        testimonyModal.classList.remove('active');
        editingTestimonyIndex = null;
        submitTestimonyButton.textContent = 'Add Testimony';
    }

    function populateTestimonyModal(part) {
        setTimeout(() => {
            console.log('populateTestimonyModal called with:', part);
            let testimonyDetails;
            if (part.details) {
                testimonyDetails = part.details;
                console.log('Populating modal with details:', testimonyDetails);
            } else {
                testimonyDetails = parseTestimonyString(part.value);
                console.log('Populating modal with parsed string:', testimonyDetails);
            }
            
            const firstNameInput = document.getElementById('testimonyFirstName');
            const lastNameInput = document.getElementById('testimonyLastName');
            const roleInput = document.getElementById('testimonyRole');
            const organizationInput = document.getElementById('testimonyOrganization');
            const positionSelect = document.getElementById('testimonyPosition');
            const numberInput = document.getElementById('testimonyNumber');
            const linkInput = document.getElementById('testimonyLink');
            const formatSelect = document.getElementById('testimonyFormat');
    
            if (firstNameInput) firstNameInput.value = testimonyDetails.firstName || '';
            if (lastNameInput) lastNameInput.value = testimonyDetails.lastName || '';
            if (roleInput) roleInput.value = testimonyDetails.role || '';
            if (organizationInput) organizationInput.value = testimonyDetails.organization || '';
            if (positionSelect) positionSelect.value = testimonyDetails.position || '';
            if (numberInput) numberInput.value = testimonyDetails.number || '';
            if (linkInput) linkInput.value = testimonyDetails.link || '';
            if (formatSelect) {
                formatSelect.value = testimonyDetails.format || 'Online';
                console.log('Set testimonyFormat to:', formatSelect.value);
            }
        }, 0);
    }

    function showTagOptions(tagElement, stepType, pathIndex) {
        console.log('showTagOptions - stepType:', stepType, 'pathIndex:', pathIndex);
        if (stepType === 'voteModule') {
            const voteResult = JSON.parse(path[pathIndex].value);
            const stepConfig = currentFlow.steps.find(step => step.step === 'voteModule');
            handleModule(stepConfig, voteResult);
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
        console.log('selectOption - option:', option, 'currentStep:', currentStep, 'currentFlow:', currentFlow);
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
                const displayText = constructVoteTagText(moduleResult);
                path.push({ step: currentStep, value: option, display: displayText });
                const motionType = path.find(p => p.step === 'rollCallBaseMotionType')?.value;
                if (motionType === 'Reconsider') {
                    currentStep = null;
                } else {
                    currentStep = 'carryBillPrompt';
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
                    } else if (typeof stepConfig.next === 'object') {
                        currentStep = stepConfig.next[option] || stepConfig.next.default;
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

    function constructVoteTagText(voteResult) {
        const forVotes = voteResult.for || 0;
        const againstVotes = voteResult.against || 0;
        const neutralVotes = voteResult.neutral || 0;
        const outcome = forVotes > againstVotes ? 'Passed' : 'Failed';
        return `Motion ${outcome} ${forVotes}-${againstVotes}-${neutralVotes}`;
    }

    function handleModule(stepConfig, existingVotes = null) {
        console.log('handleModule called for stepConfig:', stepConfig, 'existingVotes:', existingVotes);
        modal.innerHTML = '';
        const form = document.createElement('div');
        form.className = 'vote-form';
        
        const voteCounts = existingVotes ? { ...existingVotes } : { for: 0, against: 0, neutral: 0 };
        
        stepConfig.fields.forEach(field => {
            const container = document.createElement('div');
            const label = document.createElement('label');
            label.textContent = `${field.name}: `;
        
            const decrement = document.createElement('button');
            decrement.textContent = '-';
            decrement.onclick = () => {
                if (voteCounts[field.name] > 0) {
                    voteCounts[field.name]--;
                    input.value = voteCounts[field.name];
                }
            };
        
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `module-${field.name}`;
            input.value = voteCounts[field.name];
            input.min = '0';
            input.onchange = () => {
                voteCounts[field.name] = parseInt(input.value) || 0;
            };
        
            const increment = document.createElement('button');
            increment.textContent = '+';
            increment.onclick = () => {
                voteCounts[field.name]++;
                input.value = voteCounts[field.name];
            };
        
            container.appendChild(label);
            container.appendChild(decrement);
            container.appendChild(input);
            container.appendChild(increment);
            form.appendChild(container);
        });
        
        const submit = document.createElement('button');
        submit.textContent = 'Submit';
        submit.onclick = () => {
            const moduleResult = {};
            stepConfig.fields.forEach(field => {
                moduleResult[field.name] = voteCounts[field.name];
            });
            const resultStr = JSON.stringify(moduleResult);
            if (currentStep === 'voteModule') {
                selectOption(resultStr);
            } else {
                const voteIndex = path.findIndex(p => p.step === 'voteModule');
                if (voteIndex !== -1) {
                    path[voteIndex].value = resultStr;
                    path[voteIndex].display = constructVoteTagText(moduleResult);
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
        console.log('Vote module modal should now be visible');
    }

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
        const options = getCurrentOptions();
        if (currentStep === 'voteModule') {
            console.log('Attempting to show voteModule');
            const stepConfig = currentFlow.steps.find(step => step.step === 'voteModule');
            if (stepConfig) {
                console.log('Found voteModule stepConfig:', stepConfig);
                handleModule(stepConfig, null);
            } else {
                console.error('voteModule step config not found in currentFlow:', currentFlow);
            }
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
                const firstValue = path[0].value;
                const startingPoint = jsonStructure.startingPoints.find(sp => {
                    if (sp.options === "committeeMembers") {
                        return getCommitteeMembers().includes(firstValue);
                    } else if (Array.isArray(sp.options)) {
                        return sp.options.includes(firstValue);
                    }
                    return false;
                });
                if (startingPoint) {
                    currentFlow = jsonStructure.flows[startingPoint.flow];
                    console.log('currentFlow set to:', startingPoint.flow);
                    const lastPart = path[path.length - 1];
                    const stepConfig = currentFlow.steps.find(step => step.step === lastPart.step);
                    if (stepConfig && stepConfig.next) {
                        if (typeof stepConfig.next === 'string') {
                            currentStep = stepConfig.next;
                        } else if (typeof stepConfig.next === 'object') {
                            currentStep = stepConfig.next[lastPart.value] || stepConfig.next.default || null;
                        }
                        console.log('currentStep set to:', currentStep);
                    } else {
                        currentStep = null;
                        console.log('No next step found, currentStep set to null');
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

    function finalizeStatement() {
        if (path.length === 0) return;
        
        const statementText = constructStatementText(path);
        
        if (currentFlow === jsonStructure.flows.committeeMemberFlow) {
            const actionPart = path.find(p => p.step === 'action');
            if (actionPart) {
                lastAction = actionPart.value;
                console.log('Updated lastAction to:', lastAction);
                if (lastAction === 'Moved') {
                    const detailPart = path.find(p => p.step === 'movedDetail');
                    if (detailPart) {
                        lastMovedDetail = detailPart.value;
                        console.log('Updated lastMovedDetail to:', lastMovedDetail);
                    }
                    const rereferPart = path.find(p => p.step === 'rereferOptional');
                    if (rereferPart) {
                        lastRereferCommittee = rereferPart.value;
                        console.log('Updated lastRereferCommittee to:', lastRereferCommittee);
                    } else {
                        lastRereferCommittee = null;
                    }
                }
            }
        } else if (currentFlow === jsonStructure.flows.voteActionFlow) {
            const voteType = path.find(p => p.step === 'voteType')?.value;
            if (voteType === 'Voice Vote') {
                const onWhat = path.find(p => p.step === 'voiceVoteOn')?.value;
                const outcome = path.find(p => p.step === 'voiceVoteOutcome')?.value;
                if (onWhat === 'Amendment' && outcome === 'Passed') {
                    amendmentPassed = true;
                    console.log('Amendment passed, setting amendmentPassed to true');
                }
            }
        }
        
        const startTime = markedTime || statementStartTime || new Date();
        console.log('Finalizing statement with time:', startTime); // Debug log
        if (markedTime) {
            markedTime = null;
            document.querySelector('.page-wrapper').classList.remove('marking-time');
            console.log('Used markedTime for event, reset marking');
        }
        
        if (editingIndex !== null) {
            history[editingIndex] = { time: startTime, path: [...path], text: statementText, link: history[editingIndex].link || '' };
            console.log('Edited history entry at index', editingIndex, ':', history[editingIndex]);
            if (path[0].step === 'testimony') {
                handleTestimonyPrompts(editingIndex).then(() => {
                    updateHistoryTable();
                });
            } else {
                updateHistoryTable();
            }
        } else {
            history.push({ time: startTime, path: [...path], text: statementText, link: '' });
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
                    if (modifiers.includes('as Amended')) {
                        motionText += ' as Amended';
                    }
                    if (modifiers.includes('and Rereferred')) {
                        if (rereferCommittee) {
                            motionText += ` and Rereferred to ${getShortCommitteeName(rereferCommittee)}`;
                        } else {
                            motionText += ' and Rereferred';
                        }
                    }
                    text = `Roll Call Vote on ${motionText} - Motion ${outcome} ${forVotes}-${againstVotes}-${neutralVotes}`;
                    if (billCarrier && path.find(p => p.step === 'carryBillPrompt')?.value === 'X Carried the Bill') {
                        const { lastName, title } = parseMember(billCarrier);
                        const memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
                        text += ` - ${memberText} Carried the Bill`;
                    }
                } else {
                    text = `Roll Call Vote on ${baseMotionType}`;
                    if (modifiers.includes('as Amended')) {
                        text += ' as Amended';
                    }
                    if (modifiers.includes('and Rereferred')) {
                        if (rereferCommittee) {
                            text += ` and Rereferred to ${getShortCommitteeName(rereferCommittee)}`;
                        } else {
                            text += ' and Rereferred';
                        }
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
            const detail = path.find(p => p.step === 'movedDetail')?.value || '';
            const rerefer = path.find(p => p.step === 'rereferOptional')?.value || '';
            let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
            let text = `${memberText} - ${action}`;
            if (detail) text += ` ${detail}`;
            if (rerefer) text += ` and Rereferred to ${getShortCommitteeName(rerefer)}`;
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
        } else if (flowType === 'introducedBill') {
            const memberString = path.find(p => p.step === 'member')?.value || '';
            const { lastName, title } = parseMember(memberString);
            let memberText = title ? `${title} ${lastName}` : `${isSenateCommittee(currentCommittee) ? 'Senator' : 'Representative'} ${lastName}`;
            return `${memberText} - Introduced Bill`;
        }
        return path.map(p => p.value).join(' - ');
    }

    function getShortCommitteeName(fullName) {
        const match = fullName.match(/(\w+)\s+Committee$/);
        return match ? match[1] : fullName;
    }

    function parseMember(memberString) {
        const titleMatch = memberString.match(/^(Senator|Representative)\s+/);
        if (titleMatch) {
            const title = titleMatch[0].trim();
            const name = memberString.replace(title, '').trim();
            const lastName = name.split(' ').pop();
            return { name, lastName, title };
        } else {
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
    }

    function getTagText(step, value) {
        if (step === 'member' || step === 'memberOptional' || step === 'billCarrierOptional') {
            const { name, title } = parseMember(value);
            return title ? `${title} ${name}` : name;
        }
        return value;
    }

    function createHistoryRow(time, statementText, path, index) {
        const row = document.createElement('tr');
        const visibleTags = path.filter(p => p.step !== 'carryBillPrompt' && p.value !== 'Take the Vote');
        const tagsHtml = visibleTags.map(p => `<span class="token">${p.display || getTagText(p.step, p.value)}</span>`).join(' ');
        
        let statementHtml = '';
        if (path[0].step === 'testimony') {
            const testimonyDetails = path[0].details;
            let techStatement = statementText; // Set by handleTestimonyPrompts
            let proceduralStatement;
        
            if (testimonyDetails.isIntroducingBill) {
                proceduralStatement = constructProceduralStatement(time, { ...testimonyDetails, introducingBill: true, title: testimonyDetails.title });
            } else if (testimonyDetails.isSenatorRepresentative) {
                const positionLower = testimonyDetails.position.toLowerCase();
                const formattedTime = time.toLocaleTimeString('en-US', { hour12: true, hour: 'numeric', minute: '2-digit' });
                proceduralStatement = `${formattedTime} ${testimonyDetails.title} ${testimonyDetails.lastName} testified in ${positionLower} and submitted testimony #${testimonyDetails.number}`;
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
                     title="Copy Tech Clerk Statement (Ctrl+Click for Special Format)">
                    ${techStatement.trim()}
                </div>
                <div class="statement-box procedural-clerk" title="Copy Procedural Clerk Statement">${proceduralStatement}</div>
            `;
        } else if (path[0].step === 'member') {
            const techStatement = statementText; // e.g., "Senator Boehm - Moved Do Pass"
            const proceduralStatement = constructMemberActionProceduralStatement(time, path);
            const memberNo = path.find(p => p.step === 'member')?.memberNo || '';
            const link = ''; // No link for committee member actions
            statementHtml = `
                <div class="statement-box tech-clerk" 
                     data-tech-statement="${techStatement.trim()}" 
                     data-link="${link}" 
                     data-memberno="${memberNo}" 
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
        row.setAttribute('data-index', index); // Add data-index to the row for time editing
        
        const statementBoxes = row.querySelectorAll('.statement-box');
        statementBoxes.forEach(box => {
            box.addEventListener('click', (e) => {
                e.stopPropagation();
                let textToCopy;
                if (box.classList.contains('tech-clerk') && e.ctrlKey) {
                    const techStatement = box.getAttribute('data-tech-statement');
                    const link = box.getAttribute('data-link') || '';
                    const memberNo = box.getAttribute('data-memberno') || '';
                    const formattedTime = time.toLocaleTimeString('en-US', {
                        hour12: true,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    let memberNoFormatted = memberNo ? `member-no:${memberNo};Mic:` : '';
                    let specialFormat = `${formattedTime} | ${techStatement} | ${memberNoFormatted} |`;
                    if (link) {
                        specialFormat += ` ${link}`;
                    }
                    textToCopy = specialFormat;
                    box.classList.add('special-copied');
                    setTimeout(() => box.classList.remove('special-copied'), 500);
                } else {
                    textToCopy = box.textContent.trim(); // Ensure no extra whitespace
                    box.classList.add('copied');
                    setTimeout(() => box.classList.remove('copied'), 500);
                }
                navigator.clipboard.writeText(textToCopy).then(() => {
                    console.log('Copied to clipboard:', textToCopy);
                });
            });
        });
        
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

    function showCustomConfirm(message) {
        return new Promise((resolve) => {
            // Create modal elements
            const modal = document.createElement('div');
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.zIndex = '10002';
    
            const dialog = document.createElement('div');
            dialog.style.backgroundColor = 'white';
            dialog.style.padding = '20px';
            dialog.style.borderRadius = '5px';
            dialog.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    
            const messageText = document.createElement('p');
            messageText.textContent = message;
            dialog.appendChild(messageText);
    
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.justifyContent = 'space-between';
            buttonContainer.style.marginTop = '10px';
    
            const yesButton = document.createElement('button');
            yesButton.textContent = 'Yes';
            yesButton.style.padding = '5px 10px';
            yesButton.style.backgroundColor = '#007bff';
            yesButton.style.color = 'white';
            yesButton.style.border = 'none';
            yesButton.style.borderRadius = '4px';
            yesButton.style.cursor = 'pointer';
            yesButton.onclick = () => {
                document.body.removeChild(modal);
                resolve(true);
            };
    
            const noButton = document.createElement('button');
            noButton.textContent = 'No';
            noButton.style.padding = '5px 10px';
            noButton.style.backgroundColor = '#dc3545';
            noButton.style.color = 'white';
            noButton.style.border = 'none';
            noButton.style.borderRadius = '4px';
            noButton.style.cursor = 'pointer';
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

    function deleteHistoryEntry(index) {
        history.splice(index, 1);
        localStorage.setItem('historyStatements', serializeHistory(history));
        updateHistoryTable();
        console.log('Deleted history entry at index:', index);
    }

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
            if (initialStepConfig && initialStepConfig.next) {
                currentStep = typeof initialStepConfig.next === 'string' ? initialStepConfig.next : initialStepConfig.next[path[0].value] || initialStepConfig.next.default;
            } else {
                currentStep = null;
            }
        } else {
            currentFlow = null;
            currentStep = null;
        }
    
        path.forEach((part, i) => {
            if (i > 0 && currentFlow) {
                const stepConfig = currentFlow.steps.find(step => step.step === part.step);
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
                if (path.length === 0) {
                    action.handler();
                } else {
                    console.log('Cannot perform external action while editing existing path');
                }
            };
            externalActionsList.appendChild(li);
        });
        console.log('External actions legend updated');
    }

    function mapFormat(format) {
        if (format && format.includes('In-Person')) return 'In-Person';
        if (format && format.includes('Online')) return 'Online';
        return 'Written';
    }

    function openTestimonyModal(testimonyDetails = null, isEditing = false) {
        console.log('openTestimonyModal called, isEditing:', isEditing);
        if (isEditing) {
            submitTestimonyButton.textContent = 'Save Testimony';
        } else {
            submitTestimonyButton.textContent = 'Add Testimony';
        }
        if (testimonyDetails) {
            const nameParts = testimonyDetails.name ? testimonyDetails.name.split(', ').map(s => s.trim()) : [];
            const lastName = nameParts[0] || '';
            const firstName = nameParts.slice(1).join(', ') || '';
            setTimeout(() => {
                const firstNameInput = document.getElementById('testimonyFirstName');
                const lastNameInput = document.getElementById('testimonyLastName');
                const roleInput = document.getElementById('testimonyRole');
                const organizationInput = document.getElementById('testimonyOrganization');
                const positionSelect = document.getElementById('testimonyPosition');
                const numberInput = document.getElementById('testimonyNumber');
                const linkInput = document.getElementById('testimonyLink');
                const formatSelect = document.getElementById('testimonyFormat');
    
                if (firstNameInput) firstNameInput.value = firstName;
                if (lastNameInput) lastNameInput.value = lastName;
                if (roleInput) roleInput.value = testimonyDetails.role || '';
                if (organizationInput) organizationInput.value = testimonyDetails.org || '';
                if (positionSelect) positionSelect.value = testimonyDetails.position || '';
                if (numberInput) numberInput.value = testimonyDetails.testimonyNo || '';
                if (linkInput) linkInput.value = testimonyDetails.link || '';
                if (formatSelect) {
                    const mappedFormat = mapFormat(testimonyDetails.format);
                    formatSelect.value = mappedFormat;
                }
            }, 0);
        } else if (!isEditing) {
            resetTestimonyModal();
        }
        testimonyModal.classList.add('active');
        console.log('Modal opened, isEditing:', isEditing, 'button text:', submitTestimonyButton.textContent);
    }

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
        if (firstName || lastName) {
            parts.push(`${firstName} ${lastName}`.trim());
        }
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
            closeTestimonyModal();
            if (editingIndex !== null) {
                finalizeStatement();
            } else {
                updateInput();
                showSuggestions('');
            }
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
            console.log('Adding testimony with time:', startTime); // Debug log
            if (markedTime) {
                markedTime = null;
                document.querySelector('.page-wrapper').classList.remove('marking-time');
                console.log('Used markedTime for testimony, reset marking');
            }
            const pathEntry = { step: 'testimony', value: testimonyString, details: testimonyObject };
            history.push({ time: startTime, path: [pathEntry], text: testimonyString, link: link });
            const index = history.length - 1;
            console.log('Submitting testimony with details:', testimonyObject);
            handleTestimonyPrompts(index).then(() => {
                const row = createHistoryRow(startTime, history[index].text, history[index].path, index);
                historyTableBody.insertBefore(row, historyTableBody.firstChild);
                localStorage.setItem('historyStatements', serializeHistory(history));
                console.log('Added testimony to history:', history[index].text);
                closeTestimonyModal();
            });
        }
    }

    function parseTestimonyString(str) {
        const parts = str.split(' - ').map(p => p.trim());
        let testimonyDetails = {};
        // Find position index (In Favor, In Opposition, Neutral)
        const positionIndex = parts.findIndex(p => p === 'In Favor' || p === 'In Opposition' || p === 'Neutral');
        if (positionIndex >= 0) {
            testimonyDetails.position = parts[positionIndex];
            // Check for testimony number and format after position
            if (positionIndex + 1 < parts.length && parts[positionIndex + 1].startsWith('Testimony#')) {
                testimonyDetails.number = parts[positionIndex + 1].replace('Testimony#', '');
                if (positionIndex + 2 < parts.length) {
                    testimonyDetails.format = parts[positionIndex + 2];
                }
            } else if (positionIndex + 1 < parts.length) {
                testimonyDetails.format = parts[positionIndex + 1];
            }
            // Parse parts before position (name, role, organization)
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
            if (beforeParts.length >= 2) {
                testimonyDetails.role = beforeParts[1];
            }
            if (beforeParts.length >= 3) {
                testimonyDetails.organization = beforeParts[2];
            }
        }
        return testimonyDetails;
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

    // Function to show the time editor UI
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
        editor.style.position = 'absolute';
        editor.style.left = `${rect.left}px`;
        editor.style.top = `${rect.bottom}px`;
        editor.style.zIndex = '10002';

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
        lastAction = null;
        localStorage.removeItem('historyStatements');
        updateHistoryTable();
        console.log('History cleared');
    });

    document.getElementById('submitTestimonyButton').addEventListener('click', submitTestimonyModal);

    // **New Event Listener for Cancel Testimony Button**
    cancelTestimonyButton.addEventListener('click', () => {
        closeTestimonyModal();
    });

    // Add double-click listener for editing time
    historyTableBody.addEventListener('dblclick', (e) => {
        const target = e.target;
        if (target.tagName === 'TD' && target.cellIndex === 0) { // Time cell
            const row = target.closest('tr');
            const index = parseInt(row.getAttribute('data-index'), 10);
            showTimeEditor(history[index], target);
        }
    });

    // Add keydown listener for marking time with tilde (~)
    document.addEventListener('keydown', (e) => {
        console.log('Keydown event detected - code:', e.code, 'key:', e.key, 'shiftKey:', e.shiftKey); // Debug log
        if (e.code === 'Backquote' && e.shiftKey) {
            console.log('Tilde key pressed'); // Debug log
            e.preventDefault();
            const pageWrapper = document.querySelector('.page-wrapper');
            console.log('pageWrapper element:', pageWrapper); // Debug log to ensure element exists
            if (!pageWrapper) {
                console.error('Error: .page-wrapper not found');
                return;
            }
            if (markedTime) {
                markedTime = null;
                pageWrapper.classList.remove('marking-time');
                console.log('Marking time turned off - markedTime:', markedTime);
            } else {
                markedTime = new Date();
                pageWrapper.classList.add('marking-time');
                console.log('Marking time turned on - markedTime:', markedTime);
            }
        }
    });

    updateMeetingActionsLegend();
    updateVoteActionsLegend();
    updateExternalActionsLegend();
    updateLegend();

    adjustHistoryLayout();
    window.addEventListener('resize', adjustHistoryLayout);
    inputDiv.addEventListener('input', adjustHistoryLayout);

    window.addEventListener("message", function (event) {
        console.log('Message received:', event.data);
        if (event.source !== window) return;
        if (!event.data || event.data.source !== "CLERK_EXTENSION") return;
        if (event.data.type === "HEARING_STATEMENT") {
            console.log('HEARING_STATEMENT received:', event.data.payload);
            const payload = event.data.payload;
            console.log('Raw payload type and value:', typeof payload, payload);
    
            // Check if payload is an object with testimony properties
            if (typeof payload === 'object' && payload.testimonyNo) {
                console.log('Processing testimony payload:', payload);
                openTestimonyModal(payload); // Pass payload to openTestimonyModal
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
});