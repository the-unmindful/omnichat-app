# OmniChat: Multi-LLM Chat Client - Project Documentation

**Version:** 1.1 (Reflecting current features as of 2025-05-10)
**Date:** 2025-05-10 (Original: 2023-10-27)

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
*   **Basic Utilities:**
    *   [Implemented] Copy button (📋 icon) on each assistant message to copy the preceding user question and the assistant's response (with model label) to the clipboard in Markdown format.
    *   [Implemented] "Export Chat" button in the chat header to save the entire active chat session as a Markdown (.md) file, including roles and model labels.

## 4. Advanced Features & Roadmap

*   **Currently Under Development / Next Up:**
    *   **Personas:** Define and save custom system prompts (Personas). Select a Persona to apply to a chat session.
    *   **Model Parameter Configuration:** UI to view and tweak common model parameters (e.g., temperature, top_p) associated with personas or globally.
*   **Post-MVP Roadmap (Future Considerations):**
    *   **Saved Prompts ("Snippets"):** UI to create, save, edit, delete, and easily insert reusable prompt templates.
    *   **Chat Organization:** Star/Favorite chats, Folder system for chats.
    *   **Enhanced Export:** Export chat as PDF.
    *   **UI/UX Refinements:** Theme support (Light/Dark), improved syntax highlighting for code blocks in rendered Markdown, smoother animations.
    *   **Document Attachment (Significant Feature - V2/V3):** Ability to attach documents for context.

## 5. Technical Architecture Overview (Current)

*   **Platform:** Desktop Application (Windows, macOS, Linux via Electron).
*   **Framework:** Electron (using Node.js, HTML, CSS, TypeScript).
*   **UI:** Vanilla TypeScript, HTML, and CSS for the renderer process. No major frontend framework (like React, Vue, Svelte) is currently used.
*   **State Management:** Primarily managed using module-level variables within `src/renderer.ts`.
*   **API Integration:** Direct `axios` calls to LLM provider APIs, with provider-specific formatting logic in `src/index.ts`.
*   **Local Storage:** `electron-store` (version 8.1.0) is used for all persistent data, storing it in a JSON file. This includes:
    *   API Keys (values are base64 encoded, not fully encrypted).
    *   Enabled Model configurations.
    *   Chat Sessions (including all messages and metadata).
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

---

This document provides an overview of the OmniChat project's current state, goals, and plan. It should be reviewed and updated as the project progresses.
