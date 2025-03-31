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
     * For testimony tokens, if an "introducingBill" flag is set, the text is modified accordingly.
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
            let techText = `${memberTitle} ${lastName} ${action}`;
            for (let i = 3; i < tokens.length; i++) {
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
        } else if (tokens[0] === 'Testimony' && tokens[1] && tokens[1].startsWith('{')) {
            try {
                const data = JSON.parse(tokens[1]);
                let name = `${data.firstName} ${data.lastName}`;
                if (data.isMember) {
                    name = `${data.title} ${data.lastName}`;
                }
                const testimonyPart = data.testimonyNo ? ` - Testimony#${data.testimonyNo}` : '';
                if (data.isMember && data.introducedBill) {
                    return `${name} introduced the bill${testimonyPart}`;
                } else {
                    return `${name} - ${data.position}${testimonyPart}`;
                }
            } catch (e) {
                return 'Invalid testimony data';
            }
        }
        return "";
    }
  
    /**
     * Constructs the procedural clerk text based on the provided tokens and committee selector.
     * For testimony tokens, if an "introducingBill" flag is set, the text is modified accordingly.
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
        } else if (tokens[0] === 'Testimony' && tokens[1] && tokens[1].startsWith('{')) {
            try {
                const data = JSON.parse(tokens[1]);
                let name = `${data.firstName} ${data.lastName}`;
                if (data.isMember) {
                    name = `${data.title} ${data.lastName}`;
                }
                const action = data.isMember && data.introducedBill ? 'introduced the bill' : 'testified';
                const testimonyPart = data.testimonyNo ? ` and submitted testimony#${data.testimonyNo}` : '';
                return `${name} ${action} ${data.position.toLowerCase()}${testimonyPart}`;
            } catch (e) {
                return 'Invalid testimony data';
            }
        }
        return "";
    }
  
  


}