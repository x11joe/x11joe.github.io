import { TextConstructor } from './textConstructor.js';
import { Utils } from './utils.js';

export class HistoryManager {

    /**
     * Initialize the HistoryManager with a container element and committee selector.
     * Loads history groups from local storage or migrates old history data, ensuring historyGroups is always defined.
     * @param {HTMLElement} containerElement - The element where the history table will be rendered.
     * @param {Object} committeeSelector - The CommitteeSelector instance for text construction.
     */
    constructor(containerElement, committeeSelector) {
        this.containerElement = containerElement;
        this.committeeSelector = committeeSelector;
        const storedGroups = localStorage.getItem("historyGroups");
        if (storedGroups) {
            this.historyGroups = JSON.parse(storedGroups);
        } else {
            // Check for old historyData and convert if it exists
            const storedData = localStorage.getItem("historyData");
            if (storedData) {
                const historyData = JSON.parse(storedData);
                this.historyGroups = Object.keys(historyData).map((key, index) => {
                    const [bill, billType] = key.split('-');
                    return {
                        id: index,
                        bill,
                        billType,
                        entries: historyData[key]
                    };
                });
            } else {
                this.historyGroups = [];
            }
        }
        // Find max id for entries
        let maxId = 0;
        for (const group of this.historyGroups) {
            if (group.entries.length > 0) {
                const maxInGroup = Math.max(...group.entries.map(entry => entry.id));
                if (maxInGroup > maxId) maxId = maxInGroup;
            }
        }
        this.nextId = maxId + 1;
        // Find max group id
        this.nextGroupId = this.historyGroups.length > 0 ? Math.max(...this.historyGroups.map(g => g.id)) + 1 : 0;
    }

    /**
     * Helper method to format a time string.
     * Expects a time string in the format "9:23:39 AM" (or similar) and returns "9:23 a.m.".
     * @param {string} timeStr - The original time string.
     * @returns {string} - The formatted time.
     */
    formatTime(timeStr) {
        const parts = timeStr.split(" ");
        if (parts.length < 2) return timeStr;
        // Remove seconds by splitting on colon and taking only hour and minute.
        const timeParts = parts[0].split(":");
        if (timeParts.length < 2) return timeStr;
        const hourMinute = `${timeParts[0]}:${timeParts[1]}`;
        // Convert period to lowercase with dots.
        let period = parts[1].toLowerCase();
        period = period === "am" ? "a.m." : period === "pm" ? "p.m." : period;
        return `${hourMinute} ${period}`;
    }

    /**
     * Add a tokenized entry to the history, grouping by bill and bill type if a matching group exists.
     * @param {Array<string>} tokens - The array of tokens representing the entry.
     * @param {string} bill - The bill name (e.g., "HB 2013").
     * @param {string} billType - The type of bill (e.g., "Hearing").
     * @param {string} time - The timestamp of the entry (e.g., "9:00:00 AM").
     */
    addEntry(tokens, bill, billType, time) {
        let group = this.historyGroups.find(g => g.bill === bill && g.billType === billType);
        if (!group) {
            group = { id: this.nextGroupId++, bill, billType, entries: [] };
            this.historyGroups.push(group);
        }
        const techText = TextConstructor.getTechText(tokens, this.committeeSelector);
        const baseProcedureText = TextConstructor.getProcedureText(tokens, this.committeeSelector);
        const entry = { id: this.nextId++, groupId: group.id, time, tokens, techText, baseProcedureText };
        group.entries.push(entry);
        this.saveToStorage();
        this.render();
    }

    /**
     * Add a raw text entry to the history, grouping by bill and bill type if a matching group exists, marked for later review.
     * @param {string} rawText - The raw input text to store.
     * @param {string} bill - The bill name.
     * @param {string} billType - The type of bill (e.g., "Hearing").
     * @param {string} time - The timestamp of the entry.
     */
    addRawEntry(rawText, bill, billType, time) {
        let group = this.historyGroups.find(g => g.bill === bill && g.billType === billType);
        if (!group) {
            group = { id: this.nextGroupId++, bill, billType, entries: [] };
            this.historyGroups.push(group);
        }
        const entry = { id: this.nextId++, groupId: group.id, time, rawText, isRaw: true };
        group.entries.push(entry);
        this.saveToStorage();
        this.render();
    }

