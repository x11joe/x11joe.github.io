import { TextConstructor } from './textConstructor.js';
import { Utils } from './utils.js';

export class HistoryManager {
    constructor(containerElement, committeeSelector) {
        this.containerElement = containerElement;
        this.committeeSelector = committeeSelector;
        this.historyData = {}; // { "bill-billType": [{ id, time, tokens, techText, baseProcedureText }] }
        this.nextId = 0;
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
            this.historyData[key].forEach(entry => {
                const row = document.createElement('tr');
                row.dataset.id = entry.id;
                row.dataset.key = key;
                const procedureWithTime = `${TextConstructor.formatTimeForProcedure(entry.time)} ${entry.baseProcedureText}`;
                row.innerHTML = `
                    <td contenteditable="true" class="time">${entry.time}</td>
                    <td class="statements">
                        <div>Tokens: ${entry.tokens.join(' -> ')}</div>
                        <div class="copyable">Tech Clerk: ${entry.techText}</div>
                        <div class="copyable">Procedure Clerk: ${procedureWithTime}</div>
                    </td>
                    <td><button class="edit-btn">Edit</button></td>
                    <td><button class="delete-btn">Delete</button></td>
                `;
                tbody.appendChild(row);
            });
            groupDiv.appendChild(header);
            groupDiv.appendChild(table);
            this.containerElement.appendChild(groupDiv);

            header.addEventListener('click', () => {
                table.style.display = table.style.display === 'none' ? '' : 'none';
            });

            groupDiv.querySelectorAll('.copyable').forEach(el => {
                el.addEventListener('click', () => {
                    const text = el.textContent.split(': ')[1];
                    Utils.copyWithGlow(el, text);
                });
            });

            groupDiv.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.closest('tr').dataset.id, 10);
                    this.editEntry(id);
                });
            });

            groupDiv.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.closest('tr').dataset.id, 10);
                    const key = btn.closest('tr').dataset.key;
                    this.deleteEntry(id, key);
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
        this.render();
    }

    editEntry(id) {
        // Placeholder for future edit functionality beyond time
        alert('Edit functionality for tokens to be implemented');
    }
}