import { app, BrowserWindow, ipcMain, clipboard, dialog } from 'electron'; // Added dialog
import path from 'path';
import fsPromises from 'fs/promises'; // Added fsPromises for async file operations
// Ensure this import is exactly correct and electron-store is installed
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios'; // <-- Import axios

// --- Define Interfaces ---

// For API Keys (sent TO renderer, and part of StoredApiKey)
interface ApiKeyEntry {
    id: string;
    provider: string;
    label: string;
}

// For storing API Keys securely
interface StoredApiKey extends ApiKeyEntry {
    encryptedValue: string; // Base64 encoded value
}

// *** NEW: For storing user-defined enabled model configurations ***
interface EnabledModelEntry {
    modelEntryId: string; // Unique ID for this model configuration entry
    userLabel: string;    // User-defined name (e.g., "OR Llama3 Free")
    provider: string;     // Provider type (e.g., "OpenRouter", "OpenAI") - determines API format
    modelId: string;      // The exact model ID string the provider expects
    apiKeyId: string;     // The 'id' of the key from the 'apiKeys' array to use
}

// *** NEW: For populating the chat dropdown (derived from EnabledModelEntry) ***
interface AvailableModel {
    modelEntryId: string; // Use this unique ID as the value in the dropdown
    displayLabel: string; // The user-friendly label for the dropdown option
}

// For chat messages (consistent across processes)
interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'error';
    content: string;
    modelUsed?: string;
    id?: string;
}

// *** NEW: Interface for a distinct Chat Session ***
interface ChatSession {
    id: string;          // Unique ID for the session
    title: string;       // Title for the chat session
    createdAt: number;   // Timestamp of creation
    lastModifiedAt: number; // Timestamp of the last message or modification
    messages: ChatMessage[]; // Array of messages for this specific session
}

// *** MODIFIED: Payload sent from renderer for chat ***
interface ChatPayload {
    modelEntryId: string; // NOW uses the unique ID of the enabled model configuration
    history: ChatMessage[];
    // apiKeyId is no longer needed here, it's looked up via modelEntryId
}

// *** MODIFIED: Define the overall schema structure for the store's data ***
type SchemaType = {
    apiKeys: StoredApiKey[];
    enabledModels: EnabledModelEntry[]; // Added enabled models array
    // chatHistory?: ChatMessage[]; // REMOVED old single history
    chatSessions?: ChatSession[];   // NEW: Array of chat sessions
};

// --- Initialize electron-store ---
// Initialize with the updated schema and defaults
const store = new Store<SchemaType>({
    defaults: {
        apiKeys: [],
        enabledModels: [], // Initialize with empty array
        // chatHistory: [] // REMOVED old default
        chatSessions: []  // NEW default
    },
});

// Log the store path
console.log('Store path:', store.path);

// --- Electron App Setup ---
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 700,
    width: 1000,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.once('ready-to-show', () => { mainWindow.show(); });
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};


// --- Helper Functions for Formatting History (Unchanged) ---
function formatHistoryForOpenAI(history: ChatMessage[]): { role: 'system' | 'user' | 'assistant'; content: string }[] {
    return history.filter(msg => ['system', 'user', 'assistant'].includes(msg.role))
                  .map(msg => ({ role: msg.role as 'system' | 'user' | 'assistant', content: msg.content }));
}
function formatHistoryForAnthropic(history: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
     return history.filter(msg => ['user', 'assistant'].includes(msg.role))
                   .map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content }));
}
function formatHistoryForGemini(history: ChatMessage[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
    const formatted: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    history.forEach(msg => {
        if (msg.role === 'user') formatted.push({ role: 'user', parts: [{ text: msg.content }] });
        else if (msg.role === 'assistant') formatted.push({ role: 'model', parts: [{ text: msg.content }] });
    });
    return formatted;
}


// --- IPC Handlers ---

// -- API Key Management Handlers (Unchanged) --
ipcMain.handle('save-api-key', async (event, apiKeyData: { provider: string; label: string; value: string }): Promise<boolean> => {
    console.log('Main: Handling save-api-key for', apiKeyData.label); try { const currentKeys: StoredApiKey[] = store.get('apiKeys'); const newKey: StoredApiKey = { id: uuidv4(), provider: apiKeyData.provider, label: apiKeyData.label, encryptedValue: Buffer.from(apiKeyData.value).toString('base64'), }; currentKeys.push(newKey); store.set('apiKeys', currentKeys); console.log(`Main: Key "${newKey.label}" saved.`); return true; } catch (error) { console.error('Main: Failed to save API key:', error); return false; }
});
ipcMain.handle('get-api-keys', async (event): Promise<ApiKeyEntry[]> => {
    console.log('Main: Handling get-api-keys request'); try { const storedKeys: StoredApiKey[] = store.get('apiKeys'); const safeKeys: ApiKeyEntry[] = storedKeys.map((key: StoredApiKey) => ({ id: key.id, provider: key.provider, label: key.label || '(No Label)', })); return safeKeys; } catch (error) { console.error('Main: Failed to get API keys:', error); return []; }
});
ipcMain.handle('delete-api-key', async (event, keyId: string): Promise<boolean> => {
    console.log(`Main: Handling delete-api-key for ID: ${keyId}`); try { let currentKeys: StoredApiKey[] = store.get('apiKeys'); currentKeys = currentKeys.filter((key: StoredApiKey) => key.id !== keyId); store.set('apiKeys', currentKeys); console.log(`Main: Key with ID ${keyId} deleted.`); /* TODO: Consider deleting linked enabledModels? Or let them fail? For now, just delete key. */ return true; } catch (error) { console.error('Main: Failed to delete API key:', error); return false; }
});
ipcMain.handle('copy-api-key', async (event, keyId: string): Promise<boolean> => {
    console.log(`Main: Handling copy-api-key for ID: ${keyId}`); try { const storedKeys: StoredApiKey[] = store.get('apiKeys'); const keyToCopy = storedKeys.find((key: StoredApiKey) => key.id === keyId); if (keyToCopy?.encryptedValue) { const decodedValue = Buffer.from(keyToCopy.encryptedValue, 'base64').toString('utf8'); clipboard.writeText(decodedValue); console.log(`Main: Key ${keyToCopy.label} copied.`); return true; } console.warn(`Main: Key with ID ${keyId} not found or value missing for copying.`); return false; } catch (error) { console.error('Main: Failed to copy API key:', error); return false; }
});


// -- *** NEW: Enabled Model Management Handlers *** --
ipcMain.handle('add-enabled-model', async (event, modelData: Omit<EnabledModelEntry, 'modelEntryId'>): Promise<boolean> => {
    console.log('Main: === Handling add-enabled-model ==='); // Mark start
    console.log('Main: Received model data:', JSON.stringify(modelData)); // Log exact data received

    try {
        const currentApiKeys = store.get('apiKeys');
        const linkedKeyExists = currentApiKeys.some(key => key.id === modelData.apiKeyId);
        console.log(`Main: API Key ID [${modelData.apiKeyId}] exists: ${linkedKeyExists}`);

        if (!linkedKeyExists) {
            console.error(`Main: Linked API key ID [${modelData.apiKeyId}] does NOT exist. Aborting save.`);
            throw new Error(`The selected API key does not exist.`);
        }

        const newModelEntry: EnabledModelEntry = {
            ...modelData,
            modelEntryId: uuidv4(),
        };
        console.log('Main: Generated new model entry:', JSON.stringify(newModelEntry));

        // ---> Critical Part <---
        const currentModels = store.get('enabledModels', []); // Provide default empty array
        console.log('Main: Models currently in store BEFORE adding:', JSON.stringify(currentModels));

        currentModels.push(newModelEntry);
        console.log('Main: Models array AFTER adding new entry:', JSON.stringify(currentModels));

        // ---> The actual save command <---
        console.log('Main: Attempting store.set("enabledModels", ...)')
        store.set('enabledModels', currentModels);
        console.log('Main: store.set completed.');
        // ---> Verify immediately after saving <---
        const modelsAfterSave = store.get('enabledModels');
        console.log('Main: Models read back from store IMMEDIATELY AFTER save:', JSON.stringify(modelsAfterSave));


        console.log(`Main: Add operation successful for "${newModelEntry.userLabel}"`);
        return true; // Indicate success back to renderer

    } catch (error) {
        console.error('Main: === Error during add-enabled-model ===:', error);
        // Rethrow so the renderer knows it failed
        throw error instanceof Error ? error : new Error('Failed to save the enabled model in main process.');
    }
});

ipcMain.handle('get-enabled-models', async (event): Promise<EnabledModelEntry[]> => {
    console.log('Main: Handling get-enabled-models request');
    try {
        // Return the full entries for display in settings
        const enabledModels = store.get('enabledModels');
        return enabledModels;
    } catch (error) {
        console.error('Main: Failed to get enabled models:', error);
        return [];
    }
});

ipcMain.handle('delete-enabled-model', async (event, modelEntryId: string): Promise<boolean> => {
    console.log(`Main: Handling delete-enabled-model for ID: ${modelEntryId}`);
    try {
        let currentModels = store.get('enabledModels');
        currentModels = currentModels.filter(model => model.modelEntryId !== modelEntryId);
        store.set('enabledModels', currentModels);
        console.log(`Main: Enabled model with ID ${modelEntryId} deleted.`);
        return true;
    } catch (error) {
        console.error('Main: Failed to delete enabled model:', error);
        return false;
    }
});


// -- *** REVISED: Get Models for Chat Dropdown Handler *** --
// Replaces the old 'get-available-models'
ipcMain.handle('get-models-for-chat-dropdown', async (event): Promise<AvailableModel[]> => {
    console.log('Main: Handling get-models-for-chat-dropdown request');
    try {
        const enabledModels = store.get('enabledModels');
        console.log('Main: Raw enabledModels read from store:', JSON.stringify(enabledModels));
        const apiKeys = store.get('apiKeys'); // Need keys to get labels for context

        // Map the enabled models to the simplified format needed for the chat dropdown
        const dropdownModels: AvailableModel[] = enabledModels.map(model => {
             // Find the linked API key to include its label for clarity
             const linkedKey = apiKeys.find(key => key.id === model.apiKeyId);
             const keyLabelHint = linkedKey ? ` (Key: ${linkedKey.label || 'Untitled'})` : ' (Key Missing!)'; // Indicate if key is missing

            return {
                modelEntryId: model.modelEntryId, // Use this unique ID as the value
                // Construct display label: UserLabel (Provider: ModelID) (Key: KeyLabel)
                 displayLabel: `${model.userLabel || model.modelId} (${model.provider}: ${model.modelId})${keyLabelHint}`,
                // Alternative simpler label: displayLabel: `${model.userLabel || model.modelId}${keyLabelHint}`,
            };
        });

        // Sort for consistency
        dropdownModels.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));

        console.log('Main: Returning models for chat dropdown:', dropdownModels.length);
        return dropdownModels;
    } catch (error) {
        console.error('Main: Failed to get models for chat dropdown:', error);
        return [];
    }
});


// -- *** REVISED: Send Chat Message Handler *** --
// Now uses modelEntryId from payload to look up configuration details
ipcMain.handle('send-chat-message', async (event, payload: ChatPayload): Promise<string> => {
     console.log(`\n--- New Chat Request ---`);
     console.log(`Main: Received request using Enabled Model Entry ID [${payload.modelEntryId}]`);

     // 1. Find the Enabled Model Entry from the store
     const enabledModels = store.get('enabledModels');
     const modelEntry = enabledModels.find(m => m.modelEntryId === payload.modelEntryId);

     if (!modelEntry) {
         console.error(`Main: Enabled Model Entry NOT FOUND for ID: ${payload.modelEntryId}`);
         throw new Error(`Configuration for selected model not found. Please check settings.`);
     }
     console.log(`Main: Found Enabled Model: Label [${modelEntry.userLabel}], Provider [${modelEntry.provider}], ModelID [${modelEntry.modelId}], KeyID [${modelEntry.apiKeyId}]`);

    // 2. Find the associated API Key from the store using the ID from the model entry
    const storedKeys = store.get('apiKeys');
    const apiKeyData = storedKeys.find(key => key.id === modelEntry.apiKeyId); // Use apiKeyId from modelEntry

    if (!apiKeyData) {
        console.error(`Main: API Key NOT FOUND for ID: ${modelEntry.apiKeyId} (linked to model ${modelEntry.userLabel})`);
        throw new Error(`API Key linked to the selected model configuration was not found. Please check settings.`);
    }
    console.log(`Main: Found Linked Key Label: [${apiKeyData.label}]`);


    // Extract necessary info from the found entries
    const apiKey = Buffer.from(apiKeyData.encryptedValue, 'base64').toString('utf8');
    const provider = modelEntry.provider; // Use provider from the model entry
    const modelId = modelEntry.modelId;   // Use modelId from the model entry
    const history = payload.history;

    console.log(`Main: Preparing API call | Provider: ${provider} | Model ID: ${modelId} | API Key Starts With: ${apiKey.substring(0, 4)}...`);

    // Basic configuration (can be expanded later)
    const temperature = 0.7;
    const maxTokens = 2048; // Adjust as needed

    // --- Actual API Call Logic (Unchanged from previous step, uses derived provider/modelId) ---
    try {
        let responseContent = '';
        switch (provider) {
            case 'OpenAI': { /* ... OpenAI call logic using modelId ... */
                const url = 'https://api.openai.com/v1/chat/completions'; const headers = { 'Authorization': `Bearer ${apiKey}` }; const data = { model: modelId, messages: formatHistoryForOpenAI(history), temperature: temperature, }; console.log(`Main: Calling OpenAI (${modelId}). History length: ${data.messages.length}`); const response = await axios.post(url, data, { headers }); responseContent = response.data.choices?.[0]?.message?.content?.trim(); if (!responseContent) { console.error("Main: OpenAI response format error or empty content", response.data); throw new Error("Received an unexpected response format from OpenAI."); }
                break;
            }
            case 'OpenRouter': { /* ... OpenRouter call logic using modelId ... */
                const url = 'https://openrouter.ai/api/v1/chat/completions'; const headers = { 'Authorization': `Bearer ${apiKey}`, 'HTTP-Referer': 'http://localhost', 'X-Title': 'OmniChat', }; const data = { model: modelId, messages: formatHistoryForOpenAI(history), temperature: temperature, }; console.log(`Main: Calling OpenRouter (${modelId}). History length: ${data.messages.length}`); const response = await axios.post(url, data, { headers }); responseContent = response.data.choices?.[0]?.message?.content?.trim(); if (!responseContent) { console.error("Main: OpenRouter response format error or empty content", response.data); throw new Error("Received an unexpected response format from OpenRouter."); }
                break;
            }
            case 'Anthropic': { /* ... Anthropic call logic using modelId ... */
                const url = 'https://api.anthropic.com/v1/messages'; const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', }; const data = { model: modelId, messages: formatHistoryForAnthropic(history), max_tokens: maxTokens, temperature: temperature, }; console.log(`Main: Calling Anthropic (${modelId}). History length: ${data.messages.length}`); const response = await axios.post(url, data, { headers }); responseContent = response.data.content?.[0]?.text?.trim(); if (!responseContent) { console.error("Main: Anthropic response format error or empty content", response.data); throw new Error("Received an unexpected response format from Anthropic."); }
                break;
             }
             case 'Gemini': { /* ... Gemini call logic using modelId ... */
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`; const headers = { 'Content-Type': 'application/json' }; const data = { contents: formatHistoryForGemini(history), generationConfig: { temperature: temperature, maxOutputTokens: maxTokens, }, }; console.log(`Main: Calling Gemini (${modelId}). History length: ${data.contents.length}`); const response = await axios.post(url, data, { headers }); if (response.data.promptFeedback?.blockReason) { console.warn("Main: Gemini blocked prompt:", response.data.promptFeedback.blockReason); throw new Error(`Request blocked by Gemini for safety reasons: ${response.data.promptFeedback.blockReason}`); } if (response.data.candidates?.[0]?.finishReason === 'SAFETY') { console.warn("Main: Gemini blocked response for safety."); throw new Error("Response blocked by Gemini for safety reasons."); } responseContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim(); if (!responseContent) { console.error("Main: Gemini response format error or empty content", response.data); throw new Error("Received an unexpected response format from Gemini."); }
                break;
             }
            default:
                console.error(`Main: Unsupported provider "${provider}" specified in enabled model entry.`);
                throw new Error(`API provider "${provider}" configured for this model is not supported.`);
        }
        // ... (rest of the try block - success logging) ...
        console.log(`Main: Received response from ${provider}. Length: ${responseContent.length}`);
        console.log(`--- Chat Request End ---`);
        return responseContent; // Return the successfully extracted content

    } catch (error) {
        // ... (rest of the catch block - error logging and rethrowing) ...
         console.error(`Main: Error during API call to ${provider} (${modelId}):`, error.response?.data || error.message || error); let apiErrorMessage = 'API call failed.'; if (axios.isAxiosError(error)) { const errorData = error.response?.data; if (errorData?.error?.message) apiErrorMessage = `API Error: ${errorData.error.message}`; else if (errorData?.type === 'error' && errorData?.error?.message) apiErrorMessage = `API Error: ${errorData.error.message}`; else if (error.message) apiErrorMessage = error.message; } else if (error instanceof Error) { apiErrorMessage = error.message; } console.log(`--- Chat Request End (Error) ---`); throw new Error(apiErrorMessage);
    }
});
// ***** END OF REVISED HANDLER *****

// -- NEW Chat Session Management IPC Handlers --

// Create a new chat session
ipcMain.handle('create-new-chat-session', async (): Promise<Partial<ChatSession> | null> => {
    try {
        const sessions = store.get('chatSessions', []);
        const newSession: ChatSession = {
            id: uuidv4(),
            title: `New Chat ${new Date().toLocaleString()}`, // Placeholder title
            createdAt: Date.now(),
            lastModifiedAt: Date.now(),
            messages: [],
        };
        sessions.push(newSession);
        store.set('chatSessions', sessions);
        console.log('Main: New chat session created. ID:', newSession.id);
        // Return metadata for the new session
        return { 
            id: newSession.id, 
            title: newSession.title, 
            createdAt: newSession.createdAt, 
            lastModifiedAt: newSession.lastModifiedAt 
        };
    } catch (error) {
        console.error('Main: Failed to create new chat session:', error);
        throw error; // Rethrow to be caught by renderer
    }
});

// Load metadata for all chat sessions (for sidebar list)
ipcMain.handle('load-chat-sessions-metadata', async (): Promise<Partial<ChatSession>[]> => {
    try {
        const sessions = store.get('chatSessions', []);
        const metadata = sessions
            .map(session => ({
                id: session.id,
                title: session.title,
                createdAt: session.createdAt,
                lastModifiedAt: session.lastModifiedAt,
            }))
            .sort((a, b) => b.lastModifiedAt - a.lastModifiedAt); // Sort by most recent
        console.log('Main: Loaded metadata for chat sessions. Count:', metadata.length);
        return metadata;
    } catch (error) {
        console.error('Main: Failed to load chat sessions metadata:', error);
        return [];
    }
});

// Load messages for a specific chat session
ipcMain.handle('load-chat-session-messages', async (event, sessionId: string): Promise<ChatMessage[]> => {
    try {
        const sessions = store.get('chatSessions', []);
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            console.log('Main: Loaded messages for session ID:', sessionId, 'Count:', session.messages.length);
            return session.messages;
        }
        console.warn('Main: Session not found for ID (load messages):', sessionId);
        return []; // Or throw new Error('Session not found');
    } catch (error) {
        console.error('Main: Failed to load messages for session ID:', sessionId, error);
        return [];
    }
});

// Add a message to a specific chat session
ipcMain.handle('add-message-to-chat-session', async (event, sessionId: string, message: ChatMessage): Promise<boolean> => {
    try {
        const sessions = store.get('chatSessions', []);
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex > -1) {
            sessions[sessionIndex].messages.push(message);
            sessions[sessionIndex].lastModifiedAt = Date.now();
            // If it's the first user message and title is generic, update title
            if (sessions[sessionIndex].messages.length === 1 && message.role === 'user' && sessions[sessionIndex].title.startsWith('New Chat')) {
                sessions[sessionIndex].title = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
            }
            store.set('chatSessions', sessions);
            console.log('Main: Message added to session ID:', sessionId);
            return true;
        }
        console.warn('Main: Session not found for ID (add message):', sessionId);
        return false;
    } catch (error) {
        console.error('Main: Failed to add message to session ID:', sessionId, error);
        return false;
    }
});

// Delete a specific chat session
ipcMain.handle('delete-chat-session', async (event, sessionId: string): Promise<boolean> => {
    try {
        let sessions = store.get('chatSessions', []);
        sessions = sessions.filter(s => s.id !== sessionId);
        store.set('chatSessions', sessions);
        console.log('Main: Deleted session ID:', sessionId);
        return true;
    } catch (error) {
        console.error('Main: Failed to delete session ID:', sessionId, error);
        return false;
    }
});

// Update a chat session's title
ipcMain.handle('update-chat-session-title', async (event, sessionId: string, newTitle: string): Promise<boolean> => {
    try {
        const sessions = store.get('chatSessions', []);
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex > -1) {
            sessions[sessionIndex].title = newTitle;
            sessions[sessionIndex].lastModifiedAt = Date.now(); // Also update lastModified to reflect change
            store.set('chatSessions', sessions);
            console.log('Main: Updated title for session ID:', sessionId);
            return true;
        }
        console.warn('Main: Session not found for ID (update title):', sessionId);
        return false;
    } catch (error) {
        console.error('Main: Failed to update title for session ID:', sessionId, error);
        return false;
    }
});

// -- Export Chat Handler --
ipcMain.handle('handle-export-chat', async (event, markdownContent: string, suggestedFilename: string): Promise<{ success: boolean, filePath?: string, error?: string }> => {
    console.log('Main: Handling export-chat request. Suggested filename:', suggestedFilename);
    if (!BrowserWindow.getFocusedWindow()) {
        console.error('Main: No focused window to show save dialog.');
        return { success: false, error: 'No active window to show save dialog.' };
    }
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
            title: 'Export Chat As Markdown',
            defaultPath: suggestedFilename,
            filters: [
                { name: 'Markdown Files', extensions: ['md'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (canceled || !filePath) {
            console.log('Main: Export chat dialog canceled by user.');
            return { success: false };
        }

        await fsPromises.writeFile(filePath, markdownContent, 'utf8');
        console.log('Main: Chat exported successfully to:', filePath);
        return { success: true, filePath: filePath };

    } catch (error) {
        console.error('Main: Failed to export chat:', error);
        return { success: false, error: error.message };
    }
});

// -- Copy Text to Clipboard Handler --
ipcMain.handle('handle-copy-to-clipboard', async (event, textToCopy: string): Promise<boolean> => {
    console.log('Main: Handling copy-text-to-clipboard request.');
    if (typeof textToCopy !== 'string') {
        console.error('Main: Invalid text received for copying.');
        return false;
    }
    try {
        clipboard.writeText(textToCopy);
        console.log('Main: Text copied to clipboard.');
        return true;
    } catch (error) {
        console.error('Main: Failed to copy text to clipboard:', error);
        return false;
    }
});


// --- Electron App Lifecycle (Unchanged) ---
app.on('ready', () => {
    createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
