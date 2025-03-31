export class TextConstructor {

    /**
     * Constructs the tech clerk text based on the provided tokens and committee selector.
     * Dynamically includes LC# values when present in the token sequence, rendering only the last part of the LC number (e.g., ".12345").
     * @param {Array<string>} tokens - The array of tokens representing the action.
     * @param {CommitteeSelector} committeeSelector - The committee selector instance for member and committee data.
     * @returns {string} The constructed tech clerk text.
     */
    static getTechText(tokens, committeeSelector) {
        if (tokens[0] === "Member Action" && tokens.length >= 3 && committeeSelector.isMemberName(tokens[1])) {
            const memberTitle = committeeSelector.getMemberTitle();
            const lastName = committeeSelector.getLastName(tokens[1]);
            const action = tokens[2];
            if (action === "Seconded" && tokens.length === 3) {
                return `${memberTitle} ${lastName} Seconded`;
            } else if (tokens.length >= 5 && (action === "Introduced" || action === "Proposed") && tokens[3] === "Self" && tokens[4] === "Verbal") {
                return `${memberTitle} ${lastName} ${action} a Verbal Amendment`;
            } else if (tokens.length >= 4) {
                const motion = tokens[3];
                let techText = `${memberTitle} ${lastName} ${action} ${motion}`;
                for (let i = 4; i < tokens.length; i++) {
                    if (tokens[i] === "As Amended") {
                        techText += " as Amended";
                    } else if (tokens[i] === "and Rereferred" && i + 1 < tokens.length) {
                        const committee = tokens[i + 1];
                        const shortenedCommittee = committeeSelector.shortenCommitteeName(committee);
                        techText += ` and Rereferred to ${shortenedCommittee}`;
                        i++;
                    } else if (tokens[i] === "LC#" && i + 1 < tokens.length) {
                        const lcNumber = tokens[i + 1];
                        // Extract only the last part of the LC number after the second period
                        const lcParts = lcNumber.split('.');
                        const lastPart = lcParts.length === 3 ? `.${lcParts[2]}` : lcNumber;
                        techText += ` LC# ${lastPart}`;
                        i++;
                    }
                }
                return techText;
            }
        } else if (tokens[0] === "Meeting Action" && tokens.length === 2) {
            return tokens[1];
        }
        return "";
    }

    /**
     * Constructs the procedural clerk text based on the provided tokens and committee selector.
     * Dynamically includes LC# values when present in the token sequence.
     * @param {Array<string>} tokens - The array of tokens representing the action.
     * @param {CommitteeSelector} committeeSelector - The committee selector instance for member and committee data.
     * @returns {string} The constructed procedural clerk text.
     */
    static getProcedureText(tokens, committeeSelector) {
        if (tokens[0] === "Member Action" && tokens.length >= 3 && committeeSelector.isMemberName(tokens[1])) {
            const memberTitle = committeeSelector.getMemberTitle();
            const lastName = committeeSelector.getLastName(tokens[1]);
            const action = tokens[2].toLowerCase();
            if (action === "seconded" && tokens.length === 3) {
                return `${memberTitle} ${lastName} seconded the motion`;
            } else if (tokens.length >= 5 && (action === "introduced" || action === "proposed") && tokens[3] === "Self" && tokens[4] === "Verbal") {
                return `${memberTitle} ${lastName} ${action} a verbal amendment`;
            } else if (tokens.length >= 4) {
                const motion = tokens[3].toLowerCase();
                let procedureText;
                if (action === "withdrew") {
                    procedureText = `${memberTitle} ${lastName} ${action} the ${motion}`;
                } else {
                    procedureText = `${memberTitle} ${lastName} ${action} a ${motion}`;
                }
                for (let i = 4; i < tokens.length; i++) {
                    if (tokens[i] === "As Amended") {
                        procedureText += " as amended";
                    } else if (tokens[i] === "and Rereferred" && i + 1 < tokens.length) {
                        const committee = tokens[i + 1];
                        const shortenedCommittee = committeeSelector.shortenCommitteeName(committee).toLowerCase();
                        procedureText += ` and rereferred to ${shortenedCommittee}`;
                        i++;
                    } else if (tokens[i] === "LC#" && i + 1 < tokens.length) {
                        const lcNumber = tokens[i + 1];
                        procedureText += ` LC# ${lcNumber}`;
                        i++;
                    }
                }
                return procedureText;
            }
        } else if (tokens[0] === "Meeting Action" && tokens.length === 2) {
            return tokens[1].toLowerCase();
        }
        return "";
    }

    static formatTimeForProcedure(time) {
        const [hours, minutes, seconds, period] = time.split(/[: ]/);
        const hourNum = parseInt(hours, 10);
        const formattedHour = hourNum % 12 || 12;
        const formattedPeriod = period.toLowerCase().replace('m', '.m.');
        return `${formattedHour}:${minutes} ${formattedPeriod}`;
    }
}