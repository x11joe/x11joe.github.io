class CommitteeAction {
    constructor(type, value = null) {
        this.type = type;
        this.value = value;
        this.children = [];
        this.parent = null;
    }

    getOptions() {
        switch (this.type) {
            case "voteType":
                return ["Roll Call Vote", "Voice Vote"];
            case "rollCallBaseMotionType":
                return ["Do Pass", "Do Not Pass"];
            case "carryBillPrompt":
                return ["X Carried the Bill", "No Carrier"];
            case "billCarrierOptional":
                return ["Senator Doe", "Representative Smith"];
            default:
                return [];
        }
    }

    getNextActionTypes() {
        if (this.type === "voteType" && this.value === "Roll Call Vote") {
            return ["rollCallBaseMotionType"];
        } else if (this.type === "rollCallBaseMotionType") {
            return ["voteModule"];
        } else if (this.type === "voteModule") {
            return ["carryBillPrompt"];
        } else if (this.type === "carryBillPrompt" && this.value === "X Carried the Bill") {
            return ["billCarrierOptional"];
        }
        return [];
    }

    addChild(action) {
        action.parent = this;
        this.children.push(action);
    }

    isModule() {
        return false;
    }

    toJSON() {
        return {
            type: this.type,
            value: this.value,
            children: this.children.map(child => child.toJSON())
        };
    }
}

class VoteAction extends CommitteeAction {
    constructor() {
        super("voteModule");
        this.votes = { for: 0, against: 0, neutral: 0 };
    }

    isModule() {
        return true;
    }

    renderForm() {
        return `
            <div>
                <label>For: <input type="number" name="for" min="0" /></label>
                <label>Against: <input type="number" name="against" min="0" /></label>
                <label>Neutral: <input type="number" name="neutral" min="0" /></label>
                <button>Submit Vote</button>
            </div>
        `;
    }

    submitForm(data) {
        this.votes.for = parseInt(data.forCount, 10) || 0;
        this.votes.against = parseInt(data.againstCount, 10) || 0;
        this.votes.neutral = parseInt(data.neutralCount, 10) || 0;
    }
}