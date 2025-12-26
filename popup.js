// Load notes on popup open
document.addEventListener('DOMContentLoaded', loadNotes);

function loadNotes() {
    chrome.storage.local.get(['notes'], function(result) {
        const notes = result.notes || [];
        displayNotes(notes);
    });
}

function displayNotes(notes) {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '';
    notes.forEach((note, index) => {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note';
        noteDiv.innerHTML = `
            <p>${note.text}</p>
            <button class="delete-btn" data-index="${index}">Delete</button>
        `;
        notesList.appendChild(noteDiv);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            deleteNote(index);
        });
    });
}

function saveNote() {
    const noteText = document.getElementById('note-text').value.trim();
    if (noteText === '') return;

    chrome.storage.local.get(['notes'], function(result) {
        const notes = result.notes || [];
        notes.push({ text: noteText, id: Date.now() });
        chrome.storage.local.set({ notes: notes }, function() {
            document.getElementById('note-text').value = '';
            loadNotes();
        });
    });
}

function deleteNote(index) {
    chrome.storage.local.get(['notes'], function(result) {
        const notes = result.notes || [];
        notes.splice(index, 1);
        chrome.storage.local.set({ notes: notes }, function() {
            loadNotes();
        });
    });
}

// Event listener for save button
document.getElementById('save-btn').addEventListener('click', saveNote);