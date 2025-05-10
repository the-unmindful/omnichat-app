import './styles.css';
import { marked } from 'marked'; // Import the marked library

// --- Interface Definitions (Matching preload.ts and index.ts) ---
interface ApiKeyEntry {
    id: string;
    provider: string;
    label: string;
}

interface EnabledModelEntry {
    modelEntryId: string;
    userLabel: string;
    provider: string;
    modelId: string;
    apiKeyId: string;
}

// Simplified structure for the chat model dropdown options
interface AvailableModel {
    modelEntryId: string; // The value of the dropdown option
    displayLabel: string; // The text displayed in the dropdown option
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'error';
    content: string;
    modelUsed?: string; // Optional: track which model config was used (modelEntryId or userLabel)
    id?: string;
}

// Payload sent to main process for chat (uses modelEntryId)
interface ChatPayload {
    modelEntryId: string; // The ID of the configuration to use
    history: ChatMessage[];
}


// --- Type Declaration for Preload API (Updated) ---
declare global {
    interface Window {
        electronAPI: {
            // API Key Management
            saveApiKey: (apiKeyData: { provider: string; label: string; value: string }) => Promise<boolean>;
            getApiKeys: () => Promise<ApiKeyEntry[]>;
            deleteApiKey: (keyId: string) => Promise<boolean>;
            copyApiKey: (keyId: string) => Promise<boolean>;

            // Enabled Model Management
            addEnabledModel: (modelData: Omit<EnabledModelEntry, 'modelEntryId'>) => Promise<boolean>;
            getEnabledModels: () => Promise<EnabledModelEntry[]>;
            deleteEnabledModel: (modelEntryId: string) => Promise<boolean>;

            // Get Models for Chat Dropdown
            getModelsForChatDropdown: () => Promise<AvailableModel[]>; // Gets simplified list

            // Chat Function
            sendChatMessage: (payload: ChatPayload) => Promise<string>;

            // Chat History (Old - to be removed by new session management)
            // saveChatHistory: (history: ChatMessage[]) => Promise<boolean>;
            // loadChatHistory: () => Promise<ChatMessage[]>;

            // NEW Chat Session Management
            createNewChatSession: () => Promise<Partial<ChatSession> | null>;
            loadChatSessionsMetadata: () => Promise<Partial<ChatSession>[]>;
            loadChatSessionMessages: (sessionId: string) => Promise<ChatMessage[]>;
            addMessageToChatSession: (sessionId: string, message: ChatMessage) => Promise<boolean>;
            deleteChatSession: (sessionId: string) => Promise<boolean>;
            updateChatSessionTitle: (sessionId: string, newTitle: string) => Promise<boolean>;

            // Export Chat
            exportChatToFile: (markdownContent: string, suggestedFilename: string) => Promise<{ success: boolean, filePath?: string, error?: string }>;

            // Copy Text to Clipboard
            copyTextToClipboard: (text: string) => Promise<boolean>;
        }
    }
}

// --- NEW Interface (mirror from preload/index if not already here) ---
// Ensure ChatSession is defined if used directly in renderer types,
// or rely on Partial<ChatSession> from preload.
// For clarity, let's add it if it's not present from other snippets.
// Assuming ChatMessage is already defined above.
interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    lastModifiedAt: number;
    messages: ChatMessage[];
}
// Define a type for session metadata, which is what we'll primarily store in the renderer for the list
type ChatSessionMetadata = Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'lastModifiedAt'>;

console.log('👋 Renderer script loaded (Refactored).');

// --- DOM Element References ---

// ## Main Chat UI Elements ##
const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
const chatMessagesDiv = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const chatHeaderModelSpan = document.querySelector('.chat-header span') as HTMLSpanElement;
const exportChatButton = document.getElementById('export-chat-button') as HTMLButtonElement | null; // Added

// ## Sidebar Elements ##
const chatListUl = document.getElementById('chat-list') as HTMLUListElement | null; // Added
const newChatButton = document.getElementById('new-chat-button') as HTMLButtonElement | null; // Added

// ## Settings Modal Elements ##
const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
const openSettingsButton = document.getElementById('open-settings-button');
const closeSettingsButton = document.getElementById('close-settings-button');

// # Settings - API Keys Section #
const addApiKeyButton = document.getElementById('add-api-key-button') as HTMLButtonElement;
const apiKeyListDiv = document.getElementById('api-key-list');
const providerSelect = document.getElementById('api-provider') as HTMLSelectElement;
const keyLabelInput = document.getElementById('api-key-label') as HTMLInputElement;
const keyValueInput = document.getElementById('api-key-value') as HTMLInputElement;

// # Settings - Enabled Models Section #
const addEnabledModelButton = document.getElementById('add-enabled-model-button') as HTMLButtonElement;
const enabledModelListDiv = document.getElementById('enabled-model-list');
const enabledModelUserLabelInput = document.getElementById('enabled-model-user-label') as HTMLInputElement;
const enabledModelProviderSelect = document.getElementById('enabled-model-provider') as HTMLSelectElement;
const enabledModelIdInput = document.getElementById('enabled-model-id') as HTMLInputElement;
const enabledModelApiKeyLinkSelect = document.getElementById('enabled-model-api-key-link') as HTMLSelectElement;


// --- State Variables ---
let currentSelectedModelEntryId: string | null = null; // Store the ID of the selected enabled model config
// let conversationHistory: ChatMessage[] = []; // OLD: This will be replaced by currentConversationMessages
let cachedApiKeys: ApiKeyEntry[] = []; // Cache keys for populating dropdowns

