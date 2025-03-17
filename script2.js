// JSON structure defining flows and options
const jsonStructure = {
    "startingPoints": [
        { "type": "member", "options": "committeeMembers", "flow": "committeeMemberFlow" },
        { "type": "meetingAction", "options": ["Closed Hearing", "Recessed Meeting", "Adjourned Meeting", "Reconvened Meeting"], "flow": "meetingActionFlow" },
        { "type": "voteAction", "options": ["Roll Call Vote", "Voice Vote", "Motion Failed"], "flow": "voteActionFlow" }
    ],
    "flows": {
        "committeeMemberFlow": {
            "steps": [
                { "step": "member", "type": "select", "options": "committeeMembers", "next": "action" },
                { "step": "action", "type": "select", "options": ["Moved", "Seconded", "Withdrew", "Proposed Amendment", "Introduced Bill"], "next": { "Moved": "movedDetail", "Proposed Amendment": "amendmentModule", "default": null } },
                { "step": "movedDetail", "type": "select", "options": ["Do Pass", "Do Not Pass", "Amendment", "Reconsider", "Without Committee Recommendation"], "next": { "Do Pass": "rereferOptional", "Do Not Pass": "rereferOptional", "default": null } },
                { "step": "rereferOptional", "type": "select", "options": "otherCommittees", "optional": true, "next": null }
            ]
        },
        "meetingActionFlow": {
            "steps": [
                { "step": "action", "type": "select", "options": ["Closed Hearing", "Recessed Meeting", "Adjourned Meeting", "Reconvened Meeting"], "next": "memberOptional" },
                { "step": "memberOptional", "type": "select", "options": "committeeMembers", "optional": true, "next": null }
            ]
        },
        "voteActionFlow": {
            "steps": [
                { "step": "voteType", "type": "select", "options": ["Roll Call Vote", "Voice Vote", "Motion Failed"], "next": { "Roll Call Vote": "rollCallMotionType", "Voice Vote": "voiceVoteOn", "Motion Failed": "motionFailedReason" } },
                { "step": "rollCallMotionType", "type": "select", "options": "suggestMotionType", "next": "asAmendedOptional" },
                { "step": "asAmendedOptional", "type": "select", "options": ["as Amended"], "optional": true, "next": "voteModule" },
                { "step": "voteModule", "type": "module", "fields": [
                    { "name": "for", "type": "number" },
                    { "name": "against", "type": "number" },
                    { "name": "outcome", "type": "select", "options": ["Passed", "Failed"] }
                ], "next": { "outcome": { "Passed": "billCarrier", "Failed": null } } },
                { "step": "billCarrier", "type": "select", "options": "committeeMembers", "next": null },
                { "step": "voiceVoteOn", "type": "select", "options": ["Amendment", "Reconsider"], "next": "voiceVoteOutcome" },
                { "step": "voiceVoteOutcome", "type": "select", "options": ["Passed", "Failed"], "next": null },
                { "step": "motionFailedReason", "type": "select", "options": "suggestFailedReason", "next": null }
            ]
        }
    }
};

// Mock data for dynamic options
const committeeMembers = ["Chairwoman Diane Larson", "Vice Chairman Bob Paulson", "Senator Ryan Braunberger"];
const otherCommittees = ["Senate Appropriations", "Senate Finance"];
const suggestMotionType = () => ["Do Pass", "Do Not Pass", "Without Committee Recommendation"];
const suggestFailedReason = () => ["for lack of a second"];

// State management
let currentFlow = null;
let currentStep = null;
let statementParts = [];
let moduleData = {};

// DOM elements
const input = document.getElementById('input');
const modal = document.getElementById('modal');
const statementDiv = document.getElementById('statement');

