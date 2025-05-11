import { 
    enabledModelListDiv, 
    addEnabledModelButton,
    enabledModelUserLabelInput, 
    enabledModelProviderSelect, 
    enabledModelIdInput, 
    enabledModelApiKeyLinkSelect,
    // Assuming these will be queryable or added to ui-elements.ts exports
    // For now, we'll get them by ID directly in the function.
    // enabledModelModalitiesText, 
    // enabledModelModalitiesImage 
} from './ui-elements';
import { showToast } from './toast-notifications';
import { ApiKeyEntry, EnabledModelEntry, cachedApiKeys, loadAndPopulateChatModelDropdown } from './renderer'; // Import necessary types, state, and functions

// displayEnabledModels function, moved from renderer.ts
function displayEnabledModelsInSettings(models: EnabledModelEntry[]) {
    if (!enabledModelListDiv) return;
    enabledModelListDiv.innerHTML = ''; 
    if (!models || models.length === 0) {
        enabledModelListDiv.innerHTML = '<p>No models configured yet.</p>'; 
        return;
    }
    // cachedApiKeys is imported from renderer.ts
    const keyMap = new Map(cachedApiKeys.map(key => [key.id, key.label || '(No Label)']));
    models.forEach(model => {
        const modelEntry = document.createElement('div');
        modelEntry.className = 'model-entry';
        modelEntry.setAttribute('data-model-entry-id', model.modelEntryId);
        const linkedKeyLabel = keyMap.get(model.apiKeyId) || 'Unknown Key';
        const modalitiesString = model.expectedOutputModalities && model.expectedOutputModalities.length > 0 
            ? model.expectedOutputModalities.join(', ') 
            : 'text (default)';
        modelEntry.innerHTML = `
            <div class="model-info">
                <span class="model-user-label">${model.userLabel}</span>
                <span class="model-provider-info">(${model.provider})</span>
                <span class="model-id-info">${model.modelId}</span>
                <span class="model-key-link">using key: ${linkedKeyLabel}</span>
                <span class="model-modalities" style="font-size: 0.8em; color: #555;">Modalities: ${modalitiesString}</span>
            </div>
            <div class="model-actions">
                <button class="delete-model-button" title="Delete This Model Configuration">Delete</button>
            </div>
        `;
        enabledModelListDiv.appendChild(modelEntry);
        const deleteModelButton = modelEntry.querySelector('.delete-model-button') as HTMLButtonElement;
        if (deleteModelButton) {
            deleteModelButton.addEventListener('click', () => {
                const actionsDiv = deleteModelButton.parentElement; 
                if (!actionsDiv) return;
                deleteModelButton.style.display = 'none';
                const confirmBtn = document.createElement('button');
                confirmBtn.textContent = '✔️';
                confirmBtn.className = 'confirm-delete-btn';
                confirmBtn.title = 'Confirm Delete';
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = '❌';
                cancelBtn.className = 'cancel-delete-btn';
                cancelBtn.title = 'Cancel Delete';
                const restoreOriginalButtons = () => {
                    confirmBtn.remove();
                    cancelBtn.remove();
                    deleteModelButton.style.display = '';
                };
                confirmBtn.addEventListener('click', async () => {
                    console.log(`EnabledModelsUI: Confirming delete for enabled model ID: ${model.modelEntryId}`);
                    confirmBtn.disabled = true;
                    cancelBtn.disabled = true;
                    try {
                        const success = await window.electronAPI.deleteEnabledModel(model.modelEntryId);
                        if (success) {
                            showToast(`Enabled model "${model.userLabel}" deleted.`, 'success');
                            // Call the main load function (which will be this module's export)
                            loadAndDisplayEnabledModels(); 
                            loadAndPopulateChatModelDropdown(); // Imported from renderer
                        } else {
                            showToast('Failed to delete enabled model.', 'error');
                            restoreOriginalButtons();
                        }
                    } catch (error) {
                        console.error('EnabledModelsUI: Error deleting enabled model:', error);
                        showToast(`Error deleting enabled model: ${(error as Error).message || 'Unknown error'}`, 'error');
                        restoreOriginalButtons();
                    }
                });
                cancelBtn.addEventListener('click', () => {
                    restoreOriginalButtons();
                });
                actionsDiv.appendChild(confirmBtn);
                actionsDiv.appendChild(cancelBtn);
            });
        }
    });
}

