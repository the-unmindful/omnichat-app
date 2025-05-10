import {
    personaListDiv,
    personaNameInput,
    personaPromptInput,
    savePersonaButton,
    clearPersonaFormButton
} from './ui-elements';
import { showToast } from './toast-notifications';
import { 
    Persona, 
    allPersonas, // Mutable state imported from renderer
    editingPersonaId, // Mutable state imported from renderer
    populatePersonaSelector // Function to update main UI dropdown
    // loadAndDisplayPersonas as loadAndDisplayPersonasFromRenderer is no longer needed from renderer.ts
} from './renderer'; // Assuming Persona type, state vars, and populatePersonaSelector are exported from renderer.ts

// renderPersonaList function, moved from renderer.ts
function renderPersonaListInternal() {
    if (!personaListDiv) return;
    personaListDiv.innerHTML = ''; 
    if (allPersonas.length === 0) {
        personaListDiv.innerHTML = '<p>No personas saved yet. Add one above!</p>';
        return;
    }
    console.log("PersonasUI: renderPersonaList called. Personas to render:", allPersonas.length);
    allPersonas.forEach(persona => {
        const personaEntryDiv = document.createElement('div');
        personaEntryDiv.className = 'persona-entry'; 
        personaEntryDiv.setAttribute('data-persona-id', persona.id);
        
        const personaInfo = document.createElement('div');
        personaInfo.className = 'persona-info';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'persona-name-display';
        nameSpan.textContent = persona.name;
        personaInfo.appendChild(nameSpan);
        personaEntryDiv.appendChild(personaInfo);

        const personaActions = document.createElement('div');
        personaActions.className = 'persona-actions';
        
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.className = 'edit-persona-button'; 
        editButton.addEventListener('click', () => {
            if (personaNameInput && personaPromptInput && savePersonaButton) {
                personaNameInput.value = persona.name;
                personaPromptInput.value = persona.prompt;
                // editingPersonaId is imported and mutated
                (window as any).editingPersonaId = persona.id; // Hack to assign to imported let
                savePersonaButton.textContent = 'Update Persona';
                personaNameInput.focus();
            }
        });
        personaActions.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-persona-button'; 
        deleteButton.addEventListener('click', () => {
            const actionsDiv = deleteButton.parentElement; 
            if (!actionsDiv) return;
            deleteButton.style.display = 'none';
            const editBtnFromActions = actionsDiv.querySelector('.edit-persona-button') as HTMLButtonElement | null;
            if (editBtnFromActions) editBtnFromActions.style.display = 'none';

            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = '✔️';
            confirmBtn.className = 'confirm-delete-btn';
            confirmBtn.title = 'Confirm Delete Persona';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '❌';
            cancelBtn.className = 'cancel-delete-btn';
            cancelBtn.title = 'Cancel';

            const restoreOriginalButtons = () => {
                confirmBtn.remove();
                cancelBtn.remove();
                deleteButton.style.display = '';
                if (editBtnFromActions) editBtnFromActions.style.display = '';
            };

            confirmBtn.addEventListener('click', async () => {
                console.log(`PersonasUI: Confirming delete for persona ID: ${persona.id}`);
                confirmBtn.disabled = true;
                cancelBtn.disabled = true;
                try {
                    const success = await window.electronAPI.deletePersona(persona.id);
                    if (success) {
                        showToast(`Persona "${persona.name}" deleted.`, 'success');
                        if ((window as any).editingPersonaId === persona.id) { 
                            clearPersonaFormInternal(); 
                        }
                        await loadAndDisplayPersonas(); // Call self
                        await populatePersonaSelector(); // Call imported from renderer
                    } else {
                        showToast('Failed to delete persona.', 'error');
                        restoreOriginalButtons();
                    }
                } catch (error) {
                    console.error(`PersonasUI: Error deleting persona ${persona.id}:`, error);
                    showToast(`Error deleting persona: ${(error as Error).message || 'Unknown error'}`, 'error');
                    restoreOriginalButtons();
                }
            });
            cancelBtn.addEventListener('click', () => {
                restoreOriginalButtons();
            });
            actionsDiv.appendChild(confirmBtn);
            actionsDiv.appendChild(cancelBtn);
        });
        personaActions.appendChild(deleteButton);
        personaEntryDiv.appendChild(personaActions);
        personaListDiv.appendChild(personaEntryDiv);
    });
}

