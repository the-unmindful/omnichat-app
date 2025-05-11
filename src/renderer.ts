import './styles.css';
import './components/TestElement'; // Import the TestElement component to register it
import './components/ChatMessageComponent'; // Corrected import path
import { marked } from 'marked'; // Import the marked library
import { showToast } from './toast-notifications';
import {
    modelSelector, chatMessagesDiv, messageInput, sendButton, chatHeaderModelSpan, exportChatButton,
    chatListUl, newChatButton, chatSearchInput, // Added chatSearchInput
    personaSelector,
    settingsModal, openSettingsButton, closeSettingsButton,
    addApiKeyButton, apiKeyListDiv, providerSelect, keyLabelInput, keyValueInput,
    addEnabledModelButton, enabledModelListDiv, enabledModelUserLabelInput, enabledModelProviderSelect, enabledModelIdInput, enabledModelApiKeyLinkSelect,
    personaNameInput, personaPromptInput, savePersonaButton, clearPersonaFormButton, personaListDiv,
    attachFileButton, selectedAttachmentDisplay, // NEW Attachment UI Elements
    // For Model Parameters Popover (assuming IDs will be added to ui-elements.ts or queried directly)
    // modelParamsButton, modelParamsPopover, applyModelParamsButton, closeModelParamsButton,
    // paramTemperatureInput, paramTopPInput, paramMaxTokensInput 
} from './ui-elements';
import { openSettingsModal, closeSettingsModal } from './settings-modal-manager';
import { renderApiKeysList, setupAddApiKeyButtonListeners as setupApiKeysAddListeners, loadAndDisplayApiKeys } from './settings-api-keys-ui'; // Aliased for clarity & import loadAndDisplayApiKeys
import { setupAddEnabledModelButtonListeners as setupEnabledModelsAddListeners } from './settings-enabled-models-ui'; // loadAndDisplayEnabledModelsFromUi removed
import { setupPersonaManagementListeners } from './settings-personas-ui'; // Import new setup function
import { setupChatSearch } from './chat-search-ui'; // Import chat search setup
import {
    setupAttachFileButtonListener,
    getCurrentAttachmentInfo,
    clearAttachmentSelection as clearAttachmentSelectionFromHandler,
    isCurrentAttachmentContextCommitted, // NEW
    markCurrentAttachmentContextAsCommitted // NEW
} from './attachment-handler'; // NEW Import for attachment handling
import type { ChatSessionMetadata as PreloadChatSessionMetadata } from './preload'; // Import for global API declaration

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
    expectedOutputModalities?: Array<'text' | 'image'>; // NEW for V1.5
}

// Simplified structure for the chat model dropdown options
interface AvailableModel {
    modelEntryId: string; // The value of the dropdown option
    displayLabel: string; // The text displayed in the dropdown option
}

// NEW for V1.5: Interface for structured assistant output
export interface AssistantOutputContent {
    type: 'text' | 'image' | 'error' | 'loading'; // Added 'loading'
    text_content?: string;
    image_url?: string; // URL to the generated image (or base64 data URI)
    error_message?: string;
}

// Define types for multi-modal content parts (OpenAI vision compatible)
export interface TextContentPart {
    type: 'text';
    text: string;
}
export interface ImageContentPart {
    type: 'image_url';
    image_url: {
        url: string; // e.g., "data:image/jpeg;base64,..." or a public URL
        // detail?: 'low' | 'high' | 'auto'; // Optional for OpenAI
    };
}
export type UserContent = string | Array<TextContentPart | ImageContentPart>;


interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'error';
    content: UserContent; // Updated to support multi-modal user content
    assistantOutput?: AssistantOutputContent; // For assistant's structured output
    modelUsed?: string; // Optional: track which model config was used (modelEntryId or userLabel)
    id?: string;
    personaUsedId?: string | null;    // NEW
    personaUsedName?: string | null;  // NEW
}

// Payload sent to main process for chat (uses modelEntryId)
interface ChatPayload {
    modelEntryId: string; // The ID of the configuration to use
    history: ChatMessage[];
    temperature?: number; // ADD THIS
    topP?: number;        // ADD THIS
    maxTokens?: number;   // ADD THIS
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
            getModelsForChatDropdown: () => Promise<EnabledModelEntry[]>; // NOW RETURNS FULL ENTRIES

            // Chat Function
            sendChatMessage: (payload: ChatPayload) => Promise<AssistantOutputContent>; // Updated return type

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

            // Search Functionality
            searchChats: (searchTerm: string) => Promise<PreloadChatSessionMetadata[]>;

