import { apiKeyListDiv } from './ui-elements';
import { showToast } from './toast-notifications';
// Temporarily import these from renderer until they are also moved
import { loadAndPopulateChatModelDropdown } from './renderer'; 
import { loadAndDisplayEnabledModels } from './settings-enabled-models-ui';
// loadAndDisplayApiKeys is now local to this module. Let's go.

// Assuming ApiKeyEntry is defined in renderer.ts or a shared types file.
// For now, let's duplicate it here if not easily importable, or import from renderer.
// To avoid circular dependencies if renderer also imports from here later,
// it's better if types are separate or this module doesn't import heavy things from renderer.

// Let's assume ApiKeyEntry will be imported or defined globally/shared.
// For this step, we'll rely on it being available.
// If renderer.ts exports ApiKeyEntry, we can import it.
import { ApiKeyEntry, cachedApiKeys } from './renderer'; // Import ApiKeyEntry and mutable cachedApiKeys
import { 
    addApiKeyButton, 
    providerSelect, 
    keyLabelInput, 
    keyValueInput,
    enabledModelApiKeyLinkSelect // Import for populateApiKeyLinkingDropdown
} from './ui-elements';

// Local helper function, moved from renderer.ts
function populateApiKeyLinkingDropdown(keys: ApiKeyEntry[]) {
    if (!enabledModelApiKeyLinkSelect) return;
    while (enabledModelApiKeyLinkSelect.options.length > 1) {
        enabledModelApiKeyLinkSelect.remove(1);
    }
    if (keys.length === 0) {
        enabledModelApiKeyLinkSelect.disabled = true;
        enabledModelApiKeyLinkSelect.options[0].text = "-- No API Keys Available --";
    } else {
        enabledModelApiKeyLinkSelect.disabled = false;
        enabledModelApiKeyLinkSelect.options[0].text = "-- Select API Key to Use --";
        keys.forEach(key => {
            const option = document.createElement('option');
            option.value = key.id; 
            option.textContent = `${key.label || '(No Label)'} (${key.provider})`; 
            enabledModelApiKeyLinkSelect.appendChild(option);
        });
    }
}

// Moved from renderer.ts
export async function loadAndDisplayApiKeys() {
    console.log("APIKeysUI: Requesting API keys...");
    if (!apiKeyListDiv) return;
    try {
        // Directly assign to the imported mutable cachedApiKeys from renderer.ts
        // This is a temporary measure for step-by-step refactoring.
        // Ideally, state management should be handled differently (e.g., return keys and let renderer manage its cache).
        const fetchedKeys = await window.electronAPI.getApiKeys();
        cachedApiKeys.length = 0; // Clear the array
        fetchedKeys.forEach(k => cachedApiKeys.push(k)); // Repopulate
        
        console.log("APIKeysUI: Received API keys", cachedApiKeys.length);
        renderApiKeysList(cachedApiKeys); 
        populateApiKeyLinkingDropdown(cachedApiKeys); 
    } catch (error) {
        console.error("APIKeysUI: Error fetching API keys:", error);
        if (apiKeyListDiv) apiKeyListDiv.innerHTML = '<p class="error-message">Error loading API keys.</p>';
        populateApiKeyLinkingDropdown([]); 
    }
}

export function setupAddApiKeyButtonListeners() {
    if (addApiKeyButton && providerSelect && keyLabelInput && keyValueInput) {
        addApiKeyButton.addEventListener('click', async () => {
            const provider = providerSelect.value; 
            const label = keyLabelInput.value.trim(); 
            const value = keyValueInput.value.trim();
            
            if (!provider || !label || !value) { 
                showToast('Please fill in all API Key fields (Provider, Label, and Value).', 'error'); 
                return; 
            }

            console.log(`APIKeysUI: Requesting save key: ${label}`); 
            addApiKeyButton.disabled = true; 
            addApiKeyButton.textContent = 'Adding...';
            
            try {
                const success = await window.electronAPI.saveApiKey({ provider, label, value });
                if (success) {
                    console.log(`APIKeysUI: Key "${label}" saved.`);
                    showToast(`API Key "${label}" saved successfully.`, 'success');
                    providerSelect.value = ''; 
                    keyLabelInput.value = ''; 
                    keyValueInput.value = '';
                    loadAndDisplayApiKeys(); // Refresh list - imported from renderer
                } else { 
                    showToast('Failed to save API key.', 'error');
                    console.warn('APIKeysUI: Failed to save key (API returned false).'); 
                }
            } catch (error) { 
                console.error('APIKeysUI: Error calling saveApiKey:', error); 
                showToast(`Error saving API key: ${(error as Error).message || 'Unknown error'}`, 'error');
            } finally { 
                addApiKeyButton.disabled = false; 
                addApiKeyButton.textContent = 'Add Key'; 
            }
        });
    } else {
        console.warn("APIKeysUI: Could not set up Add API Key button listeners - one or more elements missing.");
    }
}

