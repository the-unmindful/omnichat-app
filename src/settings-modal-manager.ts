// Manages the opening and closing of the main settings modal.
import { settingsModal, messageInput } from './ui-elements';
// loadAndDisplayPersonas will be imported from its new module
import { loadAndDisplayApiKeys } from './settings-api-keys-ui'; 
import { loadAndDisplayEnabledModels } from './settings-enabled-models-ui'; 
import { loadAndDisplayPersonas } from './settings-personas-ui'; // UPDATED import path

export function openSettingsModal() {
    if (settingsModal) {
        settingsModal.style.display = 'flex';
        // Load data for all settings sections when opening
        loadAndDisplayApiKeys();
        loadAndDisplayEnabledModels();
        loadAndDisplayPersonas(); 
        console.log("Settings modal opened (from settings-modal-manager.ts)");
    }
}

export function closeSettingsModal() { 
    if (settingsModal) { 
        settingsModal.style.display = 'none'; 
        console.log("Settings modal closed (from settings-modal-manager.ts)"); 
        if (messageInput) messageInput.focus(); // Focus chat input after closing settings
    }
}