// NEW State Variables for Multi-Session Management
let allSessionsMetadata: ChatSessionMetadata[] = [];
let activeSessionId: string | null = null;
let currentConversationMessages: ChatMessage[] = []; // Holds messages for the activeSessionId


// --- API Key Management Logic (Mostly Unchanged) ---

async function loadAndDisplayApiKeys() {
    console.log("Renderer: Requesting API keys...");
    if (!apiKeyListDiv) return;
    try {
        cachedApiKeys = await window.electronAPI.getApiKeys(); // Store keys in cache
        console.log("Renderer: Received API keys", cachedApiKeys.length);
        displayApiKeys(cachedApiKeys);
        populateApiKeyLinkingDropdown(cachedApiKeys); // Populate the linking dropdown too
    } catch (error) {
        console.error("Renderer: Error fetching API keys:", error);
        apiKeyListDiv.innerHTML = '<p class="error-message">Error loading API keys.</p>';
        populateApiKeyLinkingDropdown([]); // Populate with empty state
    }
}

function displayApiKeys(keys: ApiKeyEntry[]) { // Displays keys in the settings list
    if (!apiKeyListDiv) return;
    apiKeyListDiv.innerHTML = '';
    if (!keys || keys.length === 0) {
        apiKeyListDiv.innerHTML = '<p>No keys saved yet.</p>'; return;
    }
    keys.forEach(key => {
        const keyEntry = document.createElement('div');
        keyEntry.className = 'key-entry'; keyEntry.setAttribute('data-key-id', key.id);
        keyEntry.innerHTML = `...`; // Existing innerHTML for key display
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
        // Add event listeners (copy/delete - existing logic)
        const copyButton = keyEntry.querySelector('.copy-key-button') as HTMLButtonElement;
        const deleteButton = keyEntry.querySelector('.delete-key-button') as HTMLButtonElement;
        if (copyButton) { copyButton.addEventListener('click', async () => { /* ... copy logic ... */
             console.log(`Renderer: Requesting copy for key ID: ${key.id}`); copyButton.disabled = true; const originalText = copyButton.textContent; try { const success = await window.electronAPI.copyApiKey(key.id); if (success) { copyButton.textContent = 'Copied!'; setTimeout(() => { if (copyButton) { copyButton.textContent = originalText; copyButton.disabled = false; }}, 1500); } else { alert('Failed to copy key.'); if (copyButton) { copyButton.disabled = false; }} } catch (error) { console.error('Renderer: Error calling copyApiKey:', error); alert('Error copying key.'); if (copyButton) { copyButton.textContent = originalText; copyButton.disabled = false; } }
         });}
        if (deleteButton) { deleteButton.addEventListener('click', async () => { /* ... delete logic ... */
             if (!confirm(`Are you sure you want to delete the key "${key.label}"? This will also affect enabled models using this key.`)) return;
             console.log(`Renderer: Requesting delete for key ID: ${key.id}`); deleteButton.disabled = true;
             try {
                 const success = await window.electronAPI.deleteApiKey(key.id);
                 if (success) {
                     console.log(`Renderer: Key ID ${key.id} deleted.`);
                     // Refresh both key list and enabled models list as deletion affects linking
                     loadAndDisplayApiKeys();
                     loadAndDisplayEnabledModels();
                     // Also refresh chat dropdown in case models were removed
                     loadAndPopulateChatModelDropdown();
                 } else { alert('Failed to delete key.'); if (deleteButton) { deleteButton.disabled = false; } }
             } catch (error) { console.error('Renderer: Error calling deleteApiKey:', error); alert('Error deleting key.'); if (deleteButton) { deleteButton.disabled = false; } }
         });}
    });
}

// --- Enabled Model Management Logic (NEW) ---

// Populates the dropdown used to link an enabled model to an API key
function populateApiKeyLinkingDropdown(keys: ApiKeyEntry[]) {
    if (!enabledModelApiKeyLinkSelect) return;
    // Clear existing options except placeholder
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
            option.value = key.id; // Store the key's unique ID
            option.textContent = `${key.label || '(No Label)'} (${key.provider})`; // Display label & provider
            enabledModelApiKeyLinkSelect.appendChild(option);
        });
    }
}

// Fetches and displays the list of configured/enabled models in settings
async function loadAndDisplayEnabledModels() {
    console.log("Renderer: Requesting enabled models...");
    if (!enabledModelListDiv) return;
    try {
        const models = await window.electronAPI.getEnabledModels();
        console.log("Renderer: Received enabled models", models.length);
        displayEnabledModels(models);
    } catch (error) {
        console.error("Renderer: Error fetching enabled models:", error);
        enabledModelListDiv.innerHTML = '<p class="error-message">Error loading enabled models.</p>';
    }
}