export function renderApiKeysList(
    keys: ApiKeyEntry[],
    // Pass electronAPI methods if they are not globally available or for testability
    // For now, assume window.electronAPI is accessible as in renderer.ts
) { 
    if (!apiKeyListDiv) return;
    apiKeyListDiv.innerHTML = '';
    if (!keys || keys.length === 0) {
        apiKeyListDiv.innerHTML = '<p>No keys saved yet.</p>'; 
        return;
    }

    keys.forEach(key => {
        const keyEntry = document.createElement('div');
        keyEntry.className = 'key-entry'; 
        keyEntry.setAttribute('data-key-id', key.id);
        keyEntry.innerHTML = `
            <div class="key-info">
                <span>${key.provider}</span>
                <span>${key.label || '(No Label)'}</span>
                <span class="key-value-masked">[Key Saved]</span>
            </div>
            <div class="key-actions">
                <button class="copy-key-button" title="Copy Key Value">Copy</button>
                <button class="delete-key-button" title="Delete Key">Delete</button>
            </div>
        `;
        apiKeyListDiv.appendChild(keyEntry);

        const copyButton = keyEntry.querySelector('.copy-key-button') as HTMLButtonElement;
        const deleteButton = keyEntry.querySelector('.delete-key-button') as HTMLButtonElement;

        if (copyButton) { 
            copyButton.addEventListener('click', async () => { 
                console.log(`APIKeysUI: Requesting copy for key ID: ${key.id}`); 
                copyButton.disabled = true; 
                const originalText = copyButton.textContent; 
                try { 
                    const success = await window.electronAPI.copyApiKey(key.id); 
                    if (success) { 
                        showToast('API Key copied to clipboard!', 'success', 1500); 
                        copyButton.textContent = 'Copied!'; 
                        setTimeout(() => { if (copyButton) { copyButton.textContent = originalText; copyButton.disabled = false; }}, 1500); 
                    } else { 
                        showToast('Failed to copy API key.', 'error'); 
                        if (copyButton) { copyButton.disabled = false; }
                    } 
                } catch (error) { 
                    console.error('APIKeysUI: Error calling copyApiKey:', error); 
                    showToast(`Error copying API key: ${(error as Error).message || 'Unknown error'}`, 'error'); 
                    if (copyButton) { copyButton.textContent = originalText; copyButton.disabled = false; } 
                }
            });
        }

        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                const actionsDiv = deleteButton.parentElement; 
                if (!actionsDiv) return;
                deleteButton.style.display = 'none';
                
                const confirmBtn = document.createElement('button');
                confirmBtn.textContent = '✔️'; 
                confirmBtn.className = 'confirm-delete-btn'; 
                confirmBtn.title = 'Confirm Delete';
                
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = '❌'; 
                cancelBtn.className = 'cancel-delete-btn'; 
                cancelBtn.title = 'Cancel Delete';

                const restoreOriginalButton = () => {
                    confirmBtn.remove();
                    cancelBtn.remove();
                    deleteButton.style.display = ''; 
                };

                confirmBtn.addEventListener('click', async () => {
                    console.log(`APIKeysUI: Confirming delete for key ID: ${key.id}`);
                    confirmBtn.disabled = true;
                    cancelBtn.disabled = true;
                    try {
                        const success = await window.electronAPI.deleteApiKey(key.id);
                        if (success) {
                            showToast(`API Key "${key.label}" deleted.`, 'success');
                            // These are imported from renderer.ts for now
                            loadAndDisplayApiKeys(); 
                            loadAndDisplayEnabledModels();
                            loadAndPopulateChatModelDropdown();
                        } else {
                            showToast('Failed to delete API key.', 'error');
                            restoreOriginalButton(); 
                        }
                    } catch (error) {
                        console.error('APIKeysUI: Error calling deleteApiKey:', error);
                        showToast(`Error deleting API key: ${(error as Error).message || 'Unknown error'}`, 'error');
                        restoreOriginalButton(); 
                    }
                });

                cancelBtn.addEventListener('click', () => {
                    restoreOriginalButton();
                });

                actionsDiv.appendChild(confirmBtn);
                actionsDiv.appendChild(cancelBtn);
            });
        }
    });
}
