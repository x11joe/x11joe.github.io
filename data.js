// data.js - Handles data loading and management

// Parse members from allMember.xml into an array
function parseMembersFromXML(xmlDoc) {
    const hotKeys = xmlDoc.getElementsByTagName('HotKey');
    const members = [];
    for (let i = 0; i < hotKeys.length; i++) {
        const hotKey = hotKeys[i];
        const nameElem = hotKey.getElementsByTagName('Name')[0];
        const firstNameElem = hotKey.getElementsByTagName('FirstName')[0];
        const fields = hotKey.getElementsByTagName('Fields')[0];
        if (nameElem && fields) {
            const lastName = nameElem.textContent.trim();
            const firstName = firstNameElem ? firstNameElem.textContent.trim() : '';
            const fullName = firstName ? `${firstName} ${lastName}` : lastName;
            const memberNoField = Array.from(fields.getElementsByTagName('Field')).find(f => f.getElementsByTagName('Key')[0].textContent === 'member-no');
            const memberNo = memberNoField ? memberNoField.getElementsByTagName('Value')[0].textContent.trim() : null;
            if (memberNo) {
                members.push({ lastName, firstName, fullName, memberNo });
            }
        }
    }
    return members;
}