    /**
     * Render the history table, sorting groups by the latest entry timestamp to ensure newest entries are at the top.
     * Constructs procedural clerk text by formatting the time using the helper formatTime method.
     */
    render() {
        // Sort groups by the latest entry's timestamp, descending.
        this.historyGroups.sort((a, b) => {
        const latestA = Math.max(...a.entries.map(e => Date.parse("1970-01-01 " + e.time)));
        const latestB = Math.max(...b.entries.map(e => Date.parse("1970-01-01 " + e.time)));
        return latestB - latestA;
        });
        // Within each group, sort entries by timestamp descending.
        for (const group of this.historyGroups) {
        group.entries.sort((a, b) => Date.parse("1970-01-01 " + b.time) - Date.parse("1970-01-01 " + a.time));
        }
        this.containerElement.innerHTML = '';
        for (const group of this.historyGroups) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'bill-group';
        const header = document.createElement('div');
        header.className = 'bill-header';
        const key = group.id; // Use group id for editing
        if (this.editingHeaderKey === key) {
            header.innerHTML = `
            <input type="text" class="edit-bill" value="${group.bill}">
            <select class="edit-bill-type">
                <option value="Hearing" ${group.billType === 'Hearing' ? 'selected' : ''}>Hearing</option>
                <option value="Committee Work" ${group.billType === 'Committee Work' ? 'selected' : ''}>Committee Work</option>
                <option value="Conference Committee" ${group.billType === 'Conference Committee' ? 'selected' : ''}>Conference Committee</option>
            </select>
            <button class="save-header-btn">Save</button>
            `;
        } else {
            header.innerHTML = `${group.bill} - ${group.billType} <button class="edit-header-btn">✏️</button>`;
        }
        groupDiv.appendChild(header);
        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
            <tr>
                <th>Time</th>
                <th>Statements</th>
                <th>Edit</th>
                <th>Delete</th>
            </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        group.entries.forEach(entry => {
            const row = document.createElement('tr');
            row.dataset.id = entry.id;
            row.dataset.groupId = group.id;
            if (entry.isRaw) {
            row.style.backgroundColor = 'red'; // Highlight raw entries in red
            }
            const formattedTime = this.formatTime(entry.time);
            const procedureWithTime = entry.isRaw ? entry.rawText : `${formattedTime} ${entry.baseProcedureText}`;
            row.innerHTML = `
            <td contenteditable="true" class="time">${entry.time}</td>
            <td class="statements">
                ${entry.isRaw ? `<div class="raw-text">${entry.rawText}</div>` : `<div class="tokens-container">${
                // Within the render method, replace the tokens mapping:
                entry.tokens.map(token => {
                    if (token.startsWith('{')) {
                        try {
                            const data = JSON.parse(token);
                            return `<span class="history-token">${data.firstName} ${data.lastName} - ${data.position}</span>`;
                        } catch (e) {
                            return `<span class="history-token">${token}</span>`;
                        }
                    } else {
                        return `<span class="history-token">${token}</span>`;
                    }
                }).join('')
                }</div>`}
                <div class="tech-clerk">
                <label>Tech Clerk</label>
                <div class="copyable">${entry.techText || ''}</div>
                </div>
                <div class="procedural-clerk">
                <label>Procedural Clerk</label>
                <div class="copyable">${procedureWithTime}</div>
                </div>
            </td>
            <td><button class="edit-btn"></button></td>
            <td><button class="delete-btn">🗑️</button></td>
            `;
            tbody.appendChild(row);
            const editBtn = row.querySelector('.edit-btn');
            let isEditingThis = false;
            if (this.tokenSystem && this.tokenSystem.isEditing && this.tokenSystem.editingEntry) {
            isEditingThis = this.tokenSystem.editingEntry.groupId === group.id && this.tokenSystem.editingEntry.id === entry.id;
            }
            if (isEditingThis) {
            editBtn.textContent = '❌';
            editBtn.addEventListener('click', () => this.tokenSystem.cancelEdit());
            } else {
            editBtn.textContent = '✏️';
            editBtn.addEventListener('click', () => this.tokenSystem.startEdit(group.id, entry.id, entry.tokens || [entry.rawText]));
            }
            const deleteBtn = row.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', () => this.deleteEntry(entry.id, group.id));
            
            row.querySelectorAll('.tech-clerk, .procedural-clerk').forEach(container => {
            container.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                const timeCell = row.querySelector('.time');
                const timeText = timeCell ? timeCell.textContent : "";
                const techText = container.classList.contains('tech-clerk') ? container.querySelector('.copyable').textContent : "";
                let memberNo = "";
                let link = "";
                if (entry.tokens && entry.tokens[0] === "Testimony" && entry.tokens.length === 2) {
                    try {
                    const data = JSON.parse(entry.tokens[1]);
                    const members = this.committeeSelector.getSelectedCommitteeMembers();
                    const memberObj = members.find(m => {
                        const mName = (typeof m === "object" && m.name) ? m.name.split(" - ")[0] : m;
                        return mName.toLowerCase().includes(data.lastName.toLowerCase());
                    });
                    if (memberObj) {
                        memberNo = memberObj.memberNo || "";
                    }
                    link = data.link || "";
                    } catch (err) {
                    console.error(err);
                    }
                }
                const specialText = `${timeText} | ${techText} | member-no:${memberNo};Mic: | ${link}`;
                Utils.copyWithGlow(container, specialText, "yellow");
                } else {
                const copyable = container.querySelector('.copyable');
                const text = copyable.textContent;
                Utils.copyWithGlow(container, text);
                }
            });
            });
        
