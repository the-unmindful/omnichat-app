# OmniChat: Multi-LLM Chat Client - Project Documentation

**Version:** 1.6 (Model Parameter Configuration & V1.5 Image Simulation)
**Date:** 2025-05-12 (Updated for Model Parameter integration)

## 1. Vision

To create a beautiful, intuitive, and powerful desktop chat client that allows seamless interaction with various Large Language Models (LLMs) from multiple providers (e.g., OpenAI, OpenRouter, Gemini, Anthropic). The application will centralize API key management, enable effortless switching between models within a single chat conversation while maintaining context, and provide robust organizational tools for managing chat history, prompts, and personas. It is designed primarily for personal use on trusted devices, prioritizing user experience, elegance, and extensibility.

## 2. Guiding Principles

*   **User-Centricity:** Design with the user's workflow in mind. Prioritize ease of use, intuitive navigation, and minimal friction for common tasks like chatting, switching models, copying content, and exporting chats.
*   **Modularity & Extensibility:** Build with an architecture that makes it easy to add support for new LLM providers, models, and features over time without major refactoring.
*   **Aesthetics & Design:** Implement a clean, elegant, minimalistic "Paper Modern" design. Focus on clarity, readability, whitespace, and subtle visual cues. (Theme support is a future goal).
*   **Robustness & Reliability:** Ensure stable performance, reliable handling of conversation context across different models, graceful error handling, and secure (within local constraints) storage of sensitive data like API keys.
*   **Personal Use Focus:** Tailor features for the needs of an individual power user, initially leveraging local file-based storage (`electron-store`) for simplicity and privacy on trusted machines.

## 3. Core Features (Current Status)

These features represent the current functionality of the application.

*   **Chat Interface:**
    *   [Implemented] Main conversation view displaying user prompts and LLM responses distinctly.
    *   [Implemented] Markdown rendering for responses (code blocks, bold, italics, lists, tables, etc.) using the `marked` library.
    *   [Implemented] Multi-line text input area.
    *   [Implemented] Send message functionality.
    *   [Implemented] Loading indicators ("...") and error display for API calls.
    *   [Implemented] Display of the model label used for each assistant response, positioned below the message bubble.
*   **API Key Management:**
    *   [Implemented] Local storage for API keys from various providers using `electron-store` (keys are base64 encoded).
    *   [Implemented] Settings UI to add, view (masked), label, and delete API keys.
    *   [Implemented] "Copy Key Value" functionality.
    *   [Implemented] Support for OpenAI, OpenRouter, Gemini, and Anthropic providers.
*   **Enabled Model Configuration:**
    *   [Implemented] UI in Settings to define "Enabled Models" by giving them a user label, specifying the provider, the exact model ID, and linking them to a saved API key.
    *   [Implemented] These enabled models populate the in-chat model selector.
*   **Multi-LLM Integration:**
    *   [Implemented] In-chat dropdown menu (`model-selector`) to select the desired "Enabled Model" configuration for the *next* message.
    *   [Implemented] Dynamic listing of available model configurations in the dropdown.
*   **Context Continuity:**
    *   [Implemented] Maintains and transmits the current conversation history (formatted appropriately for the selected provider) to the LLM when sending a message.
*   **Chat Session Management (Multi-Session Support):**
    *   [Implemented] Sidebar (`ul#chat-list`) listing all chat sessions, sorted by last modification time.
    *   [Implemented] Automatic chat naming (e.g., "New Chat [timestamp]" initially, then updated to the first user prompt snippet).
    *   [Implemented] Manual renaming of chat sessions via double-click on the session in the sidebar.
    *   [Implemented] Timestamps (`createdAt`, `lastModifiedAt`) stored for each session.
    *   [Implemented] Chat deletion functionality (with confirmation) for each session via a delete icon in the sidebar.
    *   [Implemented] Local persistence of all chat sessions and their messages using `electron-store`.
    *   [Implemented] "New Chat" button to create new sessions.
    *   [Implemented] Automatic selection of the most recent chat session on startup.
*   **File Attachments (Text-Based):**
    *   [Implemented] Ability to attach files (TXT, HTML, MD) to provide context for the LLM.
    *   [Implemented] UI includes an attach button, display for the selected file's name and size, and a button to clear the current attachment.
    *   [Implemented] File content is extracted and prepended to the user's typed message for the *first* message sent with that attachment, forming the context for the LLM. Subsequent messages in the same session (while the attachment remains active) do not re-prepend the file content.
    *   [Implemented] The chat UI displays only the user's typed message or a placeholder if only an attachment is sent.
    *   [Implemented] Attachments are automatically cleared when switching to a different chat session or starting a new one.
*   **Persona Management:**
    *   [Implemented] Settings UI to add, view, edit, and delete Personas (custom system prompts).
    *   [Implemented] Chat header dropdown to select an active Persona for the current chat session.
    *   [Implemented] Persistence of the active Persona choice per chat session.
    *   [Implemented] Correct application of Persona system prompts to OpenAI, OpenRouter, Anthropic, and Gemini APIs, adhering to provider-specific requirements.
*   **UI/UX and Stability Enhancements:**
    *   [Implemented] Non-blocking "Toast" notifications for user feedback (e.g., save success/failure, errors), replacing disruptive system `alert()` dialogs.
    *   [Implemented] Non-blocking inline "Tick/Cross" (✔️/❌) confirmations for all delete operations (API Keys, Enabled Models, Personas, Chat Sessions), replacing disruptive system `confirm()` dialogs.
    *   [Implemented] Resolved major UI hanging/freezing issues previously caused by synchronous dialogs, leading to a smoother user experience.
*   **Basic Utilities:**
    *   [Implemented] Copy button (📋 icon) on each assistant message to copy the preceding user question and the assistant's response (with model label) to the clipboard in Markdown format.
    *   [Implemented] "Export Chat" button in the chat header to save the entire active chat session as a Markdown (.md) file, including roles, model labels, and active Persona system prompt if used.
*   **Chat Search & Filtering:**
    *   [Implemented] Keyword search input in the sidebar to filter chat sessions.
    *   [Implemented] Searches across chat titles and the full content of messages within each chat.
    *   [Implemented] Search is performed locally in the main process for privacy and speed.
    *   [Implemented] Searched chat list persists in the sidebar when a chat is selected from the filtered results. The filter only clears if the search input is manually emptied or a new chat is created.
*   **Image Output Simulation (V1.5):**
    *   [Implemented] Architectural adjustments for multi-modal output (structured `AssistantOutputContent` interface).
    *   [Implemented] IPC channels (`sendChatMessage`) updated to handle structured output.
    *   [Implemented] `ChatMessageComponent.ts` extended to display images from URLs, including loading and error states.
    *   [Implemented] Main process (`src/index.ts`) simulates image responses (using Picsum Photos) if a prompt includes "draw" or "image".
    *   [Implemented] Renderer process (`src/renderer.ts`) correctly processes image responses and passes data to the component.
    *   [Implemented] Content Security Policy (CSP) updated programmatically in `src/index.ts` to allow image loading from external sources.
    *   [Implemented] Copy button on assistant messages is now hidden for image outputs.
*   **Model Parameter Configuration (V1.6):**
    *   [Implemented] UI popover in the chat header (near model selector) to configure Temperature, Top P, and Max Tokens.
    *   [Implemented] Global persistence of these parameters in `currentModelParams` within `src/renderer.ts`.
    *   [Implemented] Parameters are updated live as the user types in the popover input fields.
    *   [Implemented] Input fields are populated with current global values when the popover is opened and when the selected model changes.
    *   [Implemented] Parameters are included in the `ChatPayload` sent to the main process.
    *   [Implemented] Main process (`src/index.ts`) correctly receives and applies these parameters (with provider-specific naming and defaults) to API calls for OpenAI, OpenRouter, Anthropic, and Gemini.

## 4. Advanced Features & Roadmap

*   **Currently Under Development / Next Up (V1.6 Focus):**
    *   **Thorough Testing of Model Configuration & API Key Integration:**
        *   Verify end-to-end functionality of adding API keys for various providers (OpenAI, OpenRouter, Gemini, Anthropic).
        *   Test configuration of "Enabled Models," linking them to specific API keys and ensuring correct model IDs are used.
        *   Confirm the in-chat `model-selector` populates correctly and allows selection of these user-defined configurations.
    *   **Testing Live LLM Calls:**
        *   With valid API keys and model configurations, test actual text generation calls to OpenAI, OpenRouter, Gemini, and Anthropic via the chat interface.
        *   Ensure conversation history is correctly formatted and sent to each provider.
        *   Verify responses are received and displayed.
    *   **Refine Error Handling for LLM Calls:**
        *   Improve user feedback for API errors (e.g., invalid key, quota exceeded, model not available).
    *   **(Lower Priority for V1.6, but related to V1.5):** Consider if the Picsum image simulation needs to provide persistent images for the same prompt (e.g., using seeded URLs) or if the current random image per request is sufficient for simulation.
    *   **(Completed in V1.6):** Model Parameter Configuration (Temperature, Top P, Max Tokens).

### Future Implementation Focus (Post V1.6): Enhanced Chat Organization

This section outlines a plan for the next set of major features to improve chat management.

*   **1. Chat Filtering:** [Partially Implemented - Basic keyword search for titles and content is complete]
    *   **Goal:** Allow users to quickly find specific chat sessions based on various criteria.
    *   **Current:** Basic keyword search for titles and message content implemented. Search results persist on chat selection.
    *   **Future Enhancements (UI Elements - Sidebar, above chat list):**
        *   (Optional) Dropdown to select filter scope: Title only, Title + Message Content (currently searches both).
        *   (Optional) Dropdown to filter by "Model Used" (based on `modelUsed` in `ChatMessage` or a session-level summary).
        *   (Optional) Dropdown to filter by "Persona Used" (based on `activePersonaId` in `ChatSessionMetadata`).
    *   **Logic (`renderer.ts`, `chat-search-ui.ts`, `index.ts`):**
        *   Event listeners on the search input and filter dropdowns.
        *   A core filtering function that takes the current `allSessionsMetadata` and applies active filters:
            *   Keyword search: Matches against `session.title`. If content search is enabled, this becomes more complex and might require loading messages for visible sessions or an IPC call for backend search.
            *   Model filter: Requires determining which model(s) were used in a session. This might involve checking `modelUsed` on the last few messages or storing a primary model on `ChatSessionMetadata`.
            *   Persona filter: Directly filter on `session.activePersonaId`.
        *   `renderChatList()` will be called with the filtered list of sessions.
    *   **Backend/IPC (`index.ts`):**
        *   For basic filtering on metadata (title, persona), no backend changes are immediately needed.
        *   If deep content search across all messages of all sessions is required without loading everything into the renderer, a new IPC handler like `search-sessions-content` would be needed to perform the search within `electron-store` data.

*   **2. Chat Folders:**
    *   **Goal:** Allow users to organize chat sessions into custom folders.
    *   **Data Model Changes (`index.ts` - `SchemaType` and interfaces):**
        *   Introduce a new top-level array in the `electron-store` schema: `chatFolders: ChatFolder[]`.
        *   Define `interface ChatFolder { id: string; name: string; createdAt: number; chatSessionIds: string[]; }`.
        *   Modify `ChatSession` (and consequently `ChatSessionMetadata` if needed) to include an optional `folderId: string | null` to link a session to a folder.
    *   **UI Elements & Interaction (`renderer.ts`, `index.html` - Sidebar):**
        *   Display folders in the sidebar (e.g., as a separate list above chats, or an integrated tree view).
        *   Button/mechanism to "Create New Folder".
        *   For each folder:
            *   Display folder name.
            *   Allow renaming (e.g., double-click or context menu).
            *   Allow deleting (with confirmation, potentially moving chats to "uncategorized" or deleting them too, based on user choice).
            *   Expand/collapse functionality to show/hide chats within that folder.
        *   Mechanism to move chats into folders:
            *   Option 1 (Simpler): A "Move to Folder..." option in a context menu for each chat session, showing a sub-menu of available folders.
            *   Option 2 (More Complex): Drag-and-drop chat sessions onto folders.
    *   **Logic (`renderer.ts`):**
        *   Functions for CRUD operations on folders (will trigger IPC calls).
        *   Update `renderChatList` to:
            *   First render folders.
            *   Then render chats, grouped under their respective folders (or in a default "Uncategorized" area if `folderId` is null).
        *   Logic to handle assigning/unassigning `folderId` to chat sessions and updating the `chatSessionIds` array in the `ChatFolder` objects.
    *   **IPC Handlers (`index.ts`):**
        *   `create-chat-folder(name: string): Promise<ChatFolder | null>`
        *   `rename-chat-folder(folderId: string, newName: string): Promise<boolean>`
        *   `delete-chat-folder(folderId: string, deleteContainedChats: boolean): Promise<boolean>`
        *   `assign-chat-to-folder(sessionId: string, folderId: string | null): Promise<boolean>`
        *   These handlers will update the `chatFolders` array and `folderId` on `chatSessions` in `electron-store`.

*   **Post-MVP Roadmap (Future Considerations):**
    *   **Saved Prompts ("Snippets"):** UI to create, save, edit, delete, and easily insert reusable prompt templates.
    *   **Chat Organization (Further):** Star/Favorite chats.
    *   **Enhanced Export:** Export chat as PDF.
    *   **UI/UX Refinements:** Theme support (Light/Dark), improved syntax highlighting for code blocks in rendered Markdown, smoother animations.
    *   **Advanced File Attachments:** Support for image files (with vision models) and PDFs (with text extraction/RAG). (Basic text file attachment is now implemented).

## 5. Technical Architecture Overview (Current)

*   **Platform:** Desktop Application (Windows, macOS, Linux via Electron).
*   **Framework:** Electron (using Node.js, HTML, CSS, TypeScript).
*   **UI (Renderer Process):**
    *   The main application UI is built with vanilla TypeScript, HTML, and CSS. No major frontend framework (like React, Vue, Svelte) is currently used.
    *   The settings panel UI has been refactored into several distinct modules for better organization and maintainability (see "Modular UI Components" below).
    *   `src/renderer.ts`: Serves as the main script for the renderer process. It initializes the primary chat interface, manages chat session logic, handles core application event listeners, and orchestrates the various UI modules.
*   **Modular UI Components (Renderer Process):**
    *   `src/toast-notifications.ts`: Manages the display of non-blocking toast notifications for user feedback.
    *   `src/ui-elements.ts`: Provides centralized definitions and selectors for common HTML UI elements used across different modules.
    *   `src/settings-modal-manager.ts`: Handles the opening/closing logic for the main settings modal and coordinates data loading for its different panes.
    *   `src/settings-api-keys-ui.ts`: Manages all UI aspects and logic related to API key configuration (adding, listing, deleting, copying).
    *   `src/settings-enabled-models-ui.ts`: Manages the UI and logic for configuring "Enabled Models" that link specific model IDs to API keys.
    *   `src/settings-personas-ui.ts`: Manages the UI and logic for creating, editing, and deleting user-defined Personas (custom system prompts).
    *   `src/attachment-handler.ts`: Manages UI interactions and state for file attachments in the chat input area.
*   **State Management:**
    *   Global application state (e.g., active chat session, cached API keys, list of personas) is primarily managed using exported module-level variables within `src/renderer.ts`.
    *   The new settings UI modules import and interact with this shared state as needed. Future refactoring may introduce a more dedicated state management solution.
*   **API Integration:** Direct `axios` calls to LLM provider APIs, with provider-specific formatting logic in `src/index.ts`.
*   **Local Storage:** `electron-store` (version 8.1.0) is used for all persistent data, storing it in a JSON file. This includes:
    *   API Keys (values are base64 encoded, not fully encrypted).
    *   Enabled Model configurations.
    *   Chat Sessions (including all messages and metadata).
    *   Global model parameters (`currentModelParams` in renderer, these influence API calls but are not directly stored in `electron-store` themselves; they are part of the renderer's runtime state).
*   **Build System:** Electron Forge with the Webpack plugin.

## 6. Design Philosophy

*   **Style:** "Paper Modern" - Clean, minimalistic, content-focused.
*   **Layout:** Multi-column (Sidebar for chat session navigation, Main content for chat interaction and settings).
*   **Visuals:** Generous whitespace, clear typography, limited color palette, subtle shadows/depth, iconography.
*   **Interaction:** Intuitive, responsive, clear feedback for user actions.

## 7. Cross-Platform & Sync Strategy

*   Currently **Phase 1: Desktop Application (Local Storage)**. The application is focused on local functionality using `electron-store`. Cloud sync and mobile applications are potential future phases but not in the current scope.

## 8. Current Implementation Notes & Workarounds

*   **Asset Relocator Patch Bypass**: The `apply` method in `node_modules/@electron-forge/plugin-webpack/dist/util/AssetRelocatorPatch.js` has been modified to `return;` immediately. This bypasses a patch that can cause issues with asset paths in some Electron Forge setups.
*   **`electron-store` Version**: The project is using `electron-store` version 8.1.0 due to compatibility or stability reasons identified during development.
*   **Markdown Rendering**: Uses the `marked` library for client-side rendering. Sanitization of Markdown output (e.g., via DOMPurify) is not currently implemented but should be considered if Markdown sources become less trusted.
*   **Known UI Glitch**: A persistent issue exists where the Settings modal may unexpectedly disappear if text within an input field is selected very quickly from right-to-left, especially if the selection hits the "left wall" of the input block. Data is typically saved, but the modal closes. This is under investigation.

---

This document provides an overview of the OmniChat project's current state, goals, and plan. It should be reviewed and updated as the project progresses.
