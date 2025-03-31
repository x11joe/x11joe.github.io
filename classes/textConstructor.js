export class TextConstructor {

    /**
     * Determines the appropriate article ("a" or "an") based on the first letter of a word.
     * Returns "an" if the word starts with a vowel (a, e, i, o, u), otherwise "a".
     * @param {string} word - The word to evaluate.
     * @returns {string} - The correct article ("a" or "an").
     */
    static getArticle(word) {
        const vowels = ['a', 'e', 'i', 'o', 'u'];
        return vowels.includes(word[0].toLowerCase()) ? 'an' : 'a';
    }

    /**
     * Constructs the tech clerk text based on the provided tokens and committee selector.
     * Dynamically includes LC# values when present in the token sequence, rendering only the last part of the LC number (e.g., ".12345").
     * For testimony tokens, returns a formatted string like:
     * "Jaclyn Hall - North Dakota Association for Justice - In Opposition - Testimony#44431"
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
        } else if (tokens[0] === "Testimony" && tokens.length === 2) {
            try {
                const data = JSON.parse(tokens[1]);
                let parts = [];
                if (data.firstName || data.lastName) {
                    parts.push(`${data.firstName || ""} ${data.lastName || ""}`.trim());
                }
                if (data.role) {
                    parts.push(data.role);
                }
                if (data.organization && data.organization !== "undefined") {
                    parts.push(data.organization);
                }
                if (data.position) {
                    parts.push(data.position);
                }
                if (data.testimonyNo) {
                    parts.push(`Testimony#${data.testimonyNo}`);
                }
                return parts.join(" - ");
            } catch (e) {
                return "Invalid testimony data";
            }
        }
        return "";
    }


    /**
     * Constructs the procedural clerk text based on the provided tokens and committee selector.
     * Uses getArticle to ensure grammatical correctness (e.g., "moved an amendment" instead of "moved a amendment").
     * Handles Testimony tokens by parsing JSON data and constructing a detailed testimony statement.
     * For testimony tokens, if a testimony number is provided the phrase "submitted testimony" is appended;
     * otherwise, for In Person testimony only the "testified" phrase with the position is added.
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
                    procedureText = `${memberTitle} ${lastName} ${action} ${TextConstructor.getArticle(motion)} ${motion}`;
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
        } else if (tokens[0] === "Testimony" && tokens.length === 2) {
            try {
                const testimonyData = JSON.parse(tokens[1]);
                // Build the base string with name and optional role/organization
                let text = `${testimonyData.firstName} ${testimonyData.lastName}`;
                if (testimonyData.role) {
                    text += `, ${testimonyData.role}`;
                }
                if (testimonyData.organization && testimonyData.organization !== "undefined") {
                    text += `, ${testimonyData.organization}`;
                }
                if (testimonyData.format === "In Person") {
                    // Always include the "testified" phrase for In Person testimony
                    text += `, testified ${testimonyData.position.toLowerCase()}`;
                } else {
                    // For non In Person, include "submitted testimony" only if a testimony number exists
                    if (testimonyData.testimonyNo) {
                        text += `, submitted testimony ${testimonyData.position.toLowerCase()}`;
                    }
                }
                // Append the testimony number if it exists
                if (testimonyData.testimonyNo) {
                    text += ` #${testimonyData.testimonyNo}`;
                }
                return text;
            } catch (e) {
                return "Invalid testimony data";
            }
        }
        return "";
    }


}