// loadAndDisplayEnabledModels function, moved from renderer.ts
export async function loadAndDisplayEnabledModels() {
    console.log("EnabledModelsUI: Requesting enabled models...");
    if (!enabledModelListDiv) return;
    try {
        const models = await window.electronAPI.getEnabledModels();
        console.log("EnabledModelsUI: Received enabled models", models.length);
        displayEnabledModelsInSettings(models); // Call the local display function
    } catch (error) {
        console.error("EnabledModelsUI: Error fetching enabled models:", error);
        if (enabledModelListDiv) enabledModelListDiv.innerHTML = '<p class="error-message">Error loading enabled models.</p>';
    }
}

// setupAddEnabledModelButtonListeners function, logic moved from renderer.ts
export function setupAddEnabledModelButtonListeners() {
    if (addEnabledModelButton && enabledModelUserLabelInput && enabledModelProviderSelect && enabledModelIdInput && enabledModelApiKeyLinkSelect) {
        addEnabledModelButton.addEventListener('click', async () => {
            const userLabel = enabledModelUserLabelInput.value.trim();
            const provider = enabledModelProviderSelect.value;
            const modelId = enabledModelIdInput.value.trim();
            const apiKeyId = enabledModelApiKeyLinkSelect.value;
            if (!userLabel || !provider || !modelId || !apiKeyId) {
                showToast('Please fill in all fields for the enabled model (Name, Provider, Model ID, and linked API Key).', 'error');
                return;
            }

            const modalitiesTextCheckbox = document.getElementById('enabledModelModalitiesText') as HTMLInputElement | null;
            const modalitiesImageCheckbox = document.getElementById('enabledModelModalitiesImage') as HTMLInputElement | null;

            const expectedOutputModalities: Array<'text' | 'image'> = [];
            if (modalitiesTextCheckbox?.checked) {
                expectedOutputModalities.push('text');
            }
            if (modalitiesImageCheckbox?.checked) {
                expectedOutputModalities.push('image');
            }
            // Ensure 'text' is always included if no specific modality is chosen, or if only image is chosen (as text often accompanies image)
            // However, if only 'image' is explicitly chosen, we respect that. If neither, default to text.
            if (expectedOutputModalities.length === 0) {
                expectedOutputModalities.push('text'); // Default to text if nothing selected
            }


            const modelData = { 
                userLabel, 
                provider, 
                modelId, 
                apiKeyId,
                expectedOutputModalities // Add the new property
            };
            console.log(`EnabledModelsUI: Requesting to add enabled model: ${userLabel}, Modalities: ${expectedOutputModalities.join(', ')}`);
            addEnabledModelButton.disabled = true; 
            addEnabledModelButton.textContent = 'Adding...';
            try {
                const success = await window.electronAPI.addEnabledModel(modelData);
                if (success) {
                    console.log(`EnabledModelsUI: Successfully invoked addEnabledModel for ${userLabel}`);
                    enabledModelUserLabelInput.value = '';
                    enabledModelProviderSelect.value = '';
                    enabledModelIdInput.value = '';
                    enabledModelApiKeyLinkSelect.value = '';
                    if (modalitiesTextCheckbox) modalitiesTextCheckbox.checked = true; // Reset to default
                    if (modalitiesImageCheckbox) modalitiesImageCheckbox.checked = false; // Reset to default
                    loadAndDisplayEnabledModels(); // Call local load function
                    loadAndPopulateChatModelDropdown(); // Imported from renderer
                    showToast(`Enabled model "${userLabel}" added successfully.`, 'success');
                } else {
                    showToast('Failed to add enabled model configuration.', 'error');
                    console.warn('EnabledModelsUI: Failed to add enabled model (API returned false).');
                }
            } catch (error) {
                console.error(`EnabledModelsUI: Error invoking addEnabledModel:`, error);
                showToast(`Error adding enabled model: ${(error as Error).message || 'Unknown error'}`, 'error');
            } finally {
                addEnabledModelButton.disabled = false; 
                addEnabledModelButton.textContent = 'Add Enabled Model';
            }
        });
    } else {
        console.warn("EnabledModelsUI: Could not set up Add Enabled Model button listeners - one or more elements missing.");
    }
}