// Renders the list of enabled models in the settings UI
function displayEnabledModels(models: EnabledModelEntry[]) {
    if (!enabledModelListDiv) return;
    enabledModelListDiv.innerHTML = ''; // Clear list
    if (!models || models.length === 0) {
        enabledModelListDiv.innerHTML = '<p>No models configured yet.</p>'; return;
    }

    // Get key labels for display purposes
    const keyMap = new Map(cachedApiKeys.map(key => [key.id, key.label || '(No Label)']));

    models.forEach(model => {
        const modelEntry = document.createElement('div');
        modelEntry.className = 'model-entry';
        modelEntry.setAttribute('data-model-entry-id', model.modelEntryId);

        const linkedKeyLabel = keyMap.get(model.apiKeyId) || 'Unknown Key';

        modelEntry.innerHTML = `
            <div class="model-info">
                <span class="model-user-label">${model.userLabel}</span>
                <span class="model-provider-info">(${model.provider})</span>
                <span class="model-id-info">${model.modelId}</span>
                <span class="model-key-link">using key: ${linkedKeyLabel}</span>
            </div>
            <div class="model-actions">
                <button class="delete-model-button" title="Delete This Model Configuration">Delete</button>
            </div>
        `;
        enabledModelListDiv.appendChild(modelEntry);

        // Add delete listener for this model entry
        const deleteModelButton = modelEntry.querySelector('.delete-model-button') as HTMLButtonElement;
        if (deleteModelButton) {
            deleteModelButton.addEventListener('click', async () => {
                if (!confirm(`Are you sure you want to delete the enabled model configuration "${model.userLabel}"?`)) return;
                console.log(`Renderer: Requesting delete for enabled model ID: ${model.modelEntryId}`);
                deleteModelButton.disabled = true;
                try {
                    const success = await window.electronAPI.deleteEnabledModel(model.modelEntryId);
                    if (success) {
                        console.log(`Renderer: Enabled model ID ${model.modelEntryId} deleted.`);
                        modelEntry.remove(); // Remove from UI
                        if (enabledModelListDiv.children.length === 0) {
                            enabledModelListDiv.innerHTML = '<p>No models configured yet.</p>';
                        }
                         // Refresh chat dropdown in case this model was removed
                         loadAndPopulateChatModelDropdown();
                    } else {
                        alert('Failed to delete enabled model configuration.');
                        if (deleteModelButton) { deleteModelButton.disabled = false; }
                    }
                } catch (error) {
                    console.error('Renderer: Error deleting enabled model:', error);
                    alert('Error deleting enabled model configuration.');
                    if (deleteModelButton) { deleteModelButton.disabled = false; }
                }
            });
        }
    });
}


// --- Settings Modal Logic (Modified) ---

function openSettingsModal() {
    if (settingsModal) {
        settingsModal.style.display = 'flex';
        // Load both keys and enabled models when opening
        loadAndDisplayApiKeys();
        loadAndDisplayEnabledModels();
        console.log("Settings modal opened");
    }
}

function closeSettingsModal() { // Unchanged
    if (settingsModal) { settingsModal.style.display = 'none'; console.log("Settings modal closed"); }
}

// Event Listeners for modal open/close (Unchanged)
if (openSettingsButton) { openSettingsButton.addEventListener('click', openSettingsModal); }
if (closeSettingsButton) { closeSettingsButton.addEventListener('click', closeSettingsModal); }
window.addEventListener('click', (event) => { if (event.target === settingsModal) { closeSettingsModal(); }});


// Event Listener for Add API Key Button (Modified to refresh model dropdowns)
if (addApiKeyButton) {
    addApiKeyButton.addEventListener('click', async () => {
        const provider = providerSelect.value; const label = keyLabelInput.value.trim(); const value = keyValueInput.value.trim();
        if (!provider || !label || !value) { alert('Please fill in all API Key fields.'); return; }
        console.log(`Renderer: Requesting save key: ${label}`); addApiKeyButton.disabled = true; addApiKeyButton.textContent = 'Adding...';
        try {
            const success = await window.electronAPI.saveApiKey({ provider, label, value });
            if (success) {
                console.log(`Renderer: Key "${label}" saved.`);
                providerSelect.value = ''; keyLabelInput.value = ''; keyValueInput.value = '';
                loadAndDisplayApiKeys(); // Refresh API key list AND the linking dropdown
            } else { alert('Failed to save key.'); }
        } catch (error) { console.error('Renderer: Error calling saveApiKey:', error); alert(`Error saving key: ${error}`); }
        finally { addApiKeyButton.disabled = false; addApiKeyButton.textContent = 'Add Key'; }
    });
}


// Event Listener for Add Enabled Model Button (NEW)
if (addEnabledModelButton) {
    addEnabledModelButton.addEventListener('click', async () => {
        const userLabel = enabledModelUserLabelInput.value.trim();
        const provider = enabledModelProviderSelect.value;
        const modelId = enabledModelIdInput.value.trim();
        const apiKeyId = enabledModelApiKeyLinkSelect.value;

        if (!userLabel || !provider || !modelId || !apiKeyId) {
            alert('Please fill in all fields for the enabled model (Name, Provider, Model ID, API Key).');
            return;
        }

        const modelData = { userLabel, provider, modelId, apiKeyId };
        console.log(`Renderer: Requesting to add enabled model: ${userLabel}`);
        addEnabledModelButton.disabled = true; addEnabledModelButton.textContent = 'Adding...';

        try {
            console.log('Renderer: Preparing to add model with data:', modelData);
            const success = await window.electronAPI.addEnabledModel(modelData);
            if (success) {
                console.log(`Renderer: Successfully invoked addEnabledModel for ${userLabel}`);
                 // Clear form
                 enabledModelUserLabelInput.value = '';
                 enabledModelProviderSelect.value = '';
                 enabledModelIdInput.value = '';
                 enabledModelApiKeyLinkSelect.value = '';
                 // Refresh lists
                 loadAndDisplayEnabledModels();
                 loadAndPopulateChatModelDropdown(); // Refresh chat dropdown too
            } else {
                 alert('Failed to add enabled model configuration.');
            }
        } catch (error) {
            console.error(`Renderer: Error invoking addEnabledModel:`, error);
             alert(`Error adding enabled model: ${error}`);
        } finally {
             addEnabledModelButton.disabled = false; addEnabledModelButton.textContent = 'Add Enabled Model';
        }
    });
}


// --- Model Selection Logic (Refactored for Chat Dropdown) ---