// clearPersonaForm function, moved from renderer.ts
function clearPersonaFormInternal() {
    if (personaNameInput) personaNameInput.value = '';
    if (personaPromptInput) personaPromptInput.value = '';
    // editingPersonaId is imported and mutated
    (window as any).editingPersonaId = null; // Hack to assign to imported let
    if (savePersonaButton) savePersonaButton.textContent = 'Save Persona';
    console.log("PersonasUI: Persona form cleared.");
}

// handleSavePersona function, moved from renderer.ts
async function handleSavePersonaInternal() {
    if (!personaNameInput || !personaPromptInput || !savePersonaButton) {
        console.error("PersonasUI: Persona form elements not found for saving.");
        return;
    }
    const name = personaNameInput.value.trim();
    const promptValue = personaPromptInput.value.trim(); // Renamed to avoid conflict with Persona.prompt
    if (!name) {
        showToast("Persona name cannot be empty.", "error");
        personaNameInput.focus();
        return;
    }
    if (!promptValue) {
        showToast("Persona prompt cannot be empty.", "error");
        personaPromptInput.focus();
        return;
    }
    const personaData: { id?: string; name: string; prompt: string } = { name, prompt: promptValue };
    // editingPersonaId is imported
    if ((window as any).editingPersonaId) {
        personaData.id = (window as any).editingPersonaId;
    }
    console.log(`PersonasUI: Saving persona: ${personaData.id ? 'Update ID ' + personaData.id : 'New'} - ${name}`);
    savePersonaButton.disabled = true;
    savePersonaButton.textContent = personaData.id ? 'Updating...' : 'Saving...';
    try {
        const savedPersona = await window.electronAPI.savePersona(personaData);
        if (savedPersona) {
            console.log("PersonasUI: Persona saved successfully", savedPersona);
            clearPersonaFormInternal(); 
            await loadAndDisplayPersonas(); // Call self
            await populatePersonaSelector(); // Call imported from renderer
            showToast(`Persona "${savedPersona.name}" ${personaData.id ? 'updated' : 'saved'} successfully!`, 'success');
        } else {
            showToast("Failed to save persona. The persona might not have been found for update, or an unknown error occurred.", "error");
            console.error("PersonasUI: Save persona returned null or undefined.");
        }
    } catch (error) {
        console.error("PersonasUI: Error saving persona via IPC:", error);
        showToast(`Error saving persona: ${(error as Error).message || 'Unknown error'}`, 'error');
    } finally {
        savePersonaButton.disabled = false;
        // editingPersonaId is imported
        if ((window as any).editingPersonaId) { 
             savePersonaButton.textContent = 'Update Persona';
        } else {
             savePersonaButton.textContent = 'Save Persona';
        }
    }
}

// loadAndDisplayPersonas function, moved from renderer.ts
export async function loadAndDisplayPersonas() {
    if (!personaListDiv) {
        console.error("PersonasUI: Persona list div element not found.");
        return;
    }
    try {
        console.log("PersonasUI: Loading personas...");
        const fetchedPersonas = await window.electronAPI.getPersonas();
        // allPersonas is imported and mutated
        allPersonas.length = 0; // Clear array
        fetchedPersonas.forEach(p => allPersonas.push(p)); // Repopulate
        console.log(`PersonasUI: Loaded ${allPersonas.length} personas.`);
        renderPersonaListInternal();
    } catch (error) {
        console.error("PersonasUI: Error loading personas:", error);
        if (personaListDiv) personaListDiv.innerHTML = '<p class="error-message">Error loading personas.</p>';
    }
}

export function setupPersonaManagementListeners() {
    if (savePersonaButton) {
        savePersonaButton.addEventListener('click', handleSavePersonaInternal);
    }
    if (clearPersonaFormButton) {
        clearPersonaFormButton.addEventListener('click', clearPersonaFormInternal);
    }
}
