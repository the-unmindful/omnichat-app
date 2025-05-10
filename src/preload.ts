// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('Preload script loaded (Refactored for Enabled Models).');

// --- Interface Definitions (Consistent across preload, renderer, main) ---

// For API Keys (Safe version sent to renderer)
export interface ApiKeyEntry {
    id: string;
    provider: string;
    label: string;
}

// *** NEW: For Enabled Model Entries (Full details used in Settings) ***
export interface EnabledModelEntry {
    modelEntryId: string;
    userLabel: string;
    provider: string;
    modelId: string;
    apiKeyId: string;
}

// *** REVISED: For populating the Chat Dropdown (Derived from EnabledModelEntry) ***
export interface AvailableModel {
    modelEntryId: string; // Unique ID of the enabled model config (used as value)
    displayLabel: string; // User-friendly label for the dropdown option
}

// For Chat Messages (Unchanged)
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'error';
    content: string;
    modelUsed?: string;
    id?: string;
}

// *** NEW: Interface for a distinct Chat Session (mirrors definition in index.ts) ***
export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    lastModifiedAt: number;
    messages: ChatMessage[]; // This still uses ChatMessage, which is fine
}

// *** REVISED: For Payload sent to main process for chat ***
export interface ChatPayload {
    modelEntryId: string; // Use the unique ID of the enabled model config
    history: ChatMessage[];
    // No longer needs apiKeyId here
}


// --- Define the shape of the API we're exposing via contextBridge (Updated) ---
export interface ElectronAPI {
    // API Key Management (Unchanged signatures)
    saveApiKey: (apiKeyData: { provider: string; label: string; value: string }) => Promise<boolean>;
    getApiKeys: () => Promise<ApiKeyEntry[]>;
    deleteApiKey: (keyId: string) => Promise<boolean>;
    copyApiKey: (keyId: string) => Promise<boolean>;

    // *** NEW: Enabled Model Management ***
    addEnabledModel: (modelData: Omit<EnabledModelEntry, 'modelEntryId'>) => Promise<boolean>;
    getEnabledModels: () => Promise<EnabledModelEntry[]>;
    deleteEnabledModel: (modelEntryId: string) => Promise<boolean>;

    // *** REVISED: Get Models for Chat Dropdown ***
    getModelsForChatDropdown: () => Promise<AvailableModel[]>; // Renamed and different return type

    // *** REVISED: Chat Function (Payload changed) ***
    sendChatMessage: (payload: ChatPayload) => Promise<string>; // This can remain if individual message sending is still needed per session

    // --- NEW/REVISED Chat Session Management Signatures ---
    createNewChatSession: () => Promise<Partial<ChatSession> | null>; // Returns metadata of new session
    loadChatSessionsMetadata: () => Promise<Partial<ChatSession>[]>; // Returns array of session metadata
    loadChatSessionMessages: (sessionId: string) => Promise<ChatMessage[]>; // Returns messages for a session
    addMessageToChatSession: (sessionId: string, message: ChatMessage) => Promise<boolean>;
    deleteChatSession: (sessionId: string) => Promise<boolean>;
    updateChatSessionTitle: (sessionId: string, newTitle: string) => Promise<boolean>;

    // Export Chat
    exportChatToFile: (markdownContent: string, suggestedFilename: string) => Promise<{ success: boolean, filePath?: string, error?: string }>;

    // Copy Text to Clipboard
    copyTextToClipboard: (text: string) => Promise<boolean>;

    // REMOVE OLD HISTORY HANDLERS (saveChatHistory, loadChatHistory are now obsolete)
}


// --- Expose protected methods to the Renderer process (Updated) ---
contextBridge.exposeInMainWorld('electronAPI', {
    // --- API Key Functions (Mapped to IPC handlers) ---
    saveApiKey: (apiKeyData) => {
        console.log('Preload: Sending save-api-key request');
        return ipcRenderer.invoke('save-api-key', apiKeyData);
    },
    getApiKeys: () => {
        console.log('Preload: Sending get-api-keys request');
        return ipcRenderer.invoke('get-api-keys');
    },
    deleteApiKey: (keyId) => {
        console.log(`Preload: Sending delete-api-key request for ID: ${keyId}`);
        return ipcRenderer.invoke('delete-api-key', keyId);
    },
    copyApiKey: (keyId) => {
        console.log(`Preload: Sending copy-api-key request for ID: ${keyId}`);
        return ipcRenderer.invoke('copy-api-key', keyId);
    },

    // --- Enabled Model Functions (Mapped to IPC handlers) ---
    addEnabledModel: (modelData: Omit<EnabledModelEntry, 'modelEntryId'>) => {
        console.log('Preload: Sending add-enabled-model request');
        return ipcRenderer.invoke('add-enabled-model', modelData);
    },
    getEnabledModels: () => {
        console.log('Preload: Sending get-enabled-models request');
        return ipcRenderer.invoke('get-enabled-models');
    },
    deleteEnabledModel: (modelEntryId: string) => {
        console.log(`Preload: Sending delete-enabled-model request for ID: ${modelEntryId}`);
        return ipcRenderer.invoke('delete-enabled-model', modelEntryId);
    },

    // --- Get Models for Chat Dropdown (Mapped to IPC handler) ---
    getModelsForChatDropdown: () => {
        console.log('Preload: Sending get-models-for-chat-dropdown request');
        return ipcRenderer.invoke('get-models-for-chat-dropdown'); // Matches revised handler name
    },

    // --- Chat Function (Mapped to IPC handler) ---
    sendChatMessage: (payload: ChatPayload): Promise<string> => {
        console.log('Preload: Sending send-chat-message request with modelEntryId');
        return ipcRenderer.invoke('send-chat-message', payload);
    },

    // --- NEW Chat Session Management Mappings ---
    createNewChatSession: () => {
        console.log('Preload: Sending create-new-chat-session request');
        return ipcRenderer.invoke('create-new-chat-session');
    },
    loadChatSessionsMetadata: () => {
        console.log('Preload: Sending load-chat-sessions-metadata request');
        return ipcRenderer.invoke('load-chat-sessions-metadata');
    },
    loadChatSessionMessages: (sessionId: string) => {
        console.log(`Preload: Sending load-chat-session-messages request for ID: ${sessionId}`);
        return ipcRenderer.invoke('load-chat-session-messages', sessionId);
    },
    addMessageToChatSession: (sessionId: string, message: ChatMessage) => {
        console.log(`Preload: Sending add-message-to-chat-session request for ID: ${sessionId}`);
        return ipcRenderer.invoke('add-message-to-chat-session', sessionId, message);
    },
    deleteChatSession: (sessionId: string) => {
        console.log(`Preload: Sending delete-chat-session request for ID: ${sessionId}`);
        return ipcRenderer.invoke('delete-chat-session', sessionId);
    },
    updateChatSessionTitle: (sessionId: string, newTitle: string) => {
        console.log(`Preload: Sending update-chat-session-title request for ID: ${sessionId}`);
        return ipcRenderer.invoke('update-chat-session-title', sessionId, newTitle);
    },

    // Export Chat Mapping
    exportChatToFile: (markdownContent: string, suggestedFilename: string) => {
        console.log('Preload: Sending handle-export-chat request');
        return ipcRenderer.invoke('handle-export-chat', markdownContent, suggestedFilename);
    },

    // Copy Text to Clipboard Mapping
    copyTextToClipboard: (text: string) => {
        console.log('Preload: Sending handle-copy-to-clipboard request');
        return ipcRenderer.invoke('handle-copy-to-clipboard', text);
    }

    // REMOVE OLD MAPPINGS for saveChatHistory and loadChatHistory
} as ElectronAPI); // Cast to our defined interface


// Optional: You can also listen for messages SENT FROM main process to renderer
// Example: ipcRenderer.on('main-to-renderer-event', (event, args) => { ... });