async function loadAndPopulateChatModelDropdown() {
    console.log('Renderer: Requesting models for chat dropdown...');
    if (!modelSelector) return;
    try {
        // Call the new IPC function
        const modelsForDropdown = await window.electronAPI.getModelsForChatDropdown();
        console.log('Renderer: Received models for dropdown', modelsForDropdown.length);

        // Clear existing options (except the default placeholder)
        while (modelSelector.options.length > 1) { modelSelector.remove(1); }

        if (modelsForDropdown.length === 0) {
            modelSelector.disabled = true;
            modelSelector.options[0].text = "-- No Models Configured --";
             updateChatHeaderModelLabel(null); // Update header span
        } else {
            modelSelector.disabled = false;
            modelSelector.options[0].text = "-- Select Model --";
            modelsForDropdown.forEach(model => {
                const option = document.createElement('option');
                // Value is the unique ID of the EnabledModelEntry
                option.value = model.modelEntryId;
                // Text is the user-friendly display label
                option.textContent = model.displayLabel;
                modelSelector.appendChild(option);
            });
             updateChatHeaderModelLabel(null); // Wait for user selection
        }
    } catch (error) {
        console.error('Renderer: Error fetching models for chat dropdown:', error);
        modelSelector.disabled = true;
        modelSelector.options[0].text = "-- Error Loading Models --";
         updateChatHeaderModelLabel(null);
    }
}

// Update the chat header span based on selected dropdown option's text
function updateChatHeaderModelLabel(selectedOptionText: string | null) {
    if (!chatHeaderModelSpan) return;
    if (selectedOptionText) {
        chatHeaderModelSpan.textContent = `Model: ${selectedOptionText}`;
        chatHeaderModelSpan.title = `Using configuration: ${selectedOptionText}`; // Simple title
    } else {
        chatHeaderModelSpan.textContent = `No Model Selected`;
        chatHeaderModelSpan.title = '';
    }
}

// Event listener for when the user changes the model selection in chat UI
if (modelSelector) {
    modelSelector.addEventListener('change', () => {
        currentSelectedModelEntryId = modelSelector.value || null; // Store the modelEntryId
        const selectedOptionText = modelSelector.value ? modelSelector.options[modelSelector.selectedIndex].text : null;
        console.log(`Renderer: Chat model selection changed to Entry ID: ${currentSelectedModelEntryId} (Label: ${selectedOptionText})`);
         updateChatHeaderModelLabel(selectedOptionText); // Update header with the display label
    });
}


// --- Chat Message Display Logic (Mostly Unchanged) ---

async function addMessageToChat(message: ChatMessage) { // Made async
    if (!chatMessagesDiv) return;

    // Create the main chat entry wrapper
    const chatEntryDiv = document.createElement('div');
    chatEntryDiv.classList.add('chat-entry', message.role); // e.g., chat-entry assistant

    // Create the message bubble itself
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', message.role); // e.g., message assistant
    if (message.id) { messageElement.id = message.id; }
    
    chatEntryDiv.appendChild(messageElement); // Add bubble to entry

    try {
        // Use marked to parse Markdown content.
        // Note: For production, if markdown can come from untrusted user input,
        // consider using a sanitizer like DOMPurify on the output of marked.parse().
        // e.g., import DOMPurify from 'dompurify'; const cleanHtml = DOMPurify.sanitize(await marked.parse(message.content));
        // For now, directly using marked.parse() as content is from API or user's own input to API.
        const htmlContent = await marked.parse(message.content || ''); // Ensure content is not undefined, and await
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content'; // For main content
        contentDiv.innerHTML = htmlContent; // Set the rendered HTML
        messageElement.appendChild(contentDiv);

        // Add model label for assistant messages, now as a sibling to the message bubble, inside chatEntryDiv
        if (message.role === 'assistant' && message.modelUsed) {
            const modelLabelDiv = document.createElement('div');
            modelLabelDiv.className = 'model-label-outside'; // New class
            modelLabelDiv.textContent = `Model: ${message.modelUsed}`;
            chatEntryDiv.appendChild(modelLabelDiv); // Append to chatEntryDiv
        }

        // Add copy button for assistant messages (and potentially user messages if desired later)
        if (message.role === 'assistant') { // Or message.role === 'user'
            const copyButton = document.createElement('button');
            copyButton.innerHTML = '📋'; // Clipboard emoji or an SVG icon
            copyButton.className = 'copy-message-button';
            copyButton.title = 'Copy Q&A';
            
            // Find the index of the current message to locate the pair
            // This assumes currentConversationMessages is up-to-date when addMessageToChat is called
            // For new messages, they are pushed before addMessageToChat is called.
            // For messages loaded from history (selectChatSession), currentConversationMessages is populated first.
            const messageIndex = currentConversationMessages.findIndex(m => m === message);

            if (messageIndex !== -1) {
                copyButton.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent any parent click listeners
                    await handleCopyMessagePair(messageIndex, copyButton);
                });
                // Append copy button inside the message bubble, or to chatEntryDiv for outside placement
                messageElement.appendChild(copyButton); // Placing inside bubble for now
            }
        }

    } catch (error) {
        console.error("Error processing message content:", error);
        // Fallback for content processing error
        const errorContentDiv = document.createElement('div');
        errorContentDiv.className = 'message-content';
        errorContentDiv.textContent = `[Error displaying message] ${message.content}`;
        // Ensure this error content still goes into the messageElement (bubble)
        messageElement.innerHTML = ''; // Clear any partial content
        messageElement.appendChild(errorContentDiv);

        // Still add model label if available, even on content error
        if (message.role === 'assistant' && message.modelUsed) {
             const modelLabelDiv = document.createElement('div');
             modelLabelDiv.className = 'model-label-outside'; // New class
             modelLabelDiv.textContent = `Model: ${message.modelUsed}`;
             chatEntryDiv.appendChild(modelLabelDiv); // Append to chatEntryDiv
        }
        // Also add copy button in error case if it's an assistant message
        if (message.role === 'assistant') {
            const copyButton = document.createElement('button');
            copyButton.innerHTML = '📋';
            copyButton.className = 'copy-message-button';
            copyButton.title = 'Copy Q&A';
            const messageIndex = currentConversationMessages.findIndex(m => m === message);
            if (messageIndex !== -1) {
                copyButton.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await handleCopyMessagePair(messageIndex, copyButton);
                });
                messageElement.appendChild(copyButton);
            }
        }
    }

    chatMessagesDiv.appendChild(chatEntryDiv); // Append the whole entry
    if (chatMessagesDiv.contains(chatEntryDiv)) { chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; }
}

