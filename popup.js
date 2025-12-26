// Notes Management System
class NotesManager {
  constructor() {
    this.currentView = 'list';
    this.editingNote = null;
    this.cachedNotes = [];
    this.pendingDelete = null; // For custom confirmation dialog
    
    // Search functionality
    this.searchQuery = '';
    this.filteredNotes = [];
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadNotes();
  }

  bindEvents() {
    // Header buttons
    document.getElementById('newNoteBtn').addEventListener('click', () => this.showNoteForm());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportNotes());

    // Form events
    document.getElementById('noteForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
    document.getElementById('cancelBtn').addEventListener('click', () => this.showNotesList());




    // Confirmation dialog events
    document.getElementById('confirmCancel').addEventListener('click', () => this.hideConfirmDialog());
    document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDelete());

    // Inline search events
    document.getElementById('inlineSearchInput').addEventListener('input', (e) => this.handleInlineSearch(e));

    // Event delegation for notes list
    document.getElementById('notesList').addEventListener('click', (e) => {
      const copyBtn = e.target.closest('button[title="Copy"]');
      const deleteBtn = e.target.closest('button[title="Delete"]');
      const noteItem = e.target.closest('.note-item');
      
      if (copyBtn) {
        e.stopPropagation();
        const noteId = noteItem.dataset.noteId;
        this.copyNote(noteId);
      } else if (deleteBtn) {
        e.stopPropagation();
        const noteId = noteItem.dataset.noteId;
        this.deleteNote(noteId);
      } else if (noteItem && !e.target.closest('.note-actions')) {
        const noteId = noteItem.dataset.noteId;
        console.log('Note item clicked, ID:', noteId);
        const note = this.getNoteById(noteId);
        if (note) {
          console.log('Opening note edit form for:', note.title);
          this.showNoteForm(note);
        } else {
          console.log('Note not found for ID:', noteId);
        }
      }
    });


  }

  async loadNotes() {
    try {
      const result = await chrome.storage.local.get(['notes']);
      const notes = result.notes || [];
      this.cachedNotes = notes; // Cache for faster access
      this.filterNotes(); // Apply current search filter
    } catch (error) {
      console.error('Error loading notes:', error);
      this.showStatus('Failed to load notes', 'error');
    }
  }

  async getNoteById(noteId) {
    if (this.cachedNotes) {
      return this.cachedNotes.find(note => note.id === noteId);
    }
    
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || [];
    return notes.find(note => note.id === noteId);
  }

  displayNotes(notes) {
    const notesList = document.getElementById('notesList');
    const emptyState = document.getElementById('emptyState');
    const searchEmptyState = document.getElementById('searchEmptyState');

    if (notes.length === 0) {
      notesList.innerHTML = '';
      
      // Show appropriate empty state
      if (this.searchQuery.trim()) {
        // Search query exists but no results
        emptyState.classList.add('hidden');
        searchEmptyState.classList.remove('hidden');
      } else {
        // No search query, no notes at all
        searchEmptyState.classList.add('hidden');
        emptyState.classList.remove('hidden');
      }
      return;
    }

    // Hide both empty states when showing notes
    emptyState.classList.add('hidden');
    searchEmptyState.classList.add('hidden');
    
    // Sort notes by creation date (newest first)
    const sortedNotes = notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    notesList.innerHTML = sortedNotes.map(note => `
      <li class="note-item" data-note-id="${note.id}">
        <div class="note-title">${this.escapeHtml(note.title || 'Untitled')}</div>
        <div class="note-preview">${this.escapeHtml(note.content || '')}</div>
        <div class="note-meta">
          <span>${this.formatDate(note.createdAt)}</span>
          <div class="note-actions">
            <button class="btn btn-small" data-action="copy" title="Copy">Copy</button>
            <button class="btn btn-small btn-danger" data-action="delete" title="Delete">Delete</button>
          </div>
        </div>
      </li>
    `).join('');

    // Add click event to note items
    notesList.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on action buttons
        if (e.target.closest('.note-actions')) return;
        
        console.log('Direct note item click, ID:', item.dataset.noteId);
        e.stopPropagation(); // Prevent event delegation from also firing
        
        const noteId = item.dataset.noteId;
        const note = sortedNotes.find(n => n.id === noteId);
        if (note) {
          console.log('Direct handler - Opening note edit form for:', note.title);
          this.showNoteForm(note);
        }
      });
    });
  }

  showNoteForm(editingNote = null) {
    this.editingNote = editingNote;
    this.currentView = 'form';
    
    // Update form state
    const form = document.getElementById('noteForm');
    const title = document.getElementById('noteTitle');
    const content = document.getElementById('noteContent');
    const saveBtn = document.getElementById('saveBtn');
    
    if (editingNote) {
      title.value = editingNote.title || '';
      content.value = editingNote.content || '';
      saveBtn.textContent = 'Update Note';
    } else {
      form.reset();
      saveBtn.textContent = 'Save Note';
    }
    
    this.showView('noteFormView');
  }



  showNotesList() {
    this.currentView = 'list';
    this.editingNote = null;
    this.showView('notesListView');
  }

  showView(viewId) {
    console.log('showView called with:', viewId);
    
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.add('hidden');
    });
    
    // Show target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.remove('hidden');
      console.log('Successfully showed view:', viewId);
    } else {
      console.error('View not found:', viewId);
    }
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title && !content) {
      this.showStatus('Please enter a title or content', 'warning');
      return;
    }

    try {
      if (this.editingNote) {
        await this.updateNote(this.editingNote.id, { title, content });
        this.showStatus('Note updated successfully', 'success');
      } else {
        await this.saveNote({ title, content });
        this.showStatus('Note saved successfully', 'success');
      }
      
      this.showNotesList();
      await this.loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      this.showStatus('Failed to save note', 'error');
    }
  }

  async saveNote(noteData) {
    const note = {
      id: Date.now().toString(),
      title: noteData.title,
      content: noteData.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || [];
    notes.push(note);
    
    await chrome.storage.local.set({ notes });
  }

  async updateNote(noteId, updates) {
    const result = await chrome.storage.local.get(['notes']);
    const notes = result.notes || [];
    
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }
    
    notes[noteIndex] = {
      ...notes[noteIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await chrome.storage.local.set({ notes });
  }

  async deleteNote(noteId) {
    // Store the note ID for deletion after confirmation
    this.pendingDelete = noteId;
    this.showConfirmDialog();
  }

  showConfirmDialog() {
    const dialog = document.getElementById('confirmDialog');
    dialog.classList.remove('hidden');
  }

  hideConfirmDialog() {
    const dialog = document.getElementById('confirmDialog');
    dialog.classList.add('hidden');
    this.pendingDelete = null;
  }

  async confirmDelete() {
    if (!this.pendingDelete) {
      this.hideConfirmDialog();
      return;
    }

    try {
      const result = await chrome.storage.local.get(['notes']);
      const notes = result.notes || [];
      const filteredNotes = notes.filter(note => note.id !== this.pendingDelete);
      
      await chrome.storage.local.set({ notes: filteredNotes });
      
      // Go back to list after deletion
      this.showNotesList();
      
      this.showStatus('Note deleted successfully', 'success');
      
      // Small delay to ensure storage is updated and status message is visible
      setTimeout(async () => {
        // Force refresh the notes display
        await this.loadNotes();
        
        // Ensure we're on the list view and it's visible
        this.showView('notesListView');
      }, 100);
      
    } catch (error) {
      console.error('Error deleting note:', error);
      this.showStatus('Failed to delete note', 'error');
    } finally {
      this.hideConfirmDialog();
    }
  }

  async copyNote(noteId) {
    try {
      const result = await chrome.storage.local.get(['notes']);
      const notes = result.notes || [];
      const note = notes.find(n => n.id === noteId);
      
      if (!note) {
        this.showStatus('Note not found', 'error');
        return;
      }

      const textToCopy = note.content || note.title || '';
      if (!textToCopy) {
        this.showStatus('Nothing to copy', 'warning');
        return;
      }

      await navigator.clipboard.writeText(textToCopy);
      this.showStatus('Content copied to clipboard', 'success');
    } catch (error) {
      console.error('Error copying note:', error);
      this.showStatus('Failed to copy content', 'error');
    }
  }



  async exportNotes() {
    try {
      const result = await chrome.storage.local.get(['notes']);
      const notes = result.notes || [];
      
      if (notes.length === 0) {
        this.showStatus('No notes to export', 'warning');
        return;
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        totalNotes: notes.length,
        notes: notes
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notes-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStatus('Notes exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting notes:', error);
      this.showStatus('Failed to export notes', 'error');
    }
  }



  showStatus(message, type = 'success') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Inline search functionality
  handleInlineSearch(e) {
    this.searchQuery = e.target.value;
    this.filterNotes();
  }

  filterNotes() {
    if (!this.cachedNotes) {
      this.displayNotes([]);
      return;
    }

    const lowercaseQuery = this.searchQuery.toLowerCase().trim();
    
    if (!lowercaseQuery) {
      // Show all notes if no search query
      this.filteredNotes = [...this.cachedNotes];
    } else {
      // Filter notes by title and content
      this.filteredNotes = this.cachedNotes.filter(note => {
        const title = (note.title || '').toLowerCase();
        const content = (note.content || '').toLowerCase();
        return title.includes(lowercaseQuery) || content.includes(lowercaseQuery);
      });
    }
    
    this.displayNotes(this.filteredNotes);
  }
}

// Initialize the notes manager when the page loads
let notesManager;

document.addEventListener('DOMContentLoaded', () => {
  notesManager = new NotesManager();
});