// Handle user input
input.addEventListener('input', () => {
    const value = input.value.trim().toLowerCase();
    if (!currentFlow) {
        // Suggest starting points
        const suggestions = jsonStructure.startingPoints.filter(sp => 
            sp.type.toLowerCase().includes(value) || 
            (typeof sp.options === 'string' && sp.options.toLowerCase().includes(value)) ||
            (Array.isArray(sp.options) && sp.options.some(opt => opt.toLowerCase().includes(value)))
        );
        displaySuggestions(suggestions, 'startingPoint');
    } else {
        // Suggest options for current step
        const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
        if (stepConfig) {
            let options = getOptions(stepConfig.options);
            if (stepConfig.type === 'module') {
                handleModule(stepConfig);
                return;
            }
            if (value) {
                options = options.filter(opt => opt.toLowerCase().includes(value));
            }
            displaySuggestions(options, stepConfig.step);
        }
    }
});

// Get options based on configuration
function getOptions(optionConfig) {
    if (typeof optionConfig === 'string') {
        switch (optionConfig) {
            case 'committeeMembers': return committeeMembers;
            case 'otherCommittees': return otherCommittees;
            case 'suggestMotionType': return suggestMotionType();
            case 'suggestFailedReason': return suggestFailedReason();
            default: return [];
        }
    } else if (Array.isArray(optionConfig)) {
        return optionConfig;
    }
    return [];
}

// Display suggestions in modal
function displaySuggestions(suggestions, stepType) {
    modal.innerHTML = '';
    if (suggestions.length > 0) {
        suggestions.forEach((suggestion, index) => {
            const div = document.createElement('div');
            div.className = 'option';
            div.textContent = `${index + 1}. ${typeof suggestion === 'object' ? suggestion.type : suggestion}`;
            div.addEventListener('click', () => selectOption(suggestion, stepType));
            modal.appendChild(div);
        });
        modal.classList.add('active');
    } else {
        modal.classList.remove('active');
    }
}

// Handle option selection
function selectOption(option, stepType) {
    if (stepType === 'startingPoint') {
        const startingPoint = jsonStructure.startingPoints.find(sp => sp.type === option.type);
        currentFlow = jsonStructure.flows[startingPoint.flow];
        currentStep = currentFlow.steps[0].step;
        statementParts.push(option.type);
    } else {
        statementParts.push(option);
        const stepConfig = currentFlow.steps.find(step => step.step === currentStep);
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
    updateStatement();
    input.value = '';
    modal.classList.remove('active');
}

// Update statement display
function updateStatement() {
    statementDiv.innerHTML = '';
    statementParts.forEach(part => {
        const token = document.createElement('span');
        token.className = 'token';
        token.textContent = part;
        statementDiv.appendChild(token);
    });
    if (!currentStep) {
        const checkmark = document.createElement('span');
        checkmark.textContent = ' ✓';
        checkmark.style.color = 'green';
        statementDiv.appendChild(checkmark);
    }
}

// Basic module handling (for voteModule as an example)
function handleModule(stepConfig) {
    modal.innerHTML = '';
    modal.classList.add('active');
    stepConfig.fields.forEach(field => {
        const label = document.createElement('label');
        label.textContent = `${field.name}: `;
        const inputField = document.createElement('input');
        inputField.type = field.type === 'number' ? 'number' : 'text';
        if (field.options) {
            inputField.remove();
            const select = document.createElement('select');
            field.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                select.appendChild(option);
            });
            label.appendChild(select);
        } else {
            label.appendChild(inputField);
        }
        modal.appendChild(label);
        modal.appendChild(document.createElement('br'));
    });
    const submit = document.createElement('button');
    submit.textContent = 'Submit';
    submit.addEventListener('click', () => {
        const inputs = modal.querySelectorAll('input, select');
        let moduleResult = {};
        inputs.forEach((inp, idx) => {
            moduleResult[stepConfig.fields[idx].name] = inp.value;
        });
        statementParts.push(JSON.stringify(moduleResult));
        currentStep = stepConfig.next ? (stepConfig.next.outcome ? stepConfig.next.outcome[moduleResult.outcome] : stepConfig.next) : null;
        updateStatement();
        modal.classList.remove('active');
        input.value = '';
    });
    modal.appendChild(submit);
}