// --- Copy Message Pair Logic ---
async function handleCopyMessagePair(assistantMessageIndex: number, buttonElement: HTMLButtonElement) {
    if (assistantMessageIndex < 0 || assistantMessageIndex >= currentConversationMessages.length) {
        console.error("Invalid message index for copy:", assistantMessageIndex);
        return;
    }

    const assistantMsg = currentConversationMessages[assistantMessageIndex];
    if (assistantMsg.role !== 'assistant') {
        console.warn("Copy Q&A called on non-assistant message. Index:", assistantMessageIndex);
        return;
    }

    // Find the preceding user message
    let userMsg: ChatMessage | null = null;
    for (let i = assistantMessageIndex - 1; i >= 0; i--) {
        if (currentConversationMessages[i].role === 'user') {
            userMsg = currentConversationMessages[i];
            break;
        }
    }

    if (!userMsg) {
        // If no preceding user message, just copy the assistant message
        console.log("No preceding user message found, copying assistant message only.");
        let textToCopy = `**Assistant (Model: ${assistantMsg.modelUsed || 'Unknown'})**:\n\n${assistantMsg.content}`;
        const success = await window.electronAPI.copyTextToClipboard(textToCopy);
        if (success) {
            const originalText = buttonElement.innerHTML;
            buttonElement.innerHTML = 'Copied!';
            setTimeout(() => { buttonElement.innerHTML = originalText; }, 1500);
        } else {
            alert("Failed to copy message.");
        }
        return;
    }

    // Format Q&A pair
    let textToCopy = `**User:**\n\n${userMsg.content}\n\n---\n\n`;
    textToCopy += `**Assistant (Model: ${assistantMsg.modelUsed || 'Unknown'})**:\n\n${assistantMsg.content}`;

    try {
        const success = await window.electronAPI.copyTextToClipboard(textToCopy);
        if (success) {
            const originalText = buttonElement.innerHTML;
            buttonElement.innerHTML = 'Copied!';
            buttonElement.disabled = true;
            setTimeout(() => {
                buttonElement.innerHTML = originalText;
                buttonElement.disabled = false;
            }, 1500);
        } else {
            alert("Failed to copy Q&A to clipboard.");
        }
    } catch (error) {
        console.error("Error copying Q&A to clipboard:", error);
        alert("An error occurred while copying.");
    }
}


function removeMessageById(id: string) { /* ... existing implementation ... */
     const messageElement = document.getElementById(id); if (messageElement) { messageElement.remove(); }
}


// --- Send Message Logic (Refactored) ---

async function handleSendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;

    if (!currentSelectedModelEntryId) {
        alert("Please select a configured model from the dropdown first.");
        return;
    }

    // If no active chat, create one first
    if (!activeSessionId) {
        const newSession = await handleNewChatButtonClick();
        if (!newSession || !newSession.id) { // Check if new session creation was successful
            alert("Could not create a new chat session. Please try again.");
            sendButton.disabled = false; sendButton.textContent = 'Send';
            return;
        }
        // selectChatSession would have set activeSessionId and prepared currentConversationMessages
    }

    // Ensure activeSessionId is set before proceeding
    if (!activeSessionId) {
        alert("No active chat session. Please create or select a chat.");
        sendButton.disabled = false; sendButton.textContent = 'Send';
        return;
    }

    messageInput.value = ''; sendButton.disabled = true; sendButton.textContent = 'Sending...';

    const userMessage: ChatMessage = { role: 'user', content: messageText };
    // Add to local state first for immediate UI update
    currentConversationMessages.push(userMessage);
    addMessageToChat(userMessage);

    // Then, persist to the backend for the active session
    try {
        await window.electronAPI.addMessageToChatSession(activeSessionId, userMessage);
        // If this is the first message, the title might have changed in the backend.
        // Refresh the session list to get the new title.
        if (currentConversationMessages.length === 1) { // Only user message so far
            const sessionToUpdate = allSessionsMetadata.find(s => s.id === activeSessionId);
            if (sessionToUpdate && sessionToUpdate.title.startsWith('New Chat')) { // Check if title was generic
                 // Re-fetch metadata for this specific session or all sessions to get updated title
                const updatedMetadatas = await window.electronAPI.loadChatSessionsMetadata();
                allSessionsMetadata = updatedMetadatas.map(s => ({id: s.id!, title: s.title!, createdAt: s.createdAt!, lastModifiedAt: s.lastModifiedAt!}));
                renderChatList(); // Re-render to show new title
            }
        }
    } catch (error) {
        console.error(`Renderer: Error saving user message to session ${activeSessionId}:`, error);
        // Optionally revert UI change or show error
    }

    const thinkingMessageId = `thinking-${Date.now()}`;
    addMessageToChat({ role: 'assistant', content: '...', id: thinkingMessageId });

    // Prepare payload using the selected modelEntryId
    const payload: ChatPayload = {
        modelEntryId: currentSelectedModelEntryId, // Send the unique ID of the config
        history: [...currentConversationMessages], // Use new state variable
    };

    console.log(`Renderer: Sending message using Enabled Model Entry ID: ${payload.modelEntryId} for session ${activeSessionId}`);
    try {
        const assistantResponseContent = await window.electronAPI.sendChatMessage(payload);
        removeMessageById(thinkingMessageId);

        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: assistantResponseContent,
            modelUsed: modelSelector.options[modelSelector.selectedIndex]?.text || 'Unknown Model Config'
        };
        currentConversationMessages.push(assistantMessage);
        addMessageToChat(assistantMessage);

        // Persist assistant message to the backend for the active session
        if (activeSessionId) { // Should always be true here
            try {
                await window.electronAPI.addMessageToChatSession(activeSessionId, assistantMessage);
                // Update lastModifiedAt for the active session in allSessionsMetadata and re-sort/re-render
                const sessionMeta = allSessionsMetadata.find(s => s.id === activeSessionId);
                if (sessionMeta) {
                    sessionMeta.lastModifiedAt = Date.now();
                    allSessionsMetadata.sort((a, b) => b.lastModifiedAt - a.lastModifiedAt); // Re-sort
                    renderChatList(); // Re-render to reflect new order and potentially updated timestamp display
                }
            } catch (error) {
                console.error(`Renderer: Error saving assistant message to session ${activeSessionId}:`, error);
            }
        }

    } catch (error) {
        console.error("Renderer: Error receiving chat response:", error);
        removeMessageById(thinkingMessageId);
        addMessageToChat({ role: 'error', content: `Error: ${error.message || 'Failed to get response.'}` });
    } finally {
        sendButton.disabled = false; sendButton.textContent = 'Send'; messageInput.focus();
    }
}

