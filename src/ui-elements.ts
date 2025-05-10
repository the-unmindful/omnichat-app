// This file centralizes all DOM element selections for the renderer process.

// ## Main Chat UI Elements ##
export const modelSelector = document.getElementById('model-selector') as HTMLSelectElement;
export const chatMessagesDiv = document.getElementById('chat-messages') as HTMLDivElement | null; // Ensure it's queryable
export const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
export const sendButton = document.getElementById('send-button') as HTMLButtonElement;
export const chatHeaderModelSpan = document.querySelector('.chat-header span') as HTMLSpanElement;
export const exportChatButton = document.getElementById('export-chat-button') as HTMLButtonElement | null;

// Attachment UI Elements (NEW)
export const attachFileButton = document.getElementById('attach-file-button') as HTMLButtonElement | null;
export const selectedAttachmentDisplay = document.getElementById('selected-attachment-display') as HTMLDivElement | null;

// ## Sidebar Elements ##
export const chatListUl = document.getElementById('chat-list') as HTMLUListElement | null;
export const newChatButton = document.getElementById('new-chat-button') as HTMLButtonElement | null;
export const chatSearchInput = document.getElementById('chat-search-input') as HTMLInputElement | null;

// ## Main Chat UI Elements ## (Continued)
export const personaSelector = document.getElementById('persona-selector') as HTMLSelectElement | null;

// ## Settings Modal Elements ##
export const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
export const openSettingsButton = document.getElementById('open-settings-button') as HTMLButtonElement | null; // getElementById can return null
export const closeSettingsButton = document.getElementById('close-settings-button') as HTMLButtonElement | null; // getElementById can return null

// # Settings - API Keys Section #
export const addApiKeyButton = document.getElementById('add-api-key-button') as HTMLButtonElement;
export const apiKeyListDiv = document.getElementById('api-key-list') as HTMLDivElement | null; // getElementById can return null
export const providerSelect = document.getElementById('api-provider') as HTMLSelectElement;
export const keyLabelInput = document.getElementById('api-key-label') as HTMLInputElement;
export const keyValueInput = document.getElementById('api-key-value') as HTMLInputElement;

// # Settings - Enabled Models Section #
export const addEnabledModelButton = document.getElementById('add-enabled-model-button') as HTMLButtonElement;
export const enabledModelListDiv = document.getElementById('enabled-model-list') as HTMLDivElement | null; // getElementById can return null
export const enabledModelUserLabelInput = document.getElementById('enabled-model-user-label') as HTMLInputElement;
export const enabledModelProviderSelect = document.getElementById('enabled-model-provider') as HTMLSelectElement;
export const enabledModelIdInput = document.getElementById('enabled-model-id') as HTMLInputElement;
export const enabledModelApiKeyLinkSelect = document.getElementById('enabled-model-api-key-link') as HTMLSelectElement;

// # Settings - Persona Management Section (NEW) #
export const personaNameInput = document.getElementById('persona-name-input') as HTMLInputElement | null;
export const personaPromptInput = document.getElementById('persona-prompt-input') as HTMLTextAreaElement | null;
export const savePersonaButton = document.getElementById('save-persona-button') as HTMLButtonElement | null;
export const clearPersonaFormButton = document.getElementById('clear-persona-form-button') as HTMLButtonElement | null;
export const personaListDiv = document.getElementById('persona-list-div') as HTMLDivElement | null;

// Toast Notifications
export const toastContainer = document.getElementById('toast-notification-container') as HTMLDivElement | null;
