export class TextConstructor {
    static getTechText(tokens, committeeSelector) {
        if (tokens[0] === "Member Action" && tokens.length >= 4 && committeeSelector.isMemberName(tokens[1])) {
            const memberTitle = committeeSelector.getMemberTitle();
            const lastName = committeeSelector.getLastName(tokens[1]);
            const action = tokens[2].toLowerCase();
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
                }
            }
            return techText;
        } else if (tokens[0] === "Meeting Action" && tokens.length === 2) {
            return tokens[1];
        }
        return "";
    }

    static getProcedureText(tokens, committeeSelector) {
        if (tokens[0] === "Member Action" && tokens.length >= 4 && committeeSelector.isMemberName(tokens[1])) {
            const memberTitle = committeeSelector.getMemberTitle();
            const lastName = committeeSelector.getLastName(tokens[1]);
            const action = tokens[2].toLowerCase();
            const motion = tokens[3].toLowerCase();
            let procedureText = `${memberTitle} ${lastName} ${action} a ${motion}`;
            for (let i = 4; i < tokens.length; i++) {
                if (tokens[i] === "As Amended") {
                    procedureText += " as amended";
                } else if (tokens[i] === "and Rereferred" && i + 1 < tokens.length) {
                    const committee = tokens[i + 1];
                    const shortenedCommittee = committeeSelector.shortenCommitteeName(committee).toLowerCase();
                    procedureText += ` and rereferred to ${shortenedCommittee}`;
                    i++;
                }
            }
            return procedureText;
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