// Event listeners for sending (Unchanged)
if (sendButton) { sendButton.addEventListener('click', handleSendMessage); }
if (messageInput) {
    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSendMessage(); }
    });
}


// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    // Load the models available for chatting when the app starts/reloads
    loadAndPopulateChatModelDropdown();

    // --- Load Chat History --- // OLD - This section will be replaced
    // try {
    //     console.log("Renderer: Attempting to load chat history...");
    //     const loadedHistory = await window.electronAPI.loadChatHistory();
    //     if (loadedHistory && loadedHistory.length > 0) {
    //         conversationHistory = loadedHistory; // Update the state variable
    //         if (chatMessagesDiv) chatMessagesDiv.innerHTML = '';
    //         conversationHistory.forEach(message => addMessageToChat(message));
    //         console.log(`Renderer: Loaded ${loadedHistory.length} messages from history.`);
    //     } else {
    //         console.log("Renderer: No chat history found or history is empty.");
    //     }
    // } catch (error) {
    //     console.error("Renderer: Error loading chat history:", error);
    //     addMessageToChat({ role: 'error', content: 'Could not load previous chat history.' });
    // }
    // --- End Load Chat History ---

    // NEW: Load chat sessions metadata on startup
    await loadAndDisplayChatSessions();
});

// --- Chat Session Management UI Functions ---

async function loadAndDisplayChatSessions() {
    if (!chatListUl) {
        console.error("Chat list UL element not found.");
        return;
    }
    try {
        console.log("Renderer: Loading chat sessions metadata...");
        const sessions = await window.electronAPI.loadChatSessionsMetadata();
        allSessionsMetadata = sessions.map(s => ({ // Ensure we are using the Partial<ChatSession> correctly
            id: s.id!, // Assuming id is always present from metadata
            title: s.title!, // Assuming title is always present
            createdAt: s.createdAt!,
            lastModifiedAt: s.lastModifiedAt!
        }));
        renderChatList();
        // Optionally, auto-select the most recent session if any exist
        if (allSessionsMetadata.length > 0) {
            // The list is sorted by lastModifiedAt descending by the main process
            await selectChatSession(allSessionsMetadata[0].id);
        } else {
            // No sessions, clear main chat area and set placeholder
            if (chatMessagesDiv) chatMessagesDiv.innerHTML = '<div class="message system">No chats yet. Start a new one!</div>';
            currentConversationMessages = [];
            activeSessionId = null;
        }
    } catch (error) {
        console.error("Renderer: Error loading chat sessions metadata:", error);
        if (chatListUl) chatListUl.innerHTML = '<li>Error loading chats.</li>';
    }
}

