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

    // DOM elements
    const inputDiv = document.getElementById('input');
    const modal = document.getElementById('modal');

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

    // Create a tag element
    function createTag(text, type) {
        const span = document.createElement('span');
        span.className = 'token';
        span.textContent = text;
        span.setAttribute('data-type', type);
        span.contentEditable = false;
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
                currentStep = currentFlow.steps[0].step;
                path.push({ step: startingPoint.type, value: option });
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
        updateInput();
        showSuggestions(''); // Show next options immediately
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
        path.forEach(part => {
            const tag = createTag(part.value, part.step);
            inputDiv.appendChild(tag);
        });
        inputDiv.appendChild(document.createTextNode(' '));
        if (!currentStep) {
            const statementText = path.map(p => p.value).join(" - ");
            console.log("Statement completed:", statementText); // Replace with your function if available
            path = [];
            currentFlow = null;
            currentStep = null;
            inputDiv.innerHTML = '';
        }
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
        const modalHeight = modal.scrollHeight || 200; // Use scrollHeight for dynamic content, fallback to 200px
        modal.style.left = `${rect.left + window.scrollX}px`; // Align with input’s left edge
        modal.style.top = `${rect.top - modalHeight - 10 + window.scrollY}px`; // Place above input
        modal.style.width = `${rect.width}px`; // Match input width
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
});