            row.querySelectorAll('.time').forEach(timeCell => {
            timeCell.addEventListener('dblclick', () => {
                const text = timeCell.textContent;
                Utils.copyWithGlow(timeCell, text);
            });
            timeCell.addEventListener('blur', (e) => {
                const id = parseInt(e.target.closest('tr').dataset.id, 10);
                const newTime = e.target.textContent;
                this.updateTime(id, newTime);
            });
            });
        });
        groupDiv.appendChild(table);
        this.containerElement.appendChild(groupDiv);
        
        if (this.editingHeaderKey === key) {
            const saveBtn = header.querySelector('.save-header-btn');
            const billInput = header.querySelector('.edit-bill');
            saveBtn.addEventListener('click', () => this.saveHeader(key));
            billInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.saveHeader(key);
            }
            });
            header.addEventListener('blur', () => {
            setTimeout(() => {
                if (!header.contains(document.activeElement)) {
                this.saveHeader(key);
                }
            }, 100);
            }, true);
        } else {
            const editHeaderBtn = header.querySelector('.edit-header-btn');
            editHeaderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startEditingHeader(key);
            });
        }
        header.addEventListener('click', () => {
            if (this.editingHeaderKey !== key) {
            table.style.display = table.style.display === 'none' ? '' : 'none';
            }
        });
        }
    }
  
  
    
    startEditingHeader(key) {
        this.editingHeaderKey = key;
        this.render();
    }
    
    saveHeader(key) {
        const bill = document.querySelector('.edit-bill').value.trim();
        const billType = document.querySelector('.edit-bill-type').value;
        const newKey = `${bill}-${billType}`;
        if (newKey !== key && bill) {
            this.historyData[newKey] = this.historyData[key];
            delete this.historyData[key];
            this.saveToStorage();
        }
        this.editingHeaderKey = null;
        this.render();
    }

    /**
     * Start editing the header for a specific group by setting the editing key to the group's ID.
     * @param {number} groupId - The ID of the group to edit.
     */
    startEditingHeader(groupId) {
        this.editingHeaderKey = groupId;
        this.render();
    }

    /**
     * Save the edited header (bill and billType) for a group and merge with existing groups if necessary.
     * Merges occur when the new bill and billType match another group, respecting existing grouping rules.
     * @param {number} groupId - The ID of the group being edited.
     */
    saveHeader(groupId) {
        const group = this.historyGroups.find(g => g.id === groupId);
        if (!group) return;

        const billInput = document.querySelector('.edit-bill');
        const billTypeSelect = document.querySelector('.edit-bill-type');
        if (!billInput || !billTypeSelect) return;

        const newBill = billInput.value.trim();
        const newBillType = billTypeSelect.value;

        if (newBill && (newBill !== group.bill || newBillType !== group.billType)) {
            // Check if there's an existing group with the new bill and billType
            const existingGroup = this.historyGroups.find(g => g.bill === newBill && g.billType === newBillType && g.id !== groupId);
            if (existingGroup) {
                // Merge entries into the existing group, updating groupId for consistency
                existingGroup.entries = existingGroup.entries.concat(group.entries.map(entry => ({ ...entry, groupId: existingGroup.id })));
                // Remove the old group
                this.historyGroups = this.historyGroups.filter(g => g.id !== groupId);
            } else {
                // Update the group's bill and billType directly
                group.bill = newBill;
                group.billType = newBillType;
            }
            this.saveToStorage();
        }
        this.editingHeaderKey = null;
        this.render();
    }

    updateTime(id, newTime) {
        for (const key in this.historyData) {
            const entry = this.historyData[key].find(e => e.id === id);
            if (entry) {
                entry.time = newTime;
                this.saveToStorage();
                this.render();
                break;
            }
        }
    }

    /**
     * Delete an entry from a group by its ID and remove the group if it becomes empty.
     * @param {number} id - The ID of the entry to delete.
     * @param {number} groupId - The ID of the group containing the entry.
     */
    deleteEntry(id, groupId) {
        const group = this.historyGroups.find(g => g.id === groupId);
        if (group) {
            group.entries = group.entries.filter(e => e.id !== id);
            if (group.entries.length === 0) {
                this.historyGroups = this.historyGroups.filter(g => g.id !== groupId);
            }
            this.saveToStorage();
            this.render();
        }
    }

    editEntry(id) {
        // Placeholder for future edit functionality beyond time
        alert('Edit functionality for tokens to be implemented');
    }

    editHeader(key) {
        const [oldBill, oldBillType] = key.split('-');
        const newBill = prompt("Enter new bill:", oldBill);
        const newBillType = prompt("Enter new bill type:", oldBillType);
        if (newBill && newBillType) {
            const newKey = `${newBill}-${newBillType}`;
            if (newKey !== key) {
                this.historyData[newKey] = this.historyData[key];
                delete this.historyData[key];
                this.saveToStorage();
                this.render();
            }
        }
    }

    setTokenSystem(tokenSystem) {
        this.tokenSystem = tokenSystem;
    }

    /**
     * Update an existing entry's tokens within a specific group and refresh the display.
     * @param {number} groupId - The ID of the group containing the entry.
     * @param {number} id - The ID of the entry to update.
     * @param {Array<string>} newTokens - The new token array to set.
     */
    updateEntry(groupId, id, newTokens) {
        const group = this.historyGroups.find(g => g.id === groupId);
        if (group) {
            const entry = group.entries.find(e => e.id === id);
            if (entry) {
                entry.tokens = newTokens;
                entry.techText = TextConstructor.getTechText(newTokens, this.committeeSelector);
                entry.baseProcedureText = TextConstructor.getProcedureText(newTokens, this.committeeSelector);
                this.saveToStorage();
                this.render();
            }
        }
    }

    /**
     * Save the current history groups to local storage under the key "historyGroups".
     */
    saveToStorage() {
        localStorage.setItem("historyGroups", JSON.stringify(this.historyGroups));
    }

    /**
     * Clear all history groups, reset ID counters, save changes to local storage, and re-render the history table.
     */
    clearAllHistory() {
        this.historyGroups = [];
        this.nextId = 0;
        this.nextGroupId = 0;
        this.saveToStorage();
        this.render();
    }
}