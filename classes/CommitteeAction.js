class CommitteeAction {
    constructor(type, name, actions = [], value = null) {
        this.type = type;          // e.g., "start", "member"
        this.name = name;          // A label or identifier, e.g., "Start" or "Select Member"
        this.actions = actions;    // Array of possible next CommitteeAction instances
        this.value = value;        // User-entered or selected value, null by default
        this.children = [];        // Array to store the selected path of actions
        this.parent = null;        // Reference to the parent action, null by default
    }

    render() {
        return `<div>Default Render for ${this.name}</div>`;
    }
}