function renderChatList() {
    if (!chatListUl) return;
    chatListUl.innerHTML = ''; // Clear existing list

    if (allSessionsMetadata.length === 0) {
        chatListUl.innerHTML = '<li>(No chats yet)</li>';
        return;
    }

    allSessionsMetadata.forEach(sessionMeta => {
        const li = document.createElement('li');
        li.textContent = sessionMeta.title || 'Untitled Chat';
        li.setAttribute('data-session-id', sessionMeta.id);
        if (sessionMeta.id === activeSessionId) {
            li.classList.add('active');
        }

        // Augment HTMLLIElement to store a custom property for the click timeout
        type ListItemWithTimeout = HTMLLIElement & { _clickTimeoutId?: number };

        (li as ListItemWithTimeout)._clickTimeoutId = undefined;

        // Click to select session (with delay to allow for dblclick)
        li.addEventListener('click', () => {
            const currentLi = li as ListItemWithTimeout;
            if (currentLi.querySelector('input.rename-chat-input')) {
                console.log("Renderer: Click ignored, rename in progress.");
                return; // Already renaming, don't process click for selection
            }
            if (currentLi._clickTimeoutId) { 
                clearTimeout(currentLi._clickTimeoutId); // Clear previous timeout if rapid clicks
            }
            currentLi._clickTimeoutId = window.setTimeout(() => {
                console.log(`Renderer: Single click timeout fired for session ID: ${sessionMeta.id}`);
                selectChatSession(sessionMeta.id);
                currentLi._clickTimeoutId = undefined; 
            }, 250); // Adjust delay as needed (200-300ms is typical for dblclick)
        });

        // Double-click to rename session
        li.addEventListener('dblclick', () => {
            const currentLi = li as ListItemWithTimeout;
            if (currentLi._clickTimeoutId) {
                clearTimeout(currentLi._clickTimeoutId); // Crucial: cancel the pending single click
                currentLi._clickTimeoutId = undefined;
                console.log(`Renderer: DBLCLICK - Cleared single click timeout for session ID: ${sessionMeta.id}`);
            }
            
            console.log(`Renderer: DBLCLICK processing for session ID: ${sessionMeta.id}, Title: "${sessionMeta.title}"`);
            if (currentLi.querySelector('input.rename-chat-input')) {
                console.log("Renderer: Already in rename mode, exiting dblclick handler.");
                return; 
            }
            const currentTitle = sessionMeta.title;
            console.log("Renderer: currentTitle for rename:", currentTitle);

            // Hide existing text content and delete button temporarily
            const childNodes = Array.from(li.childNodes);
            childNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    (node as HTMLElement).style.display = 'none';
                } else if (node.nodeType === Node.TEXT_NODE) {
                    node.textContent = '';
                }
            });

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentTitle;
            input.className = 'rename-chat-input';
            console.log("Renderer: Rename input created.");

            let inputActive = true; // To manage state and prevent multiple calls

            const finishRename = async (saveIntent: boolean) => {
                if (!inputActive) return;
                inputActive = false; 
                console.log(`Renderer: finishRename called. saveIntent: ${saveIntent}`);

                const newTitle = input.value.trim();
                input.remove(); // Remove input from DOM first

                // Restore visibility of original children (delete button)
                // This will be overwritten by renderChatList if save is successful or if just restoring text
                childNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        (node as HTMLElement).style.display = '';
                    } else if (node.nodeType === Node.TEXT_NODE && node !== input) { // Restore original text if needed
                        // This part is tricky because renderChatList will handle it.
                        // For now, let renderChatList handle full restoration.
                    }
                });


                if (saveIntent && newTitle && newTitle !== currentTitle) {
                    console.log(`Renderer: Attempting to save rename. New title: "${newTitle}"`);
                    try {
                        const success = await window.electronAPI.updateChatSessionTitle(sessionMeta.id, newTitle);
                        if (success) {
                            console.log("Renderer: IPC updateChatSessionTitle successful.");
                            const metaToUpdate = allSessionsMetadata.find(s => s.id === sessionMeta.id);
                            if (metaToUpdate) {
                                metaToUpdate.title = newTitle;
                                metaToUpdate.lastModifiedAt = Date.now();
                            }
                            allSessionsMetadata.sort((a, b) => b.lastModifiedAt - a.lastModifiedAt);
                        } else {
                            console.warn("Renderer: IPC updateChatSessionTitle returned false.");
                            alert('Failed to rename chat session.');
                        }
                    } catch (error) {
                        console.error('Renderer: Error renaming session via IPC:', error);
                        alert('Error renaming session.');
                    }
                } else {
                    console.log("Renderer: Rename cancelled or title unchanged/empty.");
                }
                // Always re-render the list to ensure consistency and proper element structure
                renderChatList();
            };

            input.addEventListener('blur', () => {
                console.log("Renderer: Rename input blurred.");
                // setTimeout to allow click on potential save button (if we add one)
                // or to ensure keydown (Enter) processes before blur.
                setTimeout(() => { 
                    if (inputActive) finishRename(true); // Attempt save on blur
                }, 100); // Small delay
            });

            input.addEventListener('keydown', (e: KeyboardEvent) => {
                console.log(`Renderer: Keydown in rename input: ${e.key}`);
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (inputActive) finishRename(true); 
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    if (inputActive) finishRename(false);
                }
            });
            
            // Insert input before the delete button if it exists
            const deleteBtn = li.querySelector('.delete-chat-button');
            if (deleteBtn) {
                li.insertBefore(input, deleteBtn);
            } else {
                li.appendChild(input);
            }
            
            setTimeout(() => { // Use setTimeout to ensure focus after current event cycle
                input.focus();
                input.select();
                console.log("Renderer: Rename input appended and focused.");
            },0);
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️'; // Use an emoji or text
        deleteButton.classList.add('delete-chat-button');
        deleteButton.setAttribute('title', 'Delete Chat');
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent li click event from firing
            handleDeleteChatSession(sessionMeta.id); 
        });
        li.appendChild(deleteButton);

        chatListUl.appendChild(li);
    });
}

