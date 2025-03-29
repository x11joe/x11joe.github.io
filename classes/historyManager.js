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
        this.render();
    }

    addEntry(tokens, bill, billType) {
        const key = `${bill}-${billType}`;
        if (!this.historyData[key]) {
            this.historyData[key] = [];
        }
        const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        const techText = TextConstructor.getTechText(tokens, this.committeeSelector);
        const baseProcedureText = TextConstructor.getProcedureText(tokens, this.committeeSelector);
        const entry = { id: this.nextId++, time, tokens, techText, baseProcedureText };
        this.historyData[key].push(entry);
        this.saveToStorage();
        this.render();
    }

    render() {
        this.containerElement.innerHTML = '';
        for (const key in this.historyData) {
            const [bill, billType] = key.split('-');
            const groupDiv = document.createElement('div');
            groupDiv.className = 'bill-group';
            const header = document.createElement('div');
            header.className = 'bill-header';
            header.textContent = `${bill} - ${billType}`;
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
                const procedureWithTime = `${TextConstructor.formatTimeForProcedure(entry.time)} ${entry.baseProcedureText}`;
                row.innerHTML = `
                    <td contenteditable="true" class="time">${entry.time}</td>
                    <td class="statements">
                        <div class="tokens-container">${entry.tokens.map(token => `<span class="token">${token}</span>`).join('')}</div>
                        <div class="tech-clerk">
                            <label>Tech Clerk</label>
                            <div class="copyable">${entry.techText}</div>
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
                const isEditingThis = this.tokenSystem.isEditing && this.tokenSystem.editingEntry && this.tokenSystem.editingEntry.key === key && this.tokenSystem.editingEntry.id === entry.id;
                if (isEditingThis) {
                    editBtn.textContent = '❌';
                    editBtn.addEventListener('click', () => this.tokenSystem.cancelEdit());
                } else {
                    editBtn.textContent = '✏️';
                    editBtn.addEventListener('click', () => this.tokenSystem.startEdit(key, entry.id, entry.tokens));
                }
                const deleteBtn = row.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', () => this.deleteEntry(entry.id, key));
            });
            groupDiv.appendChild(header);
            groupDiv.appendChild(table);
            this.containerElement.appendChild(groupDiv);
    
            header.addEventListener('click', () => {
                table.style.display = table.style.display === 'none' ? '' : 'none';
            });
    
            groupDiv.querySelectorAll('.copyable').forEach(el => {
                el.addEventListener('click', () => {
                    const text = el.textContent;
                    Utils.copyWithGlow(el, text);
                });
            });
    
            groupDiv.querySelectorAll('.time').forEach(timeCell => {
                timeCell.addEventListener('blur', (e) => {
                    const id = parseInt(e.target.closest('tr').dataset.id, 10);
                    const newTime = e.target.textContent;
                    this.updateTime(id, newTime);
                });
            });
        }
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