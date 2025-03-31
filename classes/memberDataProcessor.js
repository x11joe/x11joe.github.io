// Encapsulates logic for fetching and processing member data from an XML file and updating committee data with member numbers.
export class MemberDataProcessor {
    /**
     * Initialize the processor with the XML URL and the committees data to update.
     * @param {string} xmlUrl - The URL of the XML file containing member data (e.g., "allMember.xml").
     * @param {Object} committeesData - The object mapping committee names to member arrays (e.g., DEFAULT_COMMITTEES).
     */
    constructor(xmlUrl, committeesData) {
        this.xmlUrl = xmlUrl;
        this.committeesData = committeesData;
    }

    /**
     * Fetch the XML, parse it, and update the committees data with member numbers.
     * This is the main method to call for processing.
     * @returns {Promise<void>} - Resolves when processing is complete.
     */
    async loadAndProcess() {
        const memberData = await this.fetchAndParseXml();
        this.matchMemberData(memberData);
    }

    /**
     * Fetch and parse the XML file to extract member data including last name, title, initial, and member number.
     * @returns {Promise<Array>} - An array of member objects with parsed data.
     */
    async fetchAndParseXml() {
        const response = await fetch(this.xmlUrl);
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const hotKeys = xmlDoc.getElementsByTagName("HotKey");

        return Array.from(hotKeys).map(hotKey => {
            const lastName = hotKey.getElementsByTagName("Name")[0]?.textContent;
            const firstNameEl = hotKey.getElementsByTagName("FirstName")[0]?.textContent;
            const fields = hotKey.getElementsByTagName("Field");
            let memberNo = null;
            for (const field of fields) {
                if (field.getElementsByTagName("Key")[0]?.textContent === "member-no") {
                    memberNo = field.getElementsByTagName("Value")[0]?.textContent;
                    break;
                }
            }
            const titleMatch = firstNameEl?.match(/^(Senator|Representative)(?:\s+([A-Z])\.)?/);
            return {
                lastName,
                title: titleMatch ? titleMatch[1] : null,
                initial: titleMatch && titleMatch[2] ? titleMatch[2] : null,
                memberNo
            };
        });
    }

    /**
     * Match parsed member data to the committees data and update memberNo properties.
     * @param {Array} memberData - The array of member objects parsed from XML.
     */
    matchMemberData(memberData) {
        for (const committee in this.committeesData) {
            this.committeesData[committee].forEach(memberObj => {
                if (memberObj.name && typeof memberObj.name === 'string') {
                    const [fullName] = memberObj.name.split(" - ");
                    const nameParts = fullName.split(" ");
                    const lastName = nameParts[nameParts.length - 1];
                    const firstInitial = nameParts[0][0];
                    const isSenate = committee.toLowerCase().startsWith("senate");
                    const title = isSenate ? "Senator" : "Representative";

                    const matches = memberData.filter(md => md.lastName === lastName && md.title === title);
                    if (matches.length === 1) {
                        memberObj.memberNo = matches[0].memberNo;
                    } else if (matches.length > 1) {
                        const exactMatch = matches.find(md => md.initial === firstInitial);
                        if (exactMatch) {
                            memberObj.memberNo = exactMatch.memberNo;
                        }
                    }
                } else {
                    console.error("Member object missing 'name' property or 'name' is not a string in committee:", committee, "Member:", memberObj);
                }
            });
        }
    }
}