            // Attachment Handling (NEW)
            selectFile: () => Promise<{ originalPath: string; name: string; type: string; size: number } | null>;
            extractTextFromFile: (originalPath: string, fileType: string) => Promise<{ extractedText?: string; base64ImageData?: string; imageMimeType?: string; error?: string }>;
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
let cachedEnabledModels: EnabledModelEntry[] = []; // NEW: Cache for full enabled model entries
// NEW: State for Model Parameters
let currentModelParams = {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 65550, 
};

// NEW State Variables for Multi-Session Management
let allSessionsMetadata: PreloadChatSessionMetadata[] = []; // Use imported type
let displayedSessionsMetadata: PreloadChatSessionMetadata[] = []; // For search results
let activeSessionId: string | null = null;
let currentConversationMessages: ChatMessage[] = []; // Holds messages for the activeSessionId

// NEW State Variables for Persona Management
export let allPersonas: Persona[] = []; // Loaded in settings, can be reused here
export let editingPersonaId: string | null = null; // For settings form
let currentChatActivePersonaId: string | null = null; // For the active chat's selected persona

// REMOVED: currentSelectedFileInfo is now in attachment-handler.ts


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
function updateChatHeaderModalityTags(model: EnabledModelEntry | null) {
    const tagsContainer = document.getElementById('chat-header-modality-tags');
    if (!tagsContainer) return;

    if (model && model.expectedOutputModalities && model.expectedOutputModalities.length > 0) {
        // Only show tags if there's something other than just "text" or if explicitly "text" and "image"
        const hasImage = model.expectedOutputModalities.includes('image');
        const hasText = model.expectedOutputModalities.includes('text');

        if (hasImage || (hasText && model.expectedOutputModalities.length > 1) ) { // Show tags if image is present, or if multiple modalities including text
            tagsContainer.innerHTML = model.expectedOutputModalities.map(m => 
                `<span class="modality-tag ${m.toLowerCase()}-modality">${m.charAt(0).toUpperCase() + m.slice(1)}</span>`
            ).join(' ');
            tagsContainer.style.display = 'inline-flex'; // Use flex for gap if multiple tags
        } else if (hasText && model.expectedOutputModalities.length === 1) {
            // Optionally, show a subtle "Text" tag or nothing if only text
            // tagsContainer.innerHTML = `<span class="modality-tag text-modality">Text</span>`;
            // tagsContainer.style.display = 'inline-flex';
            tagsContainer.innerHTML = ''; // Or hide if only text
            tagsContainer.style.display = 'none';
        } else {
            tagsContainer.innerHTML = '';
            tagsContainer.style.display = 'none';
        }
    } else if (model) { // Model exists but no modalities defined, assume text, hide tags
        tagsContainer.innerHTML = '';
        tagsContainer.style.display = 'none';
    } else { // No model selected
        tagsContainer.innerHTML = '';
        tagsContainer.style.display = 'none';
    }
}


export async function loadAndPopulateChatModelDropdown() {
    console.log('Renderer: Requesting models for chat dropdown...');
    if (!modelSelector) return;
    try {
        // Now expects EnabledModelEntry[]
        cachedEnabledModels = await window.electronAPI.getModelsForChatDropdown(); 
        console.log('Renderer: Received enabled models', cachedEnabledModels.length);
        
        while (modelSelector.options.length > 1) { modelSelector.remove(1); } // Clear existing options except the placeholder

        if (cachedEnabledModels.length === 0) {
            modelSelector.disabled = true;
            modelSelector.options[0].text = "-- No Models Configured --";
        } else {
            modelSelector.disabled = false;
            modelSelector.options[0].text = "-- Select Model --";
            // Create a map for API key labels for tooltip generation
            const apiKeyLabels = new Map(cachedApiKeys.map(k => [k.id, k.label]));

            cachedEnabledModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.modelEntryId;
                
                // Construct the full display label, similar to how it was done in main process before
                const linkedKey = cachedApiKeys.find(key => key.id === model.apiKeyId);
                const keyLabelHint = linkedKey ? ` (Key: ${linkedKey.label || 'Untitled'})` : ' (Key Missing!)';
                const fullDisplayLabel = `${model.userLabel || model.modelId} (Provider: ${model.provider}, ID: ${model.modelId})${keyLabelHint}`;
                
                option.textContent = fullDisplayLabel;
                option.title = fullDisplayLabel; // Tooltip can also be the full label
                modelSelector.appendChild(option);
            });
        }
        // Trigger a change event to update header based on current selection (or lack thereof)
        handleModelSelectionChange(); 

    } catch (error) {
        console.error('Renderer: Error fetching/populating models for chat dropdown:', error);
        modelSelector.disabled = true;
        modelSelector.options[0].text = "-- Error Loading Models --";
        handleModelSelectionChange(); // Update header even on error
    }
}

function handleModelSelectionChange() {
    currentSelectedModelEntryId = modelSelector.value || null;
    const selectedModel = cachedEnabledModels.find(m => m.modelEntryId === currentSelectedModelEntryId);

    if (selectedModel) {
        const linkedKey = cachedApiKeys.find(key => key.id === selectedModel.apiKeyId);
        const keyLabelHint = linkedKey ? ` (Key: ${linkedKey.label || 'Untitled'})` : ' (Key Missing!)';
        const fullDisplayLabel = `${selectedModel.userLabel || selectedModel.modelId} (Provider: ${selectedModel.provider}, ID: ${selectedModel.modelId})${keyLabelHint}`;
        
        console.log(`Renderer: Chat model selection changed to Entry ID: ${currentSelectedModelEntryId} (Full Label: ${fullDisplayLabel})`);
        modelSelector.title = fullDisplayLabel; // Set tooltip on the select element
    } else {
        modelSelector.title = 'No model selected';
        console.log('Renderer: No model selected or model not found in cache.');
    }
    updateChatHeaderModalityTags(selectedModel || null);

    // Update popover inputs to reflect current global params when model changes
    const paramTempInput = document.getElementById('param-temperature') as HTMLInputElement | null;
    const paramTopPInput = document.getElementById('param-top-p') as HTMLInputElement | null;
    const paramMaxTokensInput = document.getElementById('param-max-tokens') as HTMLInputElement | null;

    if(paramTempInput) paramTempInput.value = currentModelParams.temperature.toFixed(1);
    if(paramTopPInput) paramTopPInput.value = currentModelParams.topP.toFixed(2);
    if(paramMaxTokensInput) paramMaxTokensInput.value = currentModelParams.maxTokens.toString();
}

