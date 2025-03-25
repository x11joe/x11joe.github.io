// Factory function to create actions
function createAction(type) {
    if (type === "voteModule") {
        return new VoteAction();
    } else {
        return new CommitteeAction(type);
    }
}

// Initialize the root action and current leaf
let rootAction = createAction("voteType");
let currentLeaf = rootAction;

// Render the current path
function renderPath() {
    let path = [];
    let node = currentLeaf;
    while (node) {
        path.unshift(node.value || node.type);
        node = node.parent;
    }
    document.getElementById("pathDisplay").textContent = path.join(" - ");
}

// Display options for the current action
function showOptions() {
    let options = currentLeaf.getOptions();
    let optionsList = document.getElementById("optionsList");
    optionsList.innerHTML = "";
    options.forEach(option => {
        let li = document.createElement("li");
        li.textContent = option;
        li.onclick = () => selectOption(option);
        optionsList.appendChild(li);
    });
    document.getElementById("moduleForm").innerHTML = "";
}

// Handle option selection
function selectOption(option) {
    currentLeaf.value = option;
    let nextTypes = currentLeaf.getNextActionTypes();
    if (nextTypes.length > 0) {
        let nextType = nextTypes[0];
        let newAction = createAction(nextType);
        currentLeaf.addChild(newAction);
        currentLeaf = newAction;
        showNextStep();
    } else {
        console.log("Statement complete:", JSON.stringify(rootAction.toJSON(), null, 2));
    }
    renderPath();
}

// Show the next step (options or module form)
function showNextStep() {
    if (currentLeaf.isModule()) {
        let moduleForm = document.getElementById("moduleForm");
        moduleForm.innerHTML = currentLeaf.renderForm();
        let submitButton = moduleForm.querySelector("button");
        submitButton.onclick = () => {
            let forCount = moduleForm.querySelector('input[name="for"]').value;
            let againstCount = moduleForm.querySelector('input[name="against"]').value;
            let neutralCount = moduleForm.querySelector('input[name="neutral"]').value;
            currentLeaf.submitForm({ forCount, againstCount, neutralCount });
            let nextTypes = currentLeaf.getNextActionTypes();
            if (nextTypes.length > 0) {
                let nextType = nextTypes[0];
                let newAction = createAction(nextType);
                currentLeaf.addChild(newAction);
                currentLeaf = newAction;
            }
            renderPath();
            showNextStep();
        };
    } else {
        showOptions();
    }
}

// Finalize the statement
document.getElementById("finalizeButton").onclick = () => {
    console.log("Final statement:", JSON.stringify(rootAction.toJSON(), null, 2));
    alert("Statement finalized! Check the console for the JSON output.");
};

// Initial render
renderPath();
showNextStep();