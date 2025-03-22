// utils.js - Utility and helper functions

// Determine title (Senator/Representative) based on organization
function determineTitle(org) {
    const orgLower = org?.toLowerCase() || '';
    if (/house/.test(orgLower)) return "Representative";
    if (/senate/.test(orgLower)) return "Senator";
    return null;
}

// Extract last name from a member string
function extractLastName(option) {
    const parts = option.split(' - ');
    const namePart = parts.length > 1 ? parts[0] : option;
    const nameParts = namePart.split(' ');
    return nameParts[nameParts.length - 1];
}

// Parse member string into name, lastName, and title
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

// Serialize history array to JSON for local storage
function serializeHistory(history) {
    return JSON.stringify(history.map(entry => ({
        time: entry.time.toISOString(),
        path: entry.path,
        text: entry.text,
        link: entry.link || '',
        bill: entry.bill || 'Uncategorized'
    })));
}

// Deserialize history from JSON to array
function deserializeHistory(serialized) {
    const parsed = JSON.parse(serialized);
    return parsed.map(entry => ({
        time: new Date(entry.time),
        path: entry.path,
        text: entry.text,
        link: entry.link || '',
        bill: entry.bill || 'Uncategorized'
    }));
}

// Check if a name is female (assumes window.FEMALE_NAMES is defined)
function isFemale(fullName) {
    return window.FEMALE_NAMES?.includes(fullName) || false;
}

// Find member number based on last name, title, and optional first initial
function findMemberNo(lastName, title, firstInitial = null) {
    const candidates = allMembers.filter(member => // allMembers from main.js
        member.lastName.toLowerCase() === lastName.toLowerCase() &&
        member.firstName.startsWith(title)
    );
    if (candidates.length === 1) return candidates[0].memberNo;
    if (candidates.length > 1 && firstInitial) {
        const matchingMember = candidates.find(member => member.firstName.includes(firstInitial + '.'));
        return matchingMember ? matchingMember.memberNo : null;
    }
    return null;
}