if (modelSelector) {
    modelSelector.addEventListener('change', handleModelSelectionChange);
}

// --- Chat Message Display Logic ---

// Refactored to use chat-message-component
async function addMessageToChat(message: ChatMessage) {
    if (!chatMessagesDiv) return;

    // If this is a "real" message, remove the "empty chat" system message if it exists
    if (!(message.role === 'system' && message.id === 'system-empty-chat-message')) {
        // Iterate through children to find the component by its property
        for (const child of Array.from(chatMessagesDiv.children)) {
            if (child.tagName === 'CHAT-MESSAGE-COMPONENT') {
                const component = child as any; // Cast to access properties
                if (component.messageId === 'system-empty-chat-message') {
                    console.log('Renderer: Removing "empty chat" system message component.');
                    child.remove();
                    break; // Found and removed
                }
            }
        }
    }

    console.log(`Renderer: addMessageToChat called for role: ${message.role}, id: ${message.id || 'N/A'}`);
    const messageComponent = document.createElement('chat-message-component');
    messageComponent.role = message.role;
    // messageComponent.messageContent expects a string.
    // If message.content is UserContent (array for multimodal), extract text for display.
    // This primarily affects reloading history for user messages that were multimodal.
    // For new user messages, `userMessageForDisplay.content` is already a string.
    let contentForComponent: string;
    if (typeof message.content === 'string') {
        contentForComponent = message.content;
    } else if (Array.isArray(message.content)) {
        // For multimodal user messages being reloaded, find the first text part for display,
        // or use a placeholder. Assistant messages with images use assistantOutput.text_content.
        const textPart = message.content.find(part => part.type === 'text') as TextContentPart | undefined;
        contentForComponent = textPart ? textPart.text : '[Multi-modal content]';
    } else {
        contentForComponent = ''; // Fallback for unknown content structure
    }
    messageComponent.messageContent = contentForComponent; // Assign the processed string

    // The messageId property on the component is used by its render method to set the id on the inner bubble.
    // For the thinking message, its host ID is set directly in handleSendMessage.
    if (message.id) {
      messageComponent.messageId = message.id;
    }

    // Pass appropriate content to the component
    // messageComponent.messageContent expects a string.
    // If message.content is UserContent (array for multimodal user messages), extract text for display.
    let displayableContent: string;
    if (typeof message.content === 'string') {
        displayableContent = message.content;
    } else if (Array.isArray(message.content)) {
        // For multimodal user messages, find the first text part for display, or use a placeholder.
        const textPart = message.content.find(part => part.type === 'text') as TextContentPart | undefined;
        displayableContent = textPart ? textPart.text : '[Multi-modal content]';
    } else {
        displayableContent = ''; // Fallback for unknown content structure
    }

    if (message.role === 'assistant' && message.assistantOutput) {
        messageComponent.outputType = message.assistantOutput.type; 
        console.log(`Renderer: Setting component outputType to: ${messageComponent.outputType}`);

        if (message.assistantOutput.type === 'text' && message.assistantOutput.text_content) {
            messageComponent.messageContent = message.assistantOutput.text_content;
        } else if (message.assistantOutput.type === 'image' && message.assistantOutput.image_url) {
            messageComponent.imageUrl = message.assistantOutput.image_url;
            // For assistant image messages, message.content (which is finalAssistantMessageContent) is already a string like "[Image]" or caption
            messageComponent.messageContent = displayableContent; // Use the string version from message.content
            console.log(`Renderer: Setting component imageUrl to: ${messageComponent.imageUrl}`);
        } else if (message.assistantOutput.type === 'error' && message.assistantOutput.error_message) {
            messageComponent.messageContent = message.assistantOutput.error_message;
        } else if (message.assistantOutput.type === 'loading') {
            messageComponent.messageContent = '...'; 
        } else { // Fallback for assistant if output type is unhandled
            messageComponent.messageContent = displayableContent; 
            messageComponent.outputType = 'text'; 
        }
    } else { // For user, system (non-error)
        messageComponent.messageContent = displayableContent;
        messageComponent.outputType = message.role === 'error' ? 'error' : 'text';
    }
    // messageComponent.messageContent is now guaranteed to be a string from the logic above.
    console.log(`Renderer: Setting component messageContent to (first 50 chars): "${messageComponent.messageContent.substring(0,50)}"`);

    if (message.modelUsed) {
      messageComponent.modelUsed = message.modelUsed;
    }
    if (message.personaUsedName) {
      messageComponent.personaUsedName = message.personaUsedName;
    }

    if (message.role === 'assistant') {
      messageComponent.onCopy = async (componentInstance) => {
        // Find the index of the message this component represents
        // This is a bit indirect; ideally, the component would have its index or full message object.
        // For now, we'll find it based on content and role if ID isn't perfectly unique or available.
        // A more robust way would be to pass the full ChatMessage object or its index to the component.
        const messageIndex = currentConversationMessages.findIndex(
          (m) => m.content === componentInstance.messageContent && m.role === 'assistant' && m.modelUsed === componentInstance.modelUsed
        );

        if (messageIndex !== -1) {
          // We need to pass the original button element if handleCopyMessagePair expects it for UI updates.
          // Since the button is inside the shadow DOM, we'll pass null and let the component handle its own UI.
          // The component's _handleCopy method already updates its internal state for the 'Copied!' text.
          await handleCopyMessagePair(messageIndex, null); // Pass null for buttonElement
        } else {
          console.warn("Could not find message in currentConversationMessages for copy callback.");
          showToast("Error finding message to copy.", "error");
        }
      };
    }

    chatMessagesDiv.appendChild(messageComponent);
    // Scroll to bottom
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}


// --- Copy Message Pair Logic ---
// Modified to not require buttonElement for UI updates, as component handles its own.
async function handleCopyMessagePair(assistantMessageIndex: number, _buttonElement: HTMLButtonElement | null) {
    if (assistantMessageIndex < 0 || assistantMessageIndex >= currentConversationMessages.length) {
        console.error("Invalid message index for copy:", assistantMessageIndex);
        showToast("Error: Invalid message index for copy.", "error");
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

    let textToCopy = "";
    if (userMsg) {
        let userContentText = '';
        if (typeof userMsg.content === 'string') {
            userContentText = userMsg.content;
        } else if (Array.isArray(userMsg.content)) {
            userMsg.content.forEach(part => {
                if (part.type === 'text') {
                    userContentText += part.text;
                } else if (part.type === 'image_url') {
                    userContentText += '[Image Content]'; 
                }
            });
        }
        textToCopy = `**User:**\n\n${userContentText}\n\n---\n\n`;
    }

    // assistantMsg.content is already a string (caption or text response from finalAssistantMessageContent)
    // or it's the error message string if role is 'error'
    let assistantContentText = '';
    if (typeof assistantMsg.content === 'string') {
        assistantContentText = assistantMsg.content;
    } else {
        // This case should ideally not happen for assistant messages if they are processed correctly
        // into finalAssistantMessageContent (string) before being stored.
        // However, as a fallback, handle it like user content.
        if (Array.isArray(assistantMsg.content)) {
             assistantMsg.content.forEach(part => {
                if (part.type === 'text') {
                    assistantContentText += part.text;
                } else if (part.type === 'image_url') {
                    assistantContentText += '[Image Content]';
                }
            });
        }
    }
    textToCopy += `**Assistant (Model: ${assistantMsg.modelUsed || 'Unknown'})**:\n\n${assistantContentText}`;

    try {
        const success = await window.electronAPI.copyTextToClipboard(textToCopy);
        if (success) {
            // UI update is handled by the component itself
        } else {
            showToast("Failed to copy Q&A to clipboard.", "error");
        }
    } catch (error) {
        console.error("Error copying Q&A to clipboard:", error);
        showToast("An error occurred while copying.", "error");
    }
}


function removeMessageById(id: string) {
    console.log(`Renderer: Attempting to remove element with ID: ${id}`);
    const elementToRemove = document.getElementById(id);
    if (elementToRemove) {
        console.log(`Renderer: Found element to remove. TagName: ${elementToRemove.tagName}, ID: ${elementToRemove.id}`);
        if (elementToRemove.tagName === 'CHAT-MESSAGE-COMPONENT') {
            elementToRemove.remove();
            console.log(`Renderer: Removed CHAT-MESSAGE-COMPONENT with ID: ${id}`);
        } else {
            console.warn(`Renderer: Element with ID ${id} was a ${elementToRemove.tagName}, not CHAT-MESSAGE-COMPONENT. Removing it directly.`);
            elementToRemove.remove();
        }
    } else {
        console.warn(`Renderer: removeMessageById - Element with ID ${id} not found.`);
    }
}

// --- Send Message Logic ---
async function handleSendMessage() {
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = 'Processing...';
    }

    const typedMessageText = messageInput.value.trim();
    // contentForLlm will now be of type UserContent (string or array of parts)
    let contentForLlm: UserContent = typedMessageText; 
    let displayContent = typedMessageText; // displayContent remains a string for the user's message bubble

    const attachmentInfo = getCurrentAttachmentInfo();

    // Step 1: Determine contentForLlm and displayContent based on attachment state
    if (attachmentInfo) {
        if (!isCurrentAttachmentContextCommitted()) {
            // This is the first send with this attachment.
            if (!window.electronAPI || !window.electronAPI.extractTextFromFile) {
                showToast("Attachment feature is not available.", "error");
                console.error("Renderer: electronAPI.extractTextFromFile is not defined.");
                if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
                return;
            }
            try {
                console.log(`Renderer: Extracting text from ${attachmentInfo.name} (${attachmentInfo.type}) for initial commit.`);
                const extractionResult = await window.electronAPI.extractTextFromFile(attachmentInfo.originalPath, attachmentInfo.type);

                if (extractionResult.error) {
                    showToast(`Error extracting text: ${extractionResult.error}`, "error");
                    if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
                    return;
                }

                if (extractionResult.extractedText && extractionResult.extractedText.trim() !== "") {
                    contentForLlm = `[Content from attachment: ${attachmentInfo.name}]\n\n${extractionResult.extractedText.trim()}\n\n`;
                    if (typedMessageText) {
                        contentForLlm = `[Content from attachment: ${attachmentInfo.name}]\n\n${extractionResult.extractedText.trim()}\n\nUser's prompt:\n${typedMessageText}`;
                    } else {
                        contentForLlm = `[Content from attachment: ${attachmentInfo.name}]\n\n${extractionResult.extractedText.trim()}`;
                        displayContent = `[Attachment: ${attachmentInfo.name} processed for context]`;
                    }
                    markCurrentAttachmentContextAsCommitted();
                } else if (extractionResult.base64ImageData && extractionResult.imageMimeType) {
                    // Image attachment
                    const imagePart: ImageContentPart = {
                        type: 'image_url',
                        image_url: { url: `data:${extractionResult.imageMimeType};base64,${extractionResult.base64ImageData}` }
                    };
                    if (typedMessageText) {
                        contentForLlm = [imagePart, { type: 'text', text: typedMessageText }];
                        displayContent = `[Image: ${attachmentInfo.name}] ${typedMessageText}`; // For user's own bubble
                    } else {
                        contentForLlm = [imagePart, { type: 'text', text: `Describe this image: ${attachmentInfo.name}` }]; // Default prompt if no text
                        displayContent = `[Image: ${attachmentInfo.name} sent for analysis]`; // For user's own bubble
                    }
                    markCurrentAttachmentContextAsCommitted();
                } else { // Attachment was empty or yielded no text/image
                    if (!typedMessageText) { // Attachment empty AND no typed text
                        showToast("Attached file is empty and no message typed.", "info");
                        if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
                        return;
                    }
                    // Attachment empty, but user typed something. contentForLlm is already typedMessageText.
                    // Display content is also already typedMessageText.
                    markCurrentAttachmentContextAsCommitted(); // Mark as "handled" so we don't try to re-process empty file
                }
            } catch (error) {
                console.error("Renderer: Error during attachment processing:", error);
                showToast("Error processing attachment.", "error");
                if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
                return;
            }
        } else {
            // Attachment context is already committed. LLM will see it in history.
            // contentForLlm is just the typedMessageText for this specific turn.
            // displayContent is also just the typedMessageText.
            console.log(`Renderer: Attachment ${attachmentInfo.name} context previously committed. Sending current typed prompt for LLM.`);
            // No change to contentForLlm or displayContent needed here as they default to typedMessageText
        }
    }

    // Step 2: Validate if there's anything to send to LLM.
    // contentForLlm is what will be sent. 
    // Step 2: Validate if there's anything to send to LLM.
    let isEmptyContent = true; // Assume empty by default
    if (typeof contentForLlm === 'string') {
        if (contentForLlm.trim()) {
            isEmptyContent = false;
        }
    } else if (Array.isArray(contentForLlm)) {
        // If it's an array, it must have at least one part.
        // And if it's only text parts, at least one must be non-empty.
        // If it contains an image part, it's considered non-empty.
        if (contentForLlm.length > 0) {
            if (contentForLlm.some(part => part.type === 'image_url')) {
                isEmptyContent = false;
            } else if (contentForLlm.some(part => part.type === 'text' && part.text.trim())) {
                isEmptyContent = false;
            }
        }
    }
    // This check is specifically for the case where there was no typed text AND the attachment processing (which happened inside the 'if (attachmentInfo)' block)
    // did not result in 'contentForLlm' being populated with anything meaningful (e.g., an empty file was attached).
    // If 'contentForLlm' is still just an empty string (because typedMessageText was empty and attachment yielded nothing), it's empty.
    if (!typedMessageText && attachmentInfo && typeof contentForLlm === 'string' && !contentForLlm.trim()) {
         // This condition means typed text was empty, an attachment was present, but contentForLlm (which would have been updated by attachment processing)
         // is still an empty string. This implies the attachment processing didn't add any content.
         isEmptyContent = true;
    }


    if (isEmptyContent) {
        showToast("Please type a message or attach a file with actual content.", "info");
        if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
        return;
    }

    // Step 3: Check for model and session
    if (!currentSelectedModelEntryId) {
        showToast("Please select a model.", "error");
        if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
        return;
    }

    if (!activeSessionId) {
        const newSession = await handleNewChatButtonClick();
        if (!newSession || !newSession.id) {
            if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
            return;
        }
    }
    if (!activeSessionId) {
        showToast("No active chat session.", "error");
        if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
        return;
    }

    // Step 4: Prepare and send message
    if (messageInput) messageInput.value = '';
    if (sendButton) sendButton.textContent = 'Sending...'; // Button is already disabled

    const userMessageForDisplay: ChatMessage = { role: 'user', content: displayContent };
    currentConversationMessages.push(userMessageForDisplay);
    addMessageToChat(userMessageForDisplay);

    try {
        await window.electronAPI.addMessageToChatSession(activeSessionId, userMessageForDisplay);
        // Auto-title update logic (only if it's a "real" first user message, not just an attachment placeholder)
        if ((currentConversationMessages.length === 1 ||
            (currentConversationMessages.filter(m => m.role === 'user').length === 1)) &&
            displayContent !== `[Attachment: ${attachmentInfo?.name || 'file'} processed for context]` &&
            typedMessageText // Ensure there was actual typed text for the title
            ) {
            const sessionToUpdate = allSessionsMetadata.find(s => s.id === activeSessionId);
            if (sessionToUpdate && sessionToUpdate.title.startsWith('New Chat')) {
                // The main process's addMessageToChatSession already updates the title based on the first user message.
                // We just need to re-fetch metadata to reflect this in the UI.
                const updatedMetadatas = await window.electronAPI.loadChatSessionsMetadata();
                allSessionsMetadata = updatedMetadatas.map(s => ({id: s.id!, title: s.title!, createdAt: s.createdAt!, lastModifiedAt: s.lastModifiedAt!, activePersonaId: s.activePersonaId}));
                renderChatList();
            }
        }
    } catch (error) {
        console.error(`Renderer: Error saving user message (for display) to session ${activeSessionId}:`, error);
    }

    const thinkingMessageId = `thinking-${Date.now()}`;
    const thinkingComponent = document.createElement('chat-message-component');
    thinkingComponent.id = thinkingMessageId; // Host ID for easy removal
    thinkingComponent.role = 'assistant';
    // Use the new assistantOutput structure for the thinking message
    thinkingComponent.messageContent = '...'; // This will trigger the loading indicator in the component
                                              // No need to set assistantOutput directly for this special case if component handles '...'
    if (chatMessagesDiv) {
        chatMessagesDiv.appendChild(thinkingComponent);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    }

    // Prepare historyForPayload for the LLM
    // Deep clone currentConversationMessages. 
    // The 'content' of the last user message in this clone will be replaced with `contentForLlm`.
    // `userMessageForDisplay.content` (which is always a string) is what's shown in the UI for the user's own message.
    let historyForPayload: ChatMessage[] = JSON.parse(JSON.stringify(currentConversationMessages)); 
    
    if (historyForPayload.length > 0) {
        const lastMessageIndex = historyForPayload.length - 1;
        if (historyForPayload[lastMessageIndex].role === 'user') {
            // Replace the content of the last user message in the payload history
            // with the potentially multi-modal contentForLlm.
            // The original userMessageForDisplay (with string content) is already in currentConversationMessages for UI and storage.
            historyForPayload[lastMessageIndex].content = contentForLlm; 
        } else {
            // This should ideally not happen if userMessageForDisplay was just pushed.
            console.warn("Renderer: Last message in historyForPayload was not a user message. Appending contentForLlm as new user message.");
            historyForPayload.push({ role: 'user', content: contentForLlm });
        }
    } else { 
         // This case implies currentConversationMessages was empty, which means userMessageForDisplay was the first.
         // historyForPayload would be [{ role: 'user', content: displayContent }]. We need to update its content.
         // However, the logic above pushes userMessageForDisplay to currentConversationMessages first,
         // so historyForPayload should always have at least one message if we reach here.
         // For safety, if it's somehow empty, create the user message with contentForLlm.
         console.warn("Renderer: historyForPayload was unexpectedly empty. Creating user message with contentForLlm.");
         historyForPayload.push({role: 'user', content: contentForLlm });
    }

    // Apply persona if active
    if (currentChatActivePersonaId) {
        const selectedPersona = allPersonas.find(p => p.id === currentChatActivePersonaId);
        if (selectedPersona) {
            console.log(`Renderer: Applying persona "${selectedPersona.name}"`);
            if (historyForPayload.length === 0 || !(historyForPayload[0].role === 'system' && historyForPayload[0].content === selectedPersona.prompt)) {
                historyForPayload.unshift({ role: 'system', content: selectedPersona.prompt });
            }
        } else {
            console.warn(`Renderer: Active persona ID ${currentChatActivePersonaId} not found.`);
        }
    }

    const payload: ChatPayload = {
        modelEntryId: currentSelectedModelEntryId!,
        history: historyForPayload,
        temperature: currentModelParams.temperature, 
        topP: currentModelParams.topP,                
        maxTokens: currentModelParams.maxTokens,      
    };

    // Log the entire payload being sent to main
    console.log('Renderer: Payload being sent to main:', JSON.stringify(payload, null, 2));

    console.log(`Renderer: Sending message. LLM Payload History Length: ${payload.history.length}. Last user content for LLM (type: ${typeof contentForLlm === 'string' ? 'string' : 'array'}, first 100 chars if string): "${typeof contentForLlm === 'string' ? contentForLlm.substring(0,100) : '[Multipart Content]' }..."`);
    if (Array.isArray(contentForLlm)) {
        console.log("Renderer: Multi-modal content parts for LLM:", JSON.stringify(contentForLlm, null, 2));
    }


    try {
        const assistantOutputResponse = await window.electronAPI.sendChatMessage(payload); // Now returns AssistantOutputContent
        removeMessageById(thinkingMessageId);
        
        let finalAssistantMessageContent = '';
        if (assistantOutputResponse.type === 'text') {
            finalAssistantMessageContent = assistantOutputResponse.text_content || '';
        } else if (assistantOutputResponse.type === 'image') {
            // For now, the component handles the image URL.
            // We can set a placeholder text or caption if available.
            finalAssistantMessageContent = assistantOutputResponse.text_content || `[Image]`; // Or an empty string
        } else if (assistantOutputResponse.type === 'error') {
            finalAssistantMessageContent = assistantOutputResponse.error_message || 'An unknown error occurred.';
             // Create an error message object to pass to addMessageToChat
            const errorMessageObj: ChatMessage = {
                role: 'error',
                content: finalAssistantMessageContent,
                assistantOutput: assistantOutputResponse // Pass the full error structure
            };
            addMessageToChat(errorMessageObj);
            // Skip adding to currentConversationMessages or session storage for this specific error display
            return; // Exit after displaying error
        }


        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: finalAssistantMessageContent, // Main textual content for history/search
            assistantOutput: assistantOutputResponse, // The full structured output
            modelUsed: modelSelector.options[modelSelector.selectedIndex]?.text || 'Unknown Model Config',
            personaUsedId: currentChatActivePersonaId,
            personaUsedName: currentChatActivePersonaId ? (allPersonas.find(p => p.id === currentChatActivePersonaId)?.name || null) : null
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
        addMessageToChat({ 
            role: 'error', 
            content: `Error: ${error.message || 'Failed to get response.'}`,
            assistantOutput: { type: 'error', error_message: `Error: ${error.message || 'Failed to get response.'}` }
        });
    } finally {
        if(sendButton) { sendButton.disabled = false; sendButton.textContent = 'Send'; }
        if (messageInput) messageInput.focus();
    }
}

if (sendButton) { sendButton.addEventListener('click', handleSendMessage); }
if (messageInput) {
    messageInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSendMessage(); }
    });
}

// REMOVED: Attachment handling functions (displaySelectedAttachment, clearAttachmentSelection, handleAttachFile)
// are now in attachment-handler.ts

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure API keys are loaded and cached first, as model dropdown depends on them for labels
    await loadAndDisplayApiKeys(); // This function is exported from settings-api-keys-ui.ts
                                 // and updates the cachedApiKeys in renderer.ts
    
    loadAndPopulateChatModelDropdown(); // Now this can safely use cachedApiKeys
    
    await loadAndDisplayChatSessions(); // This will now also init displayedSessionsMetadata
    await populatePersonaSelector();
    setupApiKeysAddListeners();
    setupEnabledModelsAddListeners();
    setupPersonaManagementListeners();
    setupAttachFileButtonListener(); // NEW: Setup listener from attachment handler
    if (chatSearchInput) { // Setup chat search
        setupChatSearch(chatSearchInput, handleSearchResults);
    }
    setupModelParamsPopoverListeners(); // NEW: Setup listeners for the model params popover
});

// --- Model Parameters Popover Logic ---
function setupModelParamsPopoverListeners() {
    const modelParamsButton = document.getElementById('model-params-button') as HTMLButtonElement | null;
    const modelParamsPopover = document.getElementById('model-params-popover') as HTMLDivElement | null;
    const closeModelParamsButton = document.getElementById('close-model-params-button') as HTMLButtonElement | null;
    const paramTemperatureInput = document.getElementById('param-temperature') as HTMLInputElement | null;
    const paramTopPInput = document.getElementById('param-top-p') as HTMLInputElement | null;
    const paramMaxTokensInput = document.getElementById('param-max-tokens') as HTMLInputElement | null;

    if (!modelParamsButton || !modelParamsPopover || !closeModelParamsButton || !paramTemperatureInput || !paramTopPInput || !paramMaxTokensInput) {
        console.warn("Renderer: Model parameters UI elements not all found. Popover functionality may be limited.");
        return;
    }

    const updateParam = (param: keyof typeof currentModelParams, value: string | number, min: number, max: number, isFloat: boolean = false) => {
        let numValue = Number(value);
        if (isNaN(numValue)) { 
            // If input is not a number, revert to current stored value or a default if still NaN
            numValue = currentModelParams[param]; 
            if (isNaN(numValue)) { // Fallback if currentModelParams[param] was also somehow NaN
                if (param === 'temperature') numValue = 0.7;
                else if (param === 'topP') numValue = 1.0;
                else if (param === 'maxTokens') numValue = 2048;
                else numValue = min; // General fallback
            }
        }
        if (numValue < min) numValue = min;
        if (numValue > max) numValue = max;
    
        if (isFloat) {
            currentModelParams[param] = parseFloat(numValue.toFixed(param === 'temperature' ? 1 : 2)); 
        } else {
            currentModelParams[param] = Math.round(numValue); 
        }
    
        // Update the input field to reflect the validated and formatted value
        if (param === 'temperature' && paramTemperatureInput) paramTemperatureInput.value = currentModelParams.temperature.toFixed(1);
        if (param === 'topP' && paramTopPInput) paramTopPInput.value = currentModelParams.topP.toFixed(2);
        if (param === 'maxTokens' && paramMaxTokensInput) paramMaxTokensInput.value = currentModelParams.maxTokens.toString();
    
        console.log("Renderer: Model params updated:", currentModelParams);
    };

    paramTemperatureInput.addEventListener('input', () => updateParam('temperature', paramTemperatureInput.value, 0.0, 2.0, true));
    paramTopPInput.addEventListener('input', () => updateParam('topP', paramTopPInput.value, 0.0, 1.0, true));
    paramMaxTokensInput.addEventListener('input', () => updateParam('maxTokens', paramMaxTokensInput.value, 1, 65500, false)); // Min 1 for maxTokens

    modelParamsButton.addEventListener('click', (event) => {
        event.stopPropagation(); 
        if (!modelParamsPopover || !paramTemperatureInput || !paramTopPInput || !paramMaxTokensInput) return;
        const isVisible = modelParamsPopover.style.display === 'block';
        modelParamsPopover.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            // Populate inputs with current global values when popover is opened
            paramTemperatureInput.value = currentModelParams.temperature.toFixed(1);
            paramTopPInput.value = currentModelParams.topP.toFixed(2);
            paramMaxTokensInput.value = currentModelParams.maxTokens.toString();
            console.log("Renderer: Model params popover opened and populated.");
        }
    });

    if (closeModelParamsButton && modelParamsPopover) {
        closeModelParamsButton.addEventListener('click', () => {
            modelParamsPopover.style.display = 'none';
        });
    }

    if (modelParamsPopover && modelParamsButton) {
        window.addEventListener('click', (event) => {
            if (modelParamsPopover.style.display === 'block') {
                if (!modelParamsPopover.contains(event.target as Node) && event.target !== modelParamsButton) {
                    modelParamsPopover.style.display = 'none';
                }
            }
        });
    }
}