async function selectChatSession(sessionId: string) {
    if (!sessionId) return;
    console.log(`Renderer: Selecting chat session ${sessionId}`);
    try {
        const messages = await window.electronAPI.loadChatSessionMessages(sessionId);
        currentConversationMessages = messages;
        activeSessionId = sessionId;

        if (chatMessagesDiv) {
            chatMessagesDiv.innerHTML = ''; // Clear previous messages
            if (currentConversationMessages.length === 0) {
                // Could be a new chat or an empty loaded one
                addMessageToChat({role: 'system', content: 'This chat is empty. Send a message to start!'});
            } else {
                currentConversationMessages.forEach(msg => addMessageToChat(msg));
            }
        }
        
        // Update active class in sidebar
        renderChatList(); // Re-render to update active class, or more efficiently:
        // const items = chatListUl?.querySelectorAll('li');
        // items?.forEach(item => {
        //     if (item.getAttribute('data-session-id') === sessionId) {
        //         item.classList.add('active');
        //     } else {
        //         item.classList.remove('active');
        //     }
        // });

    } catch (error) {
        console.error(`Renderer: Error loading messages for session ${sessionId}:`, error);
        if (chatMessagesDiv) chatMessagesDiv.innerHTML = `<div class="message error">Error loading chat: ${error.message}</div>`;
    }
}

// Placeholder for delete function - to be implemented
async function handleDeleteChatSession(sessionId: string) {
    if (!sessionId) return;
    if (!confirm(`Are you sure you want to delete this chat session? This action cannot be undone.`)) {
        return;
    }

    console.log(`Renderer: Attempting to delete session ${sessionId}`);
    try {
        const success = await window.electronAPI.deleteChatSession(sessionId);
        if (success) {
            console.log(`Renderer: Session ${sessionId} deleted successfully.`);
            // Refresh the entire list and state
            await loadAndDisplayChatSessions(); 
            
            // If the deleted session was the active one, clear the chat view
            // loadAndDisplayChatSessions will try to select the new top one if available
            // or set to empty state if no chats are left.
            if (activeSessionId === sessionId) {
                // The loadAndDisplayChatSessions function already handles selecting a new
                // session or setting an empty state if no sessions are left.
                // So, no explicit action might be needed here unless specific behavior is desired.
                console.log(`Renderer: Active session ${sessionId} was deleted.`);
            }
        } else {
            alert("Failed to delete the chat session. Please try again.");
        }
    } catch (error) {
        console.error(`Renderer: Error deleting session ${sessionId}:`, error);
        alert(`Error deleting chat: ${error.message}`);
    }
}

async function handleNewChatButtonClick(): Promise<ChatSessionMetadata | null> {
    console.log("Renderer: New Chat button clicked.");
    try {
        const newSessionMetadataPartial = await window.electronAPI.createNewChatSession();
        if (newSessionMetadataPartial && newSessionMetadataPartial.id) {
            const newSessionMetadata: ChatSessionMetadata = {
                id: newSessionMetadataPartial.id,
                title: newSessionMetadataPartial.title || 'Untitled Chat',
                createdAt: newSessionMetadataPartial.createdAt || Date.now(),
                lastModifiedAt: newSessionMetadataPartial.lastModifiedAt || Date.now(),
            };
            
            allSessionsMetadata.unshift(newSessionMetadata); // Add to the beginning of the list
            renderChatList(); // Update sidebar
            await selectChatSession(newSessionMetadata.id); // Make the new chat active
            if (messageInput) messageInput.value = ''; // Clear message input
            if (messageInput) messageInput.focus();
            return newSessionMetadata;
        } else {
            console.error("Renderer: Failed to create new session or received invalid metadata.");
            alert("Error: Could not create a new chat.");
            return null;
        }
    } catch (error) {
        console.error("Renderer: Error creating new chat session:", error);
        alert(`Error creating new chat: ${error.message}`);
        return null;
    }
}

if (newChatButton) {
    newChatButton.addEventListener('click', handleNewChatButtonClick);
}

// --- Export Chat Logic ---
async function handleExportChat() {
    if (!activeSessionId || currentConversationMessages.length === 0) {
        alert("No active chat or no messages to export.");
        return;
    }

    console.log(`Renderer: Exporting chat for session ID: ${activeSessionId}`);

    let markdownContent = `# Chat Session: ${allSessionsMetadata.find(s => s.id === activeSessionId)?.title || 'Untitled Chat'}\n\n`;

    currentConversationMessages.forEach(msg => {
        if (msg.role === 'system') { // Skip system messages for this export format, or format them differently
            markdownContent += `*System: ${msg.content}*\n\n---\n\n`;
            return;
        }
        if (msg.role === 'error') {
             markdownContent += `**Error:**\n${msg.content}\n\n---\n\n`;
             return;
        }

        markdownContent += `**${msg.role === 'user' ? 'User' : 'Assistant'}**`;
        if (msg.role === 'assistant' && msg.modelUsed) {
            markdownContent += ` (Model: ${msg.modelUsed})`;
        }
        markdownContent += `:\n\n${msg.content}\n\n---\n\n`;
    });

    const activeSessionTitle = allSessionsMetadata.find(s => s.id === activeSessionId)?.title || 'chat-export';
    // Sanitize title for filename: replace non-alphanumeric with underscore, limit length
    const sanitizedTitle = activeSessionTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const suggestedFilename = `${sanitizedTitle}.md`;

    try {
        const result = await window.electronAPI.exportChatToFile(markdownContent, suggestedFilename);
        if (result.success) {
            alert(`Chat exported successfully to: ${result.filePath}`);
        } else if (result.error) {
            alert(`Failed to export chat: ${result.error}`);
        } else {
            // User cancelled dialog - no message needed, or a subtle console log
            console.log("Renderer: Chat export cancelled by user.");
        }
    } catch (error) {
        console.error("Renderer: Error during chat export IPC call:", error);
        alert(`An unexpected error occurred during export: ${error.message}`);
    }
}

if (exportChatButton) {
    exportChatButton.addEventListener('click', handleExportChat);
}
