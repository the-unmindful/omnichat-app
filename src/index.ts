import { app, BrowserWindow, ipcMain, clipboard, dialog } from 'electron'; // Added dialog
import path from 'path';
import fsPromises from 'fs/promises'; // Added fsPromises for async file operations
import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// --- Define Interfaces ---

interface ApiKeyEntry {
    id: string;
    provider: string;
    label: string;
}

interface StoredApiKey extends ApiKeyEntry {
    encryptedValue: string; 
}

interface EnabledModelEntry {
    modelEntryId: string; 
    userLabel: string;    
    provider: string;     
    modelId: string;      
    apiKeyId: string;     
    expectedOutputModalities?: Array<'text' | 'image'>; 
}

interface AvailableModel {
    modelEntryId: string; 
    displayLabel: string; 
}

export interface TextContentPart {
    type: 'text';
    text: string;
}
export interface ImageContentPart {
    type: 'image_url';
    image_url: {
        url: string; 
    };
}
export type UserContent = string | Array<TextContentPart | ImageContentPart>;

interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'error';
    content: UserContent; 
    assistantOutput?: AssistantOutputContent; 
    modelUsed?: string;
    id?: string;
    personaUsedId?: string | null;    
    personaUsedName?: string | null;  
}

export interface AssistantOutputContent {
    type: 'text' | 'image' | 'error' | 'loading';
    text_content?: string;
    image_url?: string;
    error_message?: string;
}

interface ChatSession {
    id: string;          
    title: string;       
    createdAt: number;   
    lastModifiedAt: number; 
    messages: ChatMessage[]; 
    activePersonaId?: string | null; 
}

interface ChatPayload {
    modelEntryId: string; 
    history: ChatMessage[]; 
}

interface Persona {
    id: string;        
    name: string;      
    prompt: string;    
}

type SchemaType = {
    apiKeys: StoredApiKey[];
    enabledModels: EnabledModelEntry[]; 
    chatSessions?: ChatSession[];   
    personas?: Persona[];           
};

interface ChatSessionMetadata {
    id: string;
    title: string;
    createdAt: number;
    lastModifiedAt: number;
    activePersonaId?: string | null;
}

const store = new Store<SchemaType>({
    defaults: {
        apiKeys: [],
        enabledModels: [], 
        chatSessions: [],  
        personas: []       
    },
});

console.log('Store path:', store.path);

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

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: http:; connect-src 'self' https: http:;"
        ]
      }
    });
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.once('ready-to-show', () => { mainWindow.show(); });
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// --- Helper Functions for Formatting History ---

function getSimpleTextFromUserContent(content: UserContent): string {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter(part => part.type === 'text')
            .map(part => (part as TextContentPart).text)
            .join('\n');
    }
    return '';
}

function formatHistoryForOpenAI(
    history: ChatMessage[], 
    currentModelEntry: EnabledModelEntry | undefined
): { role: 'system' | 'user' | 'assistant'; content: UserContent | string }[] {
    return history
        .filter(msg => ['system', 'user', 'assistant'].includes(msg.role))
        .map(msg => {
            if (msg.role === 'user') {
                if (Array.isArray(msg.content) && currentModelEntry?.expectedOutputModalities?.includes('image')) { 
                     return { role: 'user', content: msg.content }; 
                }
                return { role: 'user', content: getSimpleTextFromUserContent(msg.content) }; 
            }
            return { 
                role: msg.role as 'system' | 'assistant', 
                content: typeof msg.content === 'string' ? msg.content : getSimpleTextFromUserContent(msg.content)
            };
        });
}

function formatHistoryForAnthropic(history: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
     return history
        .filter(msg => ['user', 'assistant'].includes(msg.role))
        .map(msg => ({ 
            role: msg.role as 'user' | 'assistant', 
            content: getSimpleTextFromUserContent(msg.content) 
        }));
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string, data: string } };
interface GeminiContent {
    role: 'user' | 'model';
    parts: GeminiPart[];
}

function formatHistoryForGemini(
    history: ChatMessage[],
    currentModelEntry: EnabledModelEntry | undefined
): GeminiContent[] {
    const formatted: GeminiContent[] = [];
    const isVisionModel = currentModelEntry?.expectedOutputModalities?.includes('image');

    history.forEach(msg => {
        if (msg.role === 'system') { 
            return;
        }

        const messageParts: GeminiPart[] = [];
        if (typeof msg.content === 'string') {
            if (msg.content.trim()) {
                 messageParts.push({ text: msg.content });
            }
        } else if (Array.isArray(msg.content)) {
            msg.content.forEach(part => {
                if (part.type === 'text' && part.text.trim()) {
                    messageParts.push({ text: part.text });
                } else if (part.type === 'image_url' && isVisionModel) {
                    const dataUriParts = part.image_url.url.match(/^data:(image\/\w+);base64,(.+)$/);
                    if (dataUriParts && dataUriParts.length === 3) {
                        const mimeType = dataUriParts[1];
                        const base64Data = dataUriParts[2];
                        messageParts.push({
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        });
                    } else {
                        console.warn("Main (Gemini): Could not parse data URI for image:", part.image_url.url);
                        messageParts.push({ text: "[Error processing image data URI]" });
                    }
                } else if (part.type === 'image_url' && !isVisionModel) {
                    messageParts.push({ text: "[Image content - model not vision capable]" });
                }
            });
        }

        if (messageParts.length > 0) {
            if (msg.role === 'user') {
                formatted.push({ role: 'user', parts: messageParts });
            } else if (msg.role === 'assistant') { 
                formatted.push({ role: 'model', parts: messageParts });
            }
        }
    });
    return formatted;
}

// --- IPC Handlers ---
ipcMain.handle('save-api-key', async (event, apiKeyData: { provider: string; label: string; value: string }): Promise<boolean> => {
    console.log('Main: Handling save-api-key for', apiKeyData.label); try { const currentKeys: StoredApiKey[] = store.get('apiKeys'); const newKey: StoredApiKey = { id: uuidv4(), provider: apiKeyData.provider, label: apiKeyData.label, encryptedValue: Buffer.from(apiKeyData.value).toString('base64'), }; currentKeys.push(newKey); store.set('apiKeys', currentKeys); console.log(`Main: Key "${newKey.label}" saved.`); return true; } catch (error) { console.error('Main: Failed to save API key:', error); return false; }
});
ipcMain.handle('get-api-keys', async (event): Promise<ApiKeyEntry[]> => {
    console.log('Main: Handling get-api-keys request'); try { const storedKeys: StoredApiKey[] = store.get('apiKeys'); const safeKeys: ApiKeyEntry[] = storedKeys.map((key: StoredApiKey) => ({ id: key.id, provider: key.provider, label: key.label || '(No Label)', })); return safeKeys; } catch (error) { console.error('Main: Failed to get API keys:', error); return []; }
});
ipcMain.handle('delete-api-key', async (event, keyId: string): Promise<boolean> => {
    console.log(`Main: Handling delete-api-key for ID: ${keyId}`); try { let currentKeys: StoredApiKey[] = store.get('apiKeys'); currentKeys = currentKeys.filter((key: StoredApiKey) => key.id !== keyId); store.set('apiKeys', currentKeys); console.log(`Main: Key with ID ${keyId} deleted.`); return true; } catch (error) { console.error('Main: Failed to delete API key:', error); return false; }
});
ipcMain.handle('copy-api-key', async (event, keyId: string): Promise<boolean> => {
    console.log(`Main: Handling copy-api-key for ID: ${keyId}`); try { const storedKeys: StoredApiKey[] = store.get('apiKeys'); const keyToCopy = storedKeys.find((key: StoredApiKey) => key.id === keyId); if (keyToCopy?.encryptedValue) { const decodedValue = Buffer.from(keyToCopy.encryptedValue, 'base64').toString('utf8'); clipboard.writeText(decodedValue); console.log(`Main: Key ${keyToCopy.label} copied.`); return true; } console.warn(`Main: Key with ID ${keyId} not found or value missing for copying.`); return false; } catch (error) { console.error('Main: Failed to copy API key:', error); return false; }
});
ipcMain.handle('add-enabled-model', async (event, modelData: Omit<EnabledModelEntry, 'modelEntryId'>): Promise<boolean> => {
    console.log('Main: === Handling add-enabled-model ==='); 
    console.log('Main: Received model data:', JSON.stringify(modelData)); 
    try {
        const currentApiKeys = store.get('apiKeys');
        const linkedKeyExists = currentApiKeys.some(key => key.id === modelData.apiKeyId);
        if (!linkedKeyExists) {
            throw new Error(`The selected API key does not exist.`);
        }
        const newModelEntry: EnabledModelEntry = { ...modelData, modelEntryId: uuidv4() };
        const currentModels = store.get('enabledModels', []); 
        currentModels.push(newModelEntry);
        store.set('enabledModels', currentModels);
        console.log(`Main: Add operation successful for "${newModelEntry.userLabel}"`);
        return true; 
    } catch (error) {
        console.error('Main: === Error during add-enabled-model ===:', error);
        throw error instanceof Error ? error : new Error('Failed to save the enabled model in main process.');
    }
});
ipcMain.handle('get-enabled-models', async (event): Promise<EnabledModelEntry[]> => {
    try { return store.get('enabledModels'); } catch (error) { console.error('Main: Failed to get enabled models:', error); return []; }
});
ipcMain.handle('delete-enabled-model', async (event, modelEntryId: string): Promise<boolean> => {
    try {
        let currentModels = store.get('enabledModels');
        currentModels = currentModels.filter(model => model.modelEntryId !== modelEntryId);
        store.set('enabledModels', currentModels);
        console.log(`Main: Enabled model with ID ${modelEntryId} deleted.`);
        return true;
    } catch (error) { console.error('Main: Failed to delete enabled model:', error); return false; }
});
ipcMain.handle('get-models-for-chat-dropdown', async (event): Promise<EnabledModelEntry[]> => {
    try {
        const enabledModels: EnabledModelEntry[] = store.get('enabledModels', []);
        // Sort by userLabel, then by modelId as a fallback for consistent ordering
        enabledModels.sort((a, b) => {
            const labelA = a.userLabel || a.modelId;
            const labelB = b.userLabel || b.modelId;
            return labelA.localeCompare(labelB);
        });
        return enabledModels;
    } catch (error) { 
        console.error('Main: Failed to get models for chat dropdown:', error); 
        return []; 
    }
});

ipcMain.handle('send-chat-message', async (event, payload: ChatPayload): Promise<AssistantOutputContent> => {
     console.log(`\n--- New Chat Request ---`);
     console.log(`Main: Received request using Enabled Model Entry ID [${payload.modelEntryId}]`);

     const enabledModels = store.get('enabledModels');
     const currentModelEntry = enabledModels.find(m => m.modelEntryId === payload.modelEntryId); 

     if (!currentModelEntry) {
         console.error(`Main: Enabled Model Entry NOT FOUND for ID: ${payload.modelEntryId}`);
         return { type: 'error', error_message: `Configuration for selected model not found. Please check settings.` };
     }
     console.log(`Main: Found Enabled Model: Label [${currentModelEntry.userLabel}], Provider [${currentModelEntry.provider}], ModelID [${currentModelEntry.modelId}], KeyID [${currentModelEntry.apiKeyId}], ExpectedModalities: [${currentModelEntry.expectedOutputModalities?.join(', ')}]`);

    const storedKeys = store.get('apiKeys');
    const apiKeyData = storedKeys.find(key => key.id === currentModelEntry.apiKeyId);

    if (!apiKeyData) {
        console.error(`Main: API Key NOT FOUND for ID: ${currentModelEntry.apiKeyId} (linked to model ${currentModelEntry.userLabel})`);
        return { type: 'error', error_message: `API Key linked to the selected model configuration was not found. Please check settings.` };
    }
    console.log(`Main: Found Linked Key Label: [${apiKeyData.label}]`);

    const apiKey = Buffer.from(apiKeyData.encryptedValue, 'base64').toString('utf8');
    const provider = currentModelEntry.provider;
    const modelId = currentModelEntry.modelId;
    const history = payload.history;

    const lastUserMessage = history.length > 0 ? history[history.length - 1] : null;
    if (lastUserMessage && lastUserMessage.role === 'user') {
        let userTextPrompt = '';
        if (typeof lastUserMessage.content === 'string') {
            userTextPrompt = lastUserMessage.content.toLowerCase();
        } else if (Array.isArray(lastUserMessage.content)) {
            const textPart = lastUserMessage.content.find(part => part.type === 'text') as TextContentPart | undefined;
            if (textPart) {
                userTextPrompt = textPart.text.toLowerCase();
            }
        }
        
        const isVisionModel = currentModelEntry.expectedOutputModalities && currentModelEntry.expectedOutputModalities.includes('image');
        if (!isVisionModel && (userTextPrompt.includes('image') || userTextPrompt.includes('draw'))) {
            console.log("Main: Image request detected for non-vision model. Simulating image response.");
            return {
                type: 'image',
                image_url: `https://picsum.photos/500/300?random=${Date.now()}`,
                text_content: `(Simulated Image) You asked for an image related to: "${userTextPrompt.substring(0, 50)}..."`
            };
        }
    }

    console.log(`Main: Preparing API call | Provider: ${provider} | Model ID: ${modelId}`);
    if (lastUserMessage) { 
        const contentForLog = typeof lastUserMessage.content === 'string' 
            ? lastUserMessage.content 
            : JSON.stringify(lastUserMessage.content); 
        console.log(`Main: Content for LLM (last user message): \n---\n${contentForLog}\n---`);
    }

    const temperature = 0.7;
    const maxTokens = provider === 'Gemini' ? 8192 : 2048; 

    try {
        let responseContent = '';
        switch (provider) {
            case 'OpenAI':
            case 'OpenRouter': { 
                const url = provider === 'OpenAI' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
                const headers: Record<string, string> = { 
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json' 
                };
                if (provider === 'OpenRouter') {
                    headers['HTTP-Referer'] = 'http://localhost'; 
                    headers['X-Title'] = 'OmniChat';
                }
                
                const messagesForApi = formatHistoryForOpenAI(history, currentModelEntry) 
                    .map(msg => { 
                        if (msg.role === 'user' && Array.isArray(msg.content) && currentModelEntry?.provider === 'OpenRouter' && currentModelEntry?.modelId.includes('qwen')) {
                            const textPart = msg.content.find(p => p.type === 'text') as TextContentPart | undefined;
                            const imagePart = msg.content.find(p => p.type === 'image_url') as ImageContentPart | undefined;
                            if (textPart && imagePart) {
                                return { role: 'user', content: [textPart, imagePart] };
                            } else if (imagePart && !textPart) {
                                return { role: 'user', content: [{type: 'text', text: 'Describe this image.'}, imagePart ] };
                            }
                        }
                        return msg; 
                    });

                const data = { model: modelId, messages: messagesForApi, temperature: temperature, max_tokens: maxTokens };
                console.log(`Main: Calling ${provider} (${modelId}). Payload:`, JSON.stringify(data, null, 2));
                
                const response = await axios.post(url, data, { headers });
                
                const choice = response.data.choices?.[0];
                if (choice && choice.message) {
                    if (typeof choice.message.content === 'string') {
                        responseContent = choice.message.content.trim();
                    } else if (provider === 'OpenRouter' && typeof choice.message.text === 'string') {
                        responseContent = choice.message.text.trim();
                    } else {
                         responseContent = JSON.stringify(choice.message.content); 
                    }
                }
                if (!responseContent && responseContent !== "") { 
                    throw new Error(`Received an unexpected response format from ${provider}.`);
                }
                break;
            }
            case 'Anthropic': { 
                const url = 'https://api.anthropic.com/v1/messages'; 
                const headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }; 
                const messagesForApi = formatHistoryForAnthropic(history); 
                const requestData: any = { model: modelId, messages: messagesForApi, max_tokens: maxTokens, temperature: temperature }; 
                const systemPromptMessage = history.find(msg => msg.role === 'system');
                if (systemPromptMessage && typeof systemPromptMessage.content === 'string') {
                    requestData.system = systemPromptMessage.content;
                }
                console.log(`Main: Calling Anthropic (${modelId}). Payload:`, JSON.stringify(requestData, null, 2)); 
                const response = await axios.post(url, requestData, { headers }); 
                responseContent = response.data.content?.[0]?.text?.trim(); 
                if (responseContent === undefined || responseContent === null) { 
                    throw new Error("Received an unexpected response format from Anthropic."); 
                }
                break;
             }
             case 'Gemini': { 
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`; 
                const headers = { 'Content-Type': 'application/json' }; 
                const contentsForApi = formatHistoryForGemini(history, currentModelEntry); 
                const requestData: any = { contents: contentsForApi, generationConfig: { temperature: temperature, maxOutputTokens: maxTokens } };
                
                const systemInstructionMessage = history.find(msg => msg.role === 'system');
                if (systemInstructionMessage && typeof systemInstructionMessage.content === 'string') {
                    if (systemInstructionMessage.content.trim()) {
                        requestData.system_instruction = { parts: [{ text: systemInstructionMessage.content }] };
                    }
                }
                console.log(`Main: Calling Gemini (${modelId}). Payload:`, JSON.stringify(requestData, null, 2)); 
                const response = await axios.post(url, requestData, { headers }); 
                if (response.data.promptFeedback?.blockReason) { 
                    throw new Error(`Request blocked by Gemini: ${response.data.promptFeedback.blockReason}`); 
                } 
                if (!response.data.candidates || response.data.candidates.length === 0) {
                    throw new Error("No candidates returned from Gemini.");
                }
                if (response.data.candidates[0]?.finishReason === 'SAFETY') { 
                    throw new Error("Response blocked by Gemini for safety reasons."); 
                } 
                responseContent = response.data.candidates[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
                responseContent = responseContent.trim();

                if (responseContent === undefined || responseContent === null) { 
                    throw new Error("Received an unexpected response format from Gemini."); 
                }
                break;
             }
            default:
                throw new Error(`API provider "${provider}" configured for this model is not supported.`);
        }
        console.log(`Main: Received response from ${provider}. Length: ${responseContent.length}`);
        return { type: 'text', text_content: responseContent };

    } catch (error) {
         console.error(`Main: Error during API call to ${provider} (${modelId}):`, error.response?.data || error.message || error); 
         let apiErrorMessage = 'API call failed.'; 
         if (axios.isAxiosError(error)) { 
             const errorData = error.response?.data; 
             if (errorData?.error?.message) apiErrorMessage = `API Error: ${errorData.error.message}`; 
             else if (errorData?.type === 'error' && errorData?.error?.message) apiErrorMessage = `API Error: ${errorData.error.message}`; 
             else if (error.message) apiErrorMessage = error.message; 
         } else if (error instanceof Error) { 
             apiErrorMessage = error.message; 
         } 
         return { type: 'error', error_message: apiErrorMessage };
    } finally {
        console.log(`--- Chat Request End ---`);
    }
});

ipcMain.handle('create-new-chat-session', async (): Promise<Partial<ChatSession> | null> => {
    try {
        const sessions = store.get('chatSessions', []);
        const newSession: ChatSession = {
            id: uuidv4(), title: `New Chat ${new Date().toLocaleString()}`, createdAt: Date.now(),
            lastModifiedAt: Date.now(), messages: [], activePersonaId: null,
        };
        sessions.push(newSession); store.set('chatSessions', sessions);
        return { id: newSession.id, title: newSession.title, createdAt: newSession.createdAt, lastModifiedAt: newSession.lastModifiedAt };
    } catch (error) { console.error('Main: Failed to create new chat session:', error); throw error; }
});
ipcMain.handle('load-chat-sessions-metadata', async (): Promise<Partial<ChatSession>[]> => {
    try {
        const sessions = store.get('chatSessions', []);
        return sessions.map(s => ({ id: s.id, title: s.title, createdAt: s.createdAt, lastModifiedAt: s.lastModifiedAt, activePersonaId: s.activePersonaId }))
                       .sort((a, b) => b.lastModifiedAt - a.lastModifiedAt);
    } catch (error) { console.error('Main: Failed to load chat sessions metadata:', error); return []; }
});
ipcMain.handle('load-chat-session-messages', async (event, sessionId: string): Promise<ChatMessage[]> => {
    try {
        const session = store.get('chatSessions', []).find(s => s.id === sessionId);
        return session ? session.messages : [];
    } catch (error) { console.error('Main: Failed to load messages for session ID:', sessionId, error); return []; }
});
ipcMain.handle('add-message-to-chat-session', async (event, sessionId: string, message: ChatMessage): Promise<boolean> => {
    try {
        const sessions = store.get('chatSessions', []);
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex > -1) {
            sessions[sessionIndex].messages.push(message);
            sessions[sessionIndex].lastModifiedAt = Date.now();
            if (sessions[sessionIndex].messages.length === 1 && message.role === 'user') {
                const textContent = getSimpleTextFromUserContent(message.content); 
                if (textContent && sessions[sessionIndex].title.startsWith('New Chat')) {
                    sessions[sessionIndex].title = textContent.substring(0, 30) + (textContent.length > 30 ? '...' : '');
                }
            }
            store.set('chatSessions', sessions);
            return true;
        }
        return false;
    } catch (error) { console.error('Main: Failed to add message to session ID:', sessionId, error); return false; }
});
ipcMain.handle('delete-chat-session', async (event, sessionId: string): Promise<boolean> => {
    try {
        let sessions = store.get('chatSessions', []);
        sessions = sessions.filter(s => s.id !== sessionId);
        store.set('chatSessions', sessions);
        return true;
    } catch (error) { console.error('Main: Failed to delete session ID:', sessionId, error); return false; }
});
ipcMain.handle('update-chat-session-title', async (event, sessionId: string, newTitle: string): Promise<boolean> => {
    try {
        const sessions = store.get('chatSessions', []);
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex > -1) {
            sessions[sessionIndex].title = newTitle;
            sessions[sessionIndex].lastModifiedAt = Date.now();
            store.set('chatSessions', sessions);
            return true;
        }
        return false;
    } catch (error) { console.error('Main: Failed to update title for session ID:', sessionId, error); return false; }
});
ipcMain.handle('handle-export-chat', async (event, markdownContent: string, suggestedFilename: string): Promise<{ success: boolean, filePath?: string, error?: string }> => {
    if (!BrowserWindow.getFocusedWindow()) return { success: false, error: 'No active window.' };
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
            title: 'Export Chat As Markdown', defaultPath: suggestedFilename,
            filters: [{ name: 'Markdown Files', extensions: ['md'] }, { name: 'All Files', extensions: ['*'] }]
        });
        if (canceled || !filePath) return { success: false };
        await fsPromises.writeFile(filePath, markdownContent, 'utf8');
        return { success: true, filePath: filePath };
    } catch (error) { return { success: false, error: error.message }; }
});
ipcMain.handle('handle-copy-to-clipboard', async (event, textToCopy: string): Promise<boolean> => {
    if (typeof textToCopy !== 'string') return false;
    try { clipboard.writeText(textToCopy); return true; } catch (error) { return false; }
});
ipcMain.handle('handle-get-personas', async (): Promise<Persona[]> => {
    try { return store.get('personas', []); } catch (error) { return []; }
});
ipcMain.handle('handle-save-persona', async (event, personaData: { id?: string; name: string; prompt: string }): Promise<Persona | null> => {
    try {
        const personas = store.get('personas', []);
        if (personaData.id) {
            const index = personas.findIndex(p => p.id === personaData.id);
            if (index > -1) { personas[index] = { ...personas[index], ...personaData }; store.set('personas', personas); return personas[index]; }
            return null; 
        } else {
            const newPersona: Persona = { id: uuidv4(), name: personaData.name, prompt: personaData.prompt };
            personas.push(newPersona); store.set('personas', personas); return newPersona;
        }
    } catch (error) { throw error; }
});
ipcMain.handle('handle-delete-persona', async (event, personaId: string): Promise<boolean> => {
    try {
        let personas = store.get('personas', []);
        const initialLength = personas.length;
        personas = personas.filter(p => p.id !== personaId);
        if (personas.length < initialLength) { store.set('personas', personas); return true; }
        return false;
    } catch (error) { return false; }
});
ipcMain.handle('handle-set-chat-session-persona', async (event, sessionId: string, personaId: string | null): Promise<boolean> => {
    try {
        const sessions = store.get('chatSessions', []);
        const sessionIndex = sessions.findIndex(s => s.id === sessionId);
        if (sessionIndex > -1) {
            sessions[sessionIndex].activePersonaId = personaId;
            sessions[sessionIndex].lastModifiedAt = Date.now();
            store.set('chatSessions', sessions); return true;
        } return false;
    } catch (error) { return false; }
});
ipcMain.handle('search-chats', async (event, searchTerm: string): Promise<ChatSessionMetadata[]> => {
    if (typeof searchTerm !== 'string' || searchTerm.trim() === '') return [];
    const lowerSearchTerm = searchTerm.toLowerCase();
    try {
        const sessions: ChatSession[] = store.get('chatSessions', []);
        const results = sessions.filter(session => {
            if (session.title && session.title.toLowerCase().includes(lowerSearchTerm)) return true;
            if (session.messages) {
                return session.messages.some(message => {
                    const textContent = getSimpleTextFromUserContent(message.content); 
                    return textContent && textContent.toLowerCase().includes(lowerSearchTerm);
                });
            }
            return false;
        }).map(s => ({ id: s.id, title: s.title, createdAt: s.createdAt, lastModifiedAt: s.lastModifiedAt, activePersonaId: s.activePersonaId }))
          .sort((a,b) => b.lastModifiedAt - a.lastModifiedAt);
        return results;
    } catch (error) { return []; }
});
ipcMain.handle('handle-select-file', async (event): Promise<{ originalPath: string; name: string; type: string; size: number } | null> => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (!focusedWindow) return null;
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(focusedWindow, {
            title: 'Select File to Attach', properties: ['openFile'],
            filters: [
                { name: 'Text & Image Files', extensions: ['txt', 'html', 'htm', 'md', 'png', 'jpg', 'jpeg', 'webp', 'gif'] },
                { name: 'Text Files', extensions: ['txt', 'html', 'htm', 'md'] },
                { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (canceled || !filePaths || filePaths.length === 0) return null;
        const filePath = filePaths[0];
        const stats = await fsPromises.stat(filePath);
        return { originalPath: filePath, name: path.basename(filePath), type: path.extname(filePath).toLowerCase(), size: stats.size };
    } catch (error) { return null; }
});
ipcMain.handle('handle-extract-text-from-file', async (event, originalPath: string, fileType: string): Promise<{ extractedText?: string; base64ImageData?: string; imageMimeType?: string; error?: string }> => {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    try {
        if (imageExtensions.includes(fileType.toLowerCase())) {
            const imageBuffer = await fsPromises.readFile(originalPath);
            const base64ImageData = imageBuffer.toString('base64');
            let imageMimeType = '';
            switch (fileType.toLowerCase()) {
                case '.png': imageMimeType = 'image/png'; break;
                case '.jpg': case '.jpeg': imageMimeType = 'image/jpeg'; break;
                case '.webp': imageMimeType = 'image/webp'; break;
                case '.gif': imageMimeType = 'image/gif'; break;
                default: return { error: `Unknown image type: ${fileType}` };
            }
            return { base64ImageData, imageMimeType };
        } else if (['.txt', '.html', '.htm', '.md'].includes(fileType.toLowerCase())) {
            const textContent = await fsPromises.readFile(originalPath, 'utf8');
            return { extractedText: textContent };
        } else {
            return { error: `Unsupported file type: ${fileType}` };
        }
    } catch (error) { return { error: `Failed to read or process file: ${error.message}` }; }
});

// --- Electron App Lifecycle ---
app.on('ready', () => { createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