// --- Search Results Handler ---
function handleSearchResults(results: PreloadChatSessionMetadata[] | null) {
    if (results === null) { // Search cleared or empty
        displayedSessionsMetadata = [...allSessionsMetadata];
    } else {
        displayedSessionsMetadata = results;
    }
    renderChatList(); // Re-render the chat list with filtered/full data
}

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
        // Ensure allSessionsMetadata uses PreloadChatSessionMetadata
        allSessionsMetadata = sessions.map(s => ({
            id: s.id!,
            title: s.title!,
            createdAt: s.createdAt!,
            lastModifiedAt: s.lastModifiedAt!,
            activePersonaId: s.activePersonaId
        } as PreloadChatSessionMetadata));

        displayedSessionsMetadata = [...allSessionsMetadata]; // Initialize displayed list

        if (chatSearchInput) chatSearchInput.value = ''; // Clear search on full load

        renderChatList(); // Will use displayedSessionsMetadata

        if (displayedSessionsMetadata.length > 0) {
            // Select the first chat from the potentially filtered (but initially full) list
            await selectChatSession(displayedSessionsMetadata[0].id);
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

    const searchTerm = chatSearchInput ? chatSearchInput.value.trim() : "";

    if (displayedSessionsMetadata.length === 0) {
        if (searchTerm) { // If search was active and found nothing
            chatListUl.innerHTML = '<li>No matching chats found.</li>';
        } else { // No chats at all
            chatListUl.innerHTML = '<li>(No chats yet)</li>';
        }
        return;
    }

    displayedSessionsMetadata.forEach(sessionMeta => { // Use displayedSessionsMetadata
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
    clearAttachmentSelectionFromHandler(); // Clear any active attachment

    if (!sessionId) return;
    console.log(`Renderer: Selecting chat session ${sessionId}`);
    try {
        // The search filter will persist when a chat is selected.
        // displayedSessionsMetadata will already hold the correct (potentially filtered) list.
        // renderChatList() at the end will highlight the active session within that list.

        const sessionMetadata = allSessionsMetadata.find(s => s.id === sessionId); // Find from the master list to get full details if needed
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
                // Add the "empty chat" message using addMessageToChat so it's a component and can be managed
                addMessageToChat({role: 'system', content: 'This chat is empty. Send a message to start!', id: 'system-empty-chat-message'});
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

async function handleNewChatButtonClick(): Promise<PreloadChatSessionMetadata | null> {
    console.log("Renderer: New Chat button clicked.");
    try {
        const newSessionMetadataPartial = await window.electronAPI.createNewChatSession();
        if (newSessionMetadataPartial && newSessionMetadataPartial.id) {
            const newSessionMetadata: PreloadChatSessionMetadata = {
                id: newSessionMetadataPartial.id,
                title: newSessionMetadataPartial.title || 'Untitled Chat',
                createdAt: newSessionMetadataPartial.createdAt || Date.now(),
                lastModifiedAt: newSessionMetadataPartial.lastModifiedAt || Date.now(),
                activePersonaId: newSessionMetadataPartial.activePersonaId || null
            };
            allSessionsMetadata.unshift(newSessionMetadata);

            // Clear search when creating a new chat
            if (chatSearchInput) chatSearchInput.value = "";
            displayedSessionsMetadata = [...allSessionsMetadata]; // Reset to show all

            renderChatList();
            await selectChatSession(newSessionMetadata.id); // This will also ensure displayedSessions is reset if search was active
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
            const personaPromptText = (typeof activePersona.prompt === 'string') ? activePersona.prompt : '[Invalid Persona Prompt Format]';
            markdownContent += `## Persona: ${activePersona.name}\n\n**System Prompt:**\n\n${personaPromptText.replace(/\n/g, '\n\n')}\n\n---\n\n`;
        } else {
            console.warn(`Renderer (Export): Active persona ID ${currentChatActivePersonaId} not found in allPersonas. Not adding to export.`);
        }
    }

    currentConversationMessages.forEach(msg => {
        let messageTextContent = '';
        if (typeof msg.content === 'string') {
            messageTextContent = msg.content;
        } else if (Array.isArray(msg.content)) {
            // For user messages with images, concatenate text parts and add a placeholder for the image.
            // For assistant image responses, msg.content is already a string like "[Image]" or a caption.
            msg.content.forEach(part => {
                if (part.type === 'text') {
                    messageTextContent += part.text;
                } else if (part.type === 'image_url') {
                    // If we want to include the filename, we'd need to store it with the UserContent parts.
                    // For now, a generic placeholder.
                    messageTextContent += (messageTextContent ? '\n' : '') + '[Image Attached]'; 
                }
            });
        } else if (msg.role === 'assistant' && msg.assistantOutput?.type === 'image' && msg.assistantOutput?.text_content) {
            // This handles the case where assistant message.content is the caption string,
            // and we want to ensure it's used.
            messageTextContent = msg.assistantOutput.text_content;
        }


        if (msg.role === 'system') {
            markdownContent += `*System (Chat Internal): ${messageTextContent.replace(/\n/g, '\n\n')}*\n\n---\n\n`;
            return;
        }
        if (msg.role === 'error') {
             markdownContent += `**Error:**\n${messageTextContent.replace(/\n/g, '\n\n')}\n\n---\n\n`;
             return;
        }

        markdownContent += `**${msg.role === 'user' ? 'User' : 'Assistant'}**`;
        if (msg.role === 'assistant') {
            let assistantHeader = '';
            if (msg.modelUsed) {
                assistantHeader += ` (Model: ${msg.modelUsed}`;
            }
            if (msg.personaUsedName) { // Use personaUsedName from the message
                 assistantHeader += assistantHeader ? `, Persona: ${msg.personaUsedName}` : ` (Persona: ${msg.personaUsedName}`;
            }
            if (assistantHeader) {
                assistantHeader += ')';
            }
            markdownContent += assistantHeader;
        }
        markdownContent += `:\n\n${messageTextContent.replace(/\n/g, '\n\n')}\n\n---\n\n`;
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
