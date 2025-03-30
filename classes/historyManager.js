import { TextConstructor } from './textConstructor.js';
import { Utils } from './utils.js';

export class HistoryManager {
    constructor(containerElement, committeeSelector) {
        this.containerElement = containerElement;
        this.committeeSelector = committeeSelector;
        const storedData = localStorage.getItem("historyData");
        if (storedData) {
            this.historyData = JSON.parse(storedData);
            let maxId = 0;
            for (const key in this.historyData) {
                const entries = this.historyData[key];
                const maxInGroup = Math.max(...entries.map(entry => entry.id));
                if (maxInGroup > maxId) maxId = maxInGroup;
            }
            this.nextId = maxId + 1;
        } else {
            this.historyData = {};
            this.nextId = 0;
        }
    }

    addEntry(tokens, bill, billType, time) {
        const key = `${bill}-${billType}`;
        if (!this.historyData[key]) {
            this.historyData[key] = [];
        }
        const techText = TextConstructor.getTechText(tokens, this.committeeSelector);
        const baseProcedureText = TextConstructor.getProcedureText(tokens, this.committeeSelector);
        const entry = { id: this.nextId++, time, tokens, techText, baseProcedureText };
        this.historyData[key].push(entry);
        this.saveToStorage();
        this.render();
    }

    /**
     * Add a raw text entry to the history, marked for later review.
     * @param {string} rawText - The raw input text to store.
     * @param {string} bill - The bill name.
     * @param {string} billType - The type of bill (e.g., Hearing).
     * @param {string} time - The timestamp of the entry.
     */
    addRawEntry(rawText, bill, billType, time) {
        const key = `${bill}-${billType}`;
        if (!this.historyData[key]) {
            this.historyData[key] = [];
        }
        const entry = { id: this.nextId++, time, rawText, isRaw: true };
        this.historyData[key].push(entry);
        this.saveToStorage();
        this.render();
    }

    /**
     * Render the history table, grouping entries by bill and bill type, with raw entries highlighted.
     */
    render() {
        this.containerElement.innerHTML = '';
        for (const key in this.historyData) {
            const [bill, billType] = key.split('-');
            const groupDiv = document.createElement('div');
            groupDiv.className = 'bill-group';
            const header = document.createElement('div');
            header.className = 'bill-header';
            if (this.editingHeaderKey === key) {
                header.innerHTML = `
                    <input type="text" class="edit-bill" value="${bill}">
                    <select class="edit-bill-type">
                        <option value="Hearing" ${billType === 'Hearing' ? 'selected' : ''}>Hearing</option>
                        <option value="Committee Work" ${billType === 'Committee Work' ? 'selected' : ''}>Committee Work</option>
                        <option value="Conference Committee" ${billType === 'Conference Committee' ? 'selected' : ''}>Conference Committee</option>
                    </select>
                    <button class="save-header-btn">Save</button>
                `;
            } else {
                header.innerHTML = `${bill} - ${billType} <button class="edit-header-btn">✏️</button>`;
            }
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
            const sortedEntries = this.historyData[key].sort((a, b) => Date.parse("1970-01-01 " + b.time) - Date.parse("1970-01-01 " + a.time));
            sortedEntries.forEach(entry => {
                const row = document.createElement('tr');
                row.dataset.id = entry.id;
                row.dataset.key = key;
                if (entry.isRaw) {
                    row.style.backgroundColor = 'red'; // Highlight raw entries in red
                }
                const procedureWithTime = entry.isRaw ? entry.rawText : `${TextConstructor.formatTimeForProcedure(entry.time)} ${entry.baseProcedureText}`;
                row.innerHTML = `
                    <td contenteditable="true" class="time">${entry.time}</td>
                    <td class="statements">
                        ${entry.isRaw ? `<div class="raw-text">${entry.rawText}</div>` : `<div class="tokens-container">${entry.tokens.map(token => `<span class="history-token">${token}</span>`).join('')}</div>`}
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
                    isEditingThis = this.tokenSystem.editingEntry.key === key && this.tokenSystem.editingEntry.id === entry.id;
                }
                if (isEditingThis) {
                    editBtn.textContent = '❌';
                    editBtn.addEventListener('click', () => this.tokenSystem.cancelEdit());
                } else {
                    editBtn.textContent = '✏️';
                    editBtn.addEventListener('click', () => this.tokenSystem.startEdit(key, entry.id, entry.tokens || [entry.rawText]));
                }
                const deleteBtn = row.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => this.deleteEntry(entry.id, key));
            });
            groupDiv.appendChild(header);
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

            groupDiv.querySelectorAll('.tech-clerk, .procedural-clerk').forEach(container => {
                container.addEventListener('click', () => {
                    const copyable = container.querySelector('.copyable');
                    const text = copyable.textContent;
                    Utils.copyWithGlow(container, text);
                });
            });

            groupDiv.querySelectorAll('.time').forEach(timeCell => {
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

    deleteEntry(id, key) {
        this.historyData[key] = this.historyData[key].filter(e => e.id !== id);
        if (this.historyData[key].length === 0) {
            delete this.historyData[key];
        }
        this.saveToStorage();
        this.render();
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

    updateEntry(key, id, newTokens) {
        const entry = this.historyData[key].find(e => e.id === id);
        if (entry) {
            entry.tokens = newTokens;
            entry.techText = TextConstructor.getTechText(newTokens, this.committeeSelector);
            entry.baseProcedureText = TextConstructor.getProcedureText(newTokens, this.committeeSelector);
            this.saveToStorage();
            this.render();
        }
    }

    saveToStorage() {
        localStorage.setItem("historyData", JSON.stringify(this.historyData));
    }
}