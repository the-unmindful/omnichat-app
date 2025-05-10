import './styles.css';
import { marked } from 'marked'; // Import the marked library
import { showToast } from './toast-notifications'; 
import { 
    modelSelector, chatMessagesDiv, messageInput, sendButton, chatHeaderModelSpan, exportChatButton,
    chatListUl, newChatButton,
    personaSelector,
    settingsModal, openSettingsButton, closeSettingsButton,
    addApiKeyButton, apiKeyListDiv, providerSelect, keyLabelInput, keyValueInput,
    addEnabledModelButton, enabledModelListDiv, enabledModelUserLabelInput, enabledModelProviderSelect, enabledModelIdInput, enabledModelApiKeyLinkSelect,
    personaNameInput, personaPromptInput, savePersonaButton, clearPersonaFormButton, personaListDiv
} from './ui-elements';
import { openSettingsModal, closeSettingsModal } from './settings-modal-manager';
import { renderApiKeysList, setupAddApiKeyButtonListeners as setupApiKeysAddListeners } from './settings-api-keys-ui'; // Aliased for clarity
import { setupAddEnabledModelButtonListeners as setupEnabledModelsAddListeners } from './settings-enabled-models-ui'; // loadAndDisplayEnabledModelsFromUi removed
import { setupPersonaManagementListeners } from './settings-personas-ui'; // Import new setup function

// --- Interface Definitions (Matching preload.ts and index.ts) ---
export interface ApiKeyEntry {
    id: string;
    provider: string;
    label: string;
}

export interface EnabledModelEntry { // Added export
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
    personaUsedId?: string | null;    // NEW
    personaUsedName?: string | null;  // NEW
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

            // Persona Management
            getPersonas: () => Promise<Persona[]>;
            savePersona: (personaData: { id?: string; name: string; prompt: string }) => Promise<Persona | null>;
            deletePersona: (personaId: string) => Promise<boolean>;
            setChatSessionPersona: (sessionId: string, personaId: string | null) => Promise<boolean>; // NEW
        }
    }
}

// --- NEW Interface (mirror from preload/index if not already here) ---
interface ChatSession { // Already exists
    id: string;
    title: string;
    createdAt: number;
    lastModifiedAt: number;
    messages: ChatMessage[];
    activePersonaId?: string | null; // NEW
}
// Update ChatSessionMetadata to include activePersonaId
type ChatSessionMetadata = Pick<ChatSession, 'id' | 'title' | 'createdAt' | 'lastModifiedAt' | 'activePersonaId'>; 

// Add Persona interface (mirrors preload.ts and index.ts)
export interface Persona { // Added export
    id: string;
    name: string;
    prompt: string;
}

console.log('👋 Renderer script loaded (Refactored with UI elements and Toast module).');

// --- State Variables ---
let currentSelectedModelEntryId: string | null = null; // Store the ID of the selected enabled model config
export let cachedApiKeys: ApiKeyEntry[] = []; // Cache keys for populating dropdowns

// NEW State Variables for Multi-Session Management
let allSessionsMetadata: ChatSessionMetadata[] = [];
let activeSessionId: string | null = null;
let currentConversationMessages: ChatMessage[] = []; // Holds messages for the activeSessionId

// NEW State Variables for Persona Management
export let allPersonas: Persona[] = []; // Loaded in settings, can be reused here
export let editingPersonaId: string | null = null; // For settings form
let currentChatActivePersonaId: string | null = null; // For the active chat's selected persona


// --- API Key Management Logic ---
// loadAndDisplayApiKeys and populateApiKeyLinkingDropdown moved to settings-api-keys-ui.ts

// --- Enabled Model Management Logic ---
// populateApiKeyLinkingDropdown moved to settings-api-keys-ui.ts
// loadAndDisplayEnabledModels and displayEnabledModels moved to settings-enabled-models-ui.ts

// --- Settings Modal Logic ---
// Definitions moved to settings-modal-manager.ts

if (openSettingsButton) { openSettingsButton.addEventListener('click', openSettingsModal); }
if (closeSettingsButton) { closeSettingsButton.addEventListener('click', closeSettingsModal); }
window.addEventListener('click', (event) => { if (event.target === settingsModal) { closeSettingsModal(); }});

// Add API Key button listener is now set up by setupApiKeysAddListeners()
// Add Enabled Model button listener is now set up by setupEnabledModelsAddListeners()

// --- Model Selection Logic ---
export async function loadAndPopulateChatModelDropdown() {
    console.log('Renderer: Requesting models for chat dropdown...');
    if (!modelSelector) return;
    try {
        const modelsForDropdown = await window.electronAPI.getModelsForChatDropdown();
        console.log('Renderer: Received models for dropdown', modelsForDropdown.length);
        while (modelSelector.options.length > 1) { modelSelector.remove(1); }
        if (modelsForDropdown.length === 0) {
            modelSelector.disabled = true;
            modelSelector.options[0].text = "-- No Models Configured --";
             updateChatHeaderModelLabel(null); 
        } else {
            modelSelector.disabled = false;
            modelSelector.options[0].text = "-- Select Model --";
            modelsForDropdown.forEach(model => {
                const option = document.createElement('option');
                option.value = model.modelEntryId;
                option.textContent = model.displayLabel;
                modelSelector.appendChild(option);
            });
             updateChatHeaderModelLabel(null); 
        }
    } catch (error) {
        console.error('Renderer: Error fetching models for chat dropdown:', error);
        modelSelector.disabled = true;
        modelSelector.options[0].text = "-- Error Loading Models --";
         updateChatHeaderModelLabel(null);
    }
}

function updateChatHeaderModelLabel(selectedOptionText: string | null) {
    if (!chatHeaderModelSpan) return;
    if (selectedOptionText) {
        chatHeaderModelSpan.textContent = `Model: ${selectedOptionText}`;
        chatHeaderModelSpan.title = `Using configuration: ${selectedOptionText}`; 
    } else {
        chatHeaderModelSpan.textContent = `No Model Selected`;
        chatHeaderModelSpan.title = '';
    }
}

if (modelSelector) {
    modelSelector.addEventListener('change', () => {
        currentSelectedModelEntryId = modelSelector.value || null; 
        const selectedOptionText = modelSelector.value ? modelSelector.options[modelSelector.selectedIndex].text : null;
        console.log(`Renderer: Chat model selection changed to Entry ID: ${currentSelectedModelEntryId} (Label: ${selectedOptionText})`);
         updateChatHeaderModelLabel(selectedOptionText); 
    });
}

// --- Chat Message Display Logic ---
async function addMessageToChat(message: ChatMessage) { 
    if (!chatMessagesDiv) return;
    const chatEntryDiv = document.createElement('div');
    chatEntryDiv.classList.add('chat-entry', message.role); 
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', message.role); 
    if (message.id) { messageElement.id = message.id; }
    chatEntryDiv.appendChild(messageElement); 
    try {
        const htmlContent = await marked.parse(message.content || ''); 
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content'; 
        contentDiv.innerHTML = htmlContent; 
        messageElement.appendChild(contentDiv);
        if (message.role === 'assistant' && message.modelUsed) {
            const modelLabelDiv = document.createElement('div');
            modelLabelDiv.className = 'model-label-outside';
            let labelText = `Model: ${message.modelUsed}`;
            if (message.personaUsedName) {
                labelText += ` (Persona: ${message.personaUsedName})`;
            }
            modelLabelDiv.textContent = labelText;
            chatEntryDiv.appendChild(modelLabelDiv);
        }
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
    } catch (error) {
        console.error("Error processing message content:", error);
        const errorContentDiv = document.createElement('div');
        errorContentDiv.className = 'message-content';
        errorContentDiv.textContent = `[Error displaying message] ${message.content}`;
        messageElement.innerHTML = ''; 
        messageElement.appendChild(errorContentDiv);
        if (message.role === 'assistant' && message.modelUsed) {
             const modelLabelDiv = document.createElement('div');
             modelLabelDiv.className = 'model-label-outside'; 
             modelLabelDiv.textContent = `Model: ${message.modelUsed}`;
             chatEntryDiv.appendChild(modelLabelDiv); 
        }
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
    chatMessagesDiv.appendChild(chatEntryDiv); 
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
    let userMsg: ChatMessage | null = null;
    for (let i = assistantMessageIndex - 1; i >= 0; i--) {
        if (currentConversationMessages[i].role === 'user') {
            userMsg = currentConversationMessages[i];
            break;
        }
    }
    if (!userMsg) {
        console.log("No preceding user message found, copying assistant message only.");
        let textToCopy = `**Assistant (Model: ${assistantMsg.modelUsed || 'Unknown'})**:\n\n${assistantMsg.content}`;
        const success = await window.electronAPI.copyTextToClipboard(textToCopy);
        if (success) {
            const originalText = buttonElement.innerHTML;
            buttonElement.innerHTML = 'Copied!';
            setTimeout(() => { buttonElement.innerHTML = originalText; }, 1500);
        } else {
            showToast("Failed to copy message.", "error");
        }
        return;
    }
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
            showToast("Failed to copy Q&A to clipboard.", "error");
        }
    } catch (error) {
        console.error("Error copying Q&A to clipboard:", error);
        showToast("An error occurred while copying.", "error");
    }
}

function removeMessageById(id: string) { 
     const messageElement = document.getElementById(id); if (messageElement) { messageElement.remove(); }
}

// --- Send Message Logic ---
async function handleSendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    if (!currentSelectedModelEntryId) {
        showToast("Please select a configured model from the dropdown first.", "error");
        return;
    }
    if (!activeSessionId) {
        const newSession = await handleNewChatButtonClick(); 
        if (!newSession || !newSession.id) { 
            // showToast("Could not create a new chat session. Please try again.", "error"); // Already handled in handleNewChatButtonClick
            sendButton.disabled = false; sendButton.textContent = 'Send';
            return;
        }
    }
    if (!activeSessionId) { 
        showToast("No active chat session. Please create or select a chat.", "error");
        sendButton.disabled = false; sendButton.textContent = 'Send';
        return;
    }
    messageInput.value = ''; sendButton.disabled = true; sendButton.textContent = 'Sending...';
    const userMessage: ChatMessage = { role: 'user', content: messageText };
    currentConversationMessages.push(userMessage);
    addMessageToChat(userMessage);
    try {
        await window.electronAPI.addMessageToChatSession(activeSessionId, userMessage);
        if (currentConversationMessages.length === 1) { 
            const sessionToUpdate = allSessionsMetadata.find(s => s.id === activeSessionId);
            if (sessionToUpdate && sessionToUpdate.title.startsWith('New Chat')) { 
                const updatedMetadatas = await window.electronAPI.loadChatSessionsMetadata();
                allSessionsMetadata = updatedMetadatas.map(s => ({id: s.id!, title: s.title!, createdAt: s.createdAt!, lastModifiedAt: s.lastModifiedAt!, activePersonaId: s.activePersonaId}));
                renderChatList(); 
            }
        }
    } catch (error) {
        console.error(`Renderer: Error saving user message to session ${activeSessionId}:`, error);
    }
    const thinkingMessageId = `thinking-${Date.now()}`;
    addMessageToChat({ role: 'assistant', content: '...', id: thinkingMessageId });
    let historyForPayload = [...currentConversationMessages];
    if (currentChatActivePersonaId) {
        const selectedPersona = allPersonas.find(p => p.id === currentChatActivePersonaId);
        if (selectedPersona) {
            console.log(`Renderer: Applying persona "${selectedPersona.name}" with prompt: "${selectedPersona.prompt.substring(0,50)}..."`);
            if (historyForPayload.length === 0 || 
                !(historyForPayload[0].role === 'system' && historyForPayload[0].content === selectedPersona.prompt)) {
                historyForPayload.unshift({ role: 'system', content: selectedPersona.prompt });
            }
        } else {
            console.warn(`Renderer: Active persona ID ${currentChatActivePersonaId} not found in allPersonas list.`);
        }
    }
    const payload: ChatPayload = {
        modelEntryId: currentSelectedModelEntryId, 
        history: historyForPayload, 
    };
    console.log(`Renderer: Sending message using Enabled Model Entry ID: ${payload.modelEntryId} for session ${activeSessionId}. History length: ${payload.history.length}`);
    try {
        const assistantResponseContent = await window.electronAPI.sendChatMessage(payload);
        removeMessageById(thinkingMessageId);
        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: assistantResponseContent,
            modelUsed: modelSelector.options[modelSelector.selectedIndex]?.text || 'Unknown Model Config',
            personaUsedId: currentChatActivePersonaId, 
            personaUsedName: currentChatActivePersonaId 
                ? (allPersonas.find(p => p.id === currentChatActivePersonaId)?.name || null) 
                : null 
        };
        currentConversationMessages.push(assistantMessage);
        addMessageToChat(assistantMessage);
        if (activeSessionId) { 
            try {
                await window.electronAPI.addMessageToChatSession(activeSessionId, assistantMessage);
                const sessionMeta = allSessionsMetadata.find(s => s.id === activeSessionId);
                if (sessionMeta) {
                    sessionMeta.lastModifiedAt = Date.now();
                    allSessionsMetadata.sort((a, b) => b.lastModifiedAt - a.lastModifiedAt); 
                    renderChatList(); 
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
        sendButton.disabled = false; sendButton.textContent = 'Send'; 
        if (messageInput) messageInput.focus(); 
    }
}

if (sendButton) { sendButton.addEventListener('click', handleSendMessage); }
if (messageInput) {
    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSendMessage(); }
    });
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    loadAndPopulateChatModelDropdown();
    await loadAndDisplayChatSessions();
    await populatePersonaSelector();
    setupApiKeysAddListeners(); // Setup listener for Add API Key button
    setupEnabledModelsAddListeners(); // Setup listener for Add Enabled Model button
    setupPersonaManagementListeners(); // Setup listeners for Persona Management
});

// --- Persona Selector UI Functions ---
export async function populatePersonaSelector() {
    if (!personaSelector) {
        console.warn("Renderer: Persona selector dropdown not found in chat header.");
        return;
    }
    console.log("Renderer: Populating persona selector dropdown...");
    let personasToDisplay: Persona[] = [];
    try {
        personasToDisplay = await window.electronAPI.getPersonas();
        allPersonas = personasToDisplay; 
    } catch (error) {
        console.error("Renderer: Error fetching personas for selector:", error);
        personaSelector.innerHTML = '<option value="">Error loading personas</option>';
        personaSelector.disabled = true;
        return;
    }
    const previousSelectedValue = personaSelector.value; 
    personaSelector.innerHTML = ''; 
    const defaultOption = document.createElement('option');
    defaultOption.value = ""; 
    defaultOption.textContent = "-- No Persona --";
    personaSelector.appendChild(defaultOption);
    if (personasToDisplay.length > 0) {
        personasToDisplay.forEach(persona => {
            const option = document.createElement('option');
            option.value = persona.id;
            option.textContent = persona.name;
            personaSelector.appendChild(option);
        });
    }
    if (currentChatActivePersonaId && personasToDisplay.some(p => p.id === currentChatActivePersonaId)) {
        personaSelector.value = currentChatActivePersonaId;
    } else if (previousSelectedValue && personasToDisplay.some(p => p.id === previousSelectedValue)) {
        personaSelector.value = previousSelectedValue;
    } else {
        personaSelector.value = ""; 
    }
    personaSelector.disabled = false;
    console.log("Renderer: Persona selector populated. Current value:", personaSelector.value);
}

if (personaSelector) {
    personaSelector.addEventListener('change', async () => {
        const newSelectedPersonaId = personaSelector.value || null; 
        console.log(`Renderer: Persona selection changed to ID: ${newSelectedPersonaId}`);
        currentChatActivePersonaId = newSelectedPersonaId;
        if (activeSessionId) {
            console.log(`Renderer: Attempting to save persona selection for active session ${activeSessionId}`);
            try {
                const success = await window.electronAPI.setChatSessionPersona(activeSessionId, currentChatActivePersonaId);
                if (success) {
                    console.log(`Renderer: Persona ID ${currentChatActivePersonaId || 'null'} saved for session ${activeSessionId}`);
                    const sessionMeta = allSessionsMetadata.find(s => s.id === activeSessionId);
                    if (sessionMeta && 'activePersonaId' in sessionMeta) { 
                        (sessionMeta as any).activePersonaId = currentChatActivePersonaId;
                    }
                } else {
                    console.warn("Renderer: IPC setChatSessionPersona returned false."); 
                    showToast('Failed to set persona for this chat session.', 'error'); 
                }
            } catch (error) {
                console.error('Renderer: Error setting persona for session via IPC:', error); 
                showToast(`Error setting persona: ${error.message || 'Unknown error'}`, 'error');
            }
        } else {
            console.log("Renderer: No active chat session to save persona selection to.");
        }
        if (messageInput) messageInput.focus(); 
    });
}

// --- Chat Session Management UI Functions ---
async function loadAndDisplayChatSessions() {
    if (!chatListUl) {
        console.error("Chat list UL element not found.");
        return;
    }
    try {
        console.log("Renderer: Loading chat sessions metadata...");
        const sessions = await window.electronAPI.loadChatSessionsMetadata();
        allSessionsMetadata = sessions.map(s => ({ 
            id: s.id!, 
            title: s.title!, 
            createdAt: s.createdAt!, 
            lastModifiedAt: s.lastModifiedAt!,
            activePersonaId: s.activePersonaId 
        }));
        renderChatList();
        if (allSessionsMetadata.length > 0) {
            await selectChatSession(allSessionsMetadata[0].id);
        } else {
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
    chatListUl.innerHTML = ''; 
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
        type ListItemWithTimeout = HTMLLIElement & { _clickTimeoutId?: number };
        (li as ListItemWithTimeout)._clickTimeoutId = undefined;
        li.addEventListener('click', () => {
            const currentLi = li as ListItemWithTimeout;
            if (currentLi.querySelector('input.rename-chat-input')) {
                console.log("Renderer: Click ignored, rename in progress.");
                return; 
            }
            if (currentLi._clickTimeoutId) { 
                clearTimeout(currentLi._clickTimeoutId); 
            }
            currentLi._clickTimeoutId = window.setTimeout(() => {
                console.log(`Renderer: Single click timeout fired for session ID: ${sessionMeta.id}`);
                selectChatSession(sessionMeta.id);
                currentLi._clickTimeoutId = undefined; 
            }, 250); 
        });
        li.addEventListener('dblclick', () => {
            const currentLi = li as ListItemWithTimeout;
            if (currentLi._clickTimeoutId) {
                clearTimeout(currentLi._clickTimeoutId); 
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
            let inputActive = true; 
            const finishRename = async (saveIntent: boolean) => {
                if (!inputActive) return;
                inputActive = false; 
                console.log(`Renderer: finishRename called. saveIntent: ${saveIntent}`);
                const newTitle = input.value.trim();
                input.remove(); 
                childNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        (node as HTMLElement).style.display = '';
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
                            showToast('Failed to rename chat session.', 'error');
                        }
                    } catch (error) {
                        console.error('Renderer: Error renaming session via IPC:', error);
                        showToast(`Error renaming session: ${error.message || 'Unknown error'}`, 'error');
                    }
                } else {
                    console.log("Renderer: Rename cancelled or title unchanged/empty.");
                }
                renderChatList();
            };
            input.addEventListener('blur', () => {
                console.log("Renderer: Rename input blurred.");
                setTimeout(() => { 
                    if (inputActive) finishRename(true); 
                }, 100); 
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
            const deleteBtn = li.querySelector('.delete-chat-button');
            if (deleteBtn) {
                li.insertBefore(input, deleteBtn);
            } else {
                li.appendChild(input);
            }
            setTimeout(() => { 
                input.focus();
                input.select();
                console.log("Renderer: Rename input appended and focused.");
            },0);
        });
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '🗑️'; 
        deleteButton.classList.add('delete-chat-button');
        deleteButton.setAttribute('title', 'Delete Chat');
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const actionsContainer = li; 
            deleteButton.style.display = 'none';
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = '✔️';
            confirmBtn.className = 'confirm-delete-btn delete-chat-confirm-btn'; 
            confirmBtn.title = 'Confirm Delete Chat';
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = '❌';
            cancelBtn.className = 'cancel-delete-btn delete-chat-cancel-btn'; 
            cancelBtn.title = 'Cancel';
            const restoreOriginalButtons = () => {
                confirmBtn.remove();
                cancelBtn.remove();
                deleteButton.style.display = '';
            };
            confirmBtn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                console.log(`Renderer: Confirming delete for chat session ID: ${sessionMeta.id}`);
                confirmBtn.disabled = true;
                cancelBtn.disabled = true;
                try {
                    const success = await window.electronAPI.deleteChatSession(sessionMeta.id);
                    if (success) {
                        showToast(`Chat "${sessionMeta.title}" deleted.`, 'success');
                        loadAndDisplayChatSessions(); 
                    } else {
                        showToast('Failed to delete chat session.', 'error');
                        restoreOriginalButtons();
                    }
                } catch (error) {
                    console.error(`Renderer: Error deleting session ${sessionMeta.id}:`, error);
                    showToast(`Error deleting chat: ${error.message || 'Unknown error'}`, 'error');
                    restoreOriginalButtons();
                }
            });
            cancelBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                restoreOriginalButtons();
            });
            li.appendChild(confirmBtn);
            li.appendChild(cancelBtn);
        });
        li.appendChild(deleteButton);
        chatListUl.appendChild(li);
    });
}

async function selectChatSession(sessionId: string) {
    if (!sessionId) return;
    console.log(`Renderer: Selecting chat session ${sessionId}`);
    try {
        const sessionMetadata = allSessionsMetadata.find(s => s.id === sessionId);
        currentChatActivePersonaId = sessionMetadata?.activePersonaId || null;
        if (personaSelector) {
            personaSelector.value = currentChatActivePersonaId || ""; 
            console.log(`Renderer: Persona selector set to ${personaSelector.value} for session ${sessionId}`);
        } else {
            console.warn("Renderer: Persona selector not found when trying to set for session.");
        }
        const messages = await window.electronAPI.loadChatSessionMessages(sessionId);
        currentConversationMessages = messages;
        activeSessionId = sessionId;
        if (chatMessagesDiv) {
            chatMessagesDiv.innerHTML = ''; 
            if (currentConversationMessages.length === 0) {
                addMessageToChat({role: 'system', content: 'This chat is empty. Send a message to start!'});
            } else {
                currentConversationMessages.forEach(msg => addMessageToChat(msg));
            }
        }
        renderChatList(); 
        if (messageInput) messageInput.focus(); 
    } catch (error) {
        console.error(`Renderer: Error loading messages for session ${sessionId}:`, error);
        if (chatMessagesDiv) chatMessagesDiv.innerHTML = `<div class="message error">Error loading chat: ${error.message}</div>`;
    }
}

/*
async function handleDeleteChatSession(sessionId: string) {
    // This logic is now part of the inline confirmation in renderChatList
}
*/

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
                activePersonaId: newSessionMetadataPartial.activePersonaId || null 
            };
            allSessionsMetadata.unshift(newSessionMetadata); 
            renderChatList(); 
            await selectChatSession(newSessionMetadata.id); 
            if (messageInput) {
                messageInput.value = ''; 
                messageInput.focus(); 
            }
            return newSessionMetadata;
        } else {
            console.error("Renderer: Failed to create new session or received invalid metadata.");
            showToast("Error: Could not create a new chat.", "error");
            return null;
        }
    } catch (error) {
        console.error("Renderer: Error creating new chat session:", error);
        showToast(`Error creating new chat: ${error.message || 'Unknown error'}`, 'error');
        return null;
    }
}

if (newChatButton) {
    newChatButton.addEventListener('click', handleNewChatButtonClick);
}

// --- Export Chat Logic ---
async function handleExportChat() {
    if (!activeSessionId || currentConversationMessages.length === 0) {
        showToast("No active chat or no messages to export.", "info");
        return;
    }
    console.log(`Renderer: Exporting chat for session ID: ${activeSessionId}`);
    const sessionTitle = allSessionsMetadata.find(s => s.id === activeSessionId)?.title || 'Untitled Chat';
    let markdownContent = `# Chat Session: ${sessionTitle}\n\n`;
    if (currentChatActivePersonaId) {
        const activePersona = allPersonas.find(p => p.id === currentChatActivePersonaId);
        if (activePersona) {
            markdownContent += `## Persona: ${activePersona.name}\n\n**System Prompt:**\n\n${activePersona.prompt.replace(/\n/g, '\n\n')}\n\n---\n\n`; 
        } else {
            console.warn(`Renderer (Export): Active persona ID ${currentChatActivePersonaId} not found in allPersonas. Not adding to export.`);
        }
    }
    currentConversationMessages.forEach(msg => {
        if (msg.role === 'system') { 
            markdownContent += `*System (Chat Internal): ${msg.content.replace(/\n/g, '\n\n')}*\n\n---\n\n`;
            return;
        }
        if (msg.role === 'error') {
             markdownContent += `**Error:**\n${msg.content}\n\n---\n\n`;
             return;
        }
        markdownContent += `**${msg.role === 'user' ? 'User' : 'Assistant'}**`;
        if (msg.role === 'assistant') {
            let assistantHeader = '';
            if (msg.modelUsed) {
                assistantHeader += ` (Model: ${msg.modelUsed}`;
            }
            if (currentChatActivePersonaId) { 
                const persona = allPersonas.find(p => p.id === currentChatActivePersonaId);
                if (persona) {
                    assistantHeader += assistantHeader ? `, Persona: ${persona.name}` : ` (Persona: ${persona.name}`;
                }
            }
            if (assistantHeader) { 
                assistantHeader += ')';
            }
            markdownContent += assistantHeader;
        }
        markdownContent += `:\n\n${msg.content.replace(/\n/g, '\n\n')}\n\n---\n\n`;
    });
    const activeSessionTitle = allSessionsMetadata.find(s => s.id === activeSessionId)?.title || 'chat-export';
    const sanitizedTitle = activeSessionTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    const suggestedFilename = `${sanitizedTitle}.md`;
    try {
        const result = await window.electronAPI.exportChatToFile(markdownContent, suggestedFilename);
        if (result.success && result.filePath) {
            showToast(`Chat exported successfully to: ${result.filePath}`, 'success', 5000); 
        } else if (result.error) {
            showToast(`Failed to export chat: ${result.error}`, 'error');
        } else {
            console.log("Renderer: Chat export cancelled by user.");
        }
    } catch (error) {
        console.error("Renderer: Error during chat export IPC call:", error);
        showToast(`An unexpected error occurred during export: ${error.message || 'Unknown error'}`, 'error');
    }
}

if (exportChatButton) {
    exportChatButton.addEventListener('click', handleExportChat);
}

// --- Persona Management UI Functions (NEW) ---
// All Persona Management UI functions (loadAndDisplayPersonas, renderPersonaList, clearPersonaForm, handleSavePersona)
// and their button listeners (savePersonaButton, clearPersonaFormButton)
// have been moved to src/settings-personas-ui.ts
// setupPersonaManagementListeners() is called in DOMContentLoaded to set them up.
