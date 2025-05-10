# OmniChat: Vision & Roadmap - The Universal Multi-Modal AI Client

**Document Version:** 1.0
**Date:** 2025-05-10

## 1. Overarching Vision

To establish OmniChat as a premier, intuitive, and powerful desktop application that serves as a **universal client for interacting with a diverse range of AI models**, including Large Language Models (LLMs), Vision Language Models (VLMs), and future audio, video, and other specialized AI systems. OmniChat will empower users by centralizing access, streamlining workflows, providing advanced context management capabilities (through sophisticated attachment processing and intelligent chat summarization), and offering a highly extensible platform for personal and power-user needs.

## 2. Guiding Principles

*   **User-Centricity & Intuition:** Design with the user's workflow as the paramount consideration. Prioritize ease of use, discoverability of features, and a seamless, elegant experience.
*   **Power & Extensibility:** Build a robust platform capable of handling complex tasks and easily integrating new AI providers, model types, and content processing capabilities without requiring fundamental architectural overhauls.
*   **Future-Proofing & Adaptability:** Architect the application to anticipate and accommodate the rapidly evolving AI landscape, ensuring OmniChat remains relevant and cutting-edge.
*   **Performance & Reliability:** Ensure a responsive, stable application that users can depend on for critical interactions with AI models.
*   **Modularity & Maintainability:** Develop components and services that are well-defined, loosely coupled, and easily testable to facilitate ongoing development and maintenance.
*   **Privacy & Local Control:** Continue to prioritize local data storage and processing where feasible, giving users control over their sensitive information.

## 3. Core Pillars & Strategic Feature Areas

OmniChat's development will be focused around these central pillars:

### 3.1. Universal AI Model Interaction
*   Seamlessly connect to and switch between various AI model providers (OpenAI, Anthropic, Gemini, OpenRouter, local instances like LM Studio, etc.).
*   Support for diverse model types: LLMs, VLMs, and future integrations for audio, video, and other specialized models.
*   Unified chat interface that adapts to the capabilities of the selected model (e.g., text-only, multi-modal input).

### 3.2. Advanced Context Management
*   **Intelligent Attachment Processing:**
    *   Extract and integrate content from various file types (TXT, HTML, Images with OCR, PDF, DOCX, PPTX) into the LLM context.
    *   Handle images not just for OCR but also as direct input for Vision Language Models.
    *   Attachments are primarily for transient context provision to the AI, not for persistent storage within chat logs unless explicitly designed for certain workflows.
*   **Automated Chat Summarization:**
    *   Intelligently summarize long conversations to maintain context within token limits for LLMs.
    *   User-configurable thresholds, target token counts, and choice of summarization models (including local options).
    *   Non-intrusive background processing with clear user notifications.

### 3.3. Multi-Modal Capabilities
*   Native support for sending and receiving multi-modal content (text, images initially).
*   Architecture designed to incorporate audio (transcription, direct input) and video (analysis, transcription) processing in the future.
*   Consistent UI/UX for handling different types of media within the chat interface.

### 3.4. Extensible Provider & Model Management
*   User-friendly interface for adding, configuring, and managing API keys and enabled model configurations.
*   Clear distinction and configuration for different model capabilities (e.g., text-only, VLM, summarization-specific).
*   Potential for a plugin-like system for community or user-driven additions of new providers or local model interfaces.

### 3.5. Superior User Experience & Customization
*   Clean, "Paper Modern" aesthetic with a focus on clarity and usability.
*   Robust chat session management, search, and organization.
*   Customizable personas and system prompts.
*   Non-blocking notifications and smooth interactions.
*   Consideration for UI framework adoption to enhance development and maintainability of complex UI components.

## 4. Versioned Roadmap & Meticulous Steps

This roadmap breaks down the vision into manageable versions with key objectives and steps.

### **Version 1.0: Foundation & Core Chat (Current Status as of Documentation v1.2)**
*   **Objective:** Stable multi-LLM chat client with robust session management, API key handling, enabled model configuration, and persona management.
*   **Key Features Implemented:** As detailed in `documentation.md` (multi-session, markdown rendering, API/model/persona settings, basic export/copy, chat search).

---

### **Version 1.5: Enhanced Context - Text Attachments & Basic Summarization**
*   **Objective:** Introduce initial attachment processing for text-based files and lay the groundwork for intelligent context management.
*   **Meticulous Steps:**
    1.  **Attachment - Text & HTML Files:**
        *   **UI:** Add "Attach File" button; display selected filename (TXT, HTML) with a clear option.
        *   **IPC & Main Process:**
            *   Implement `selectFile` IPC for single TXT/HTML file selection.
            *   Implement `extractTextFromFile` IPC to read content from these files.
        *   **Renderer:**
            *   Manage state for the selected file.
            *   On send, fetch extracted text and prepend it to the user's prompt, clearly demarcated (e.g., `[Content from attachment: filename.txt]\n...\n\nUser Prompt:...`).
            *   Update `ChatMessage.content` to be a simple string containing this combined text.
        *   **Testing:** Verify with various LLMs that the combined text is processed correctly.
    2.  **Chat Summarization - Core Logic & Configuration:**
        *   **Settings UI:**
            *   Create "Context Management" section.
            *   Add fields: Enable/Disable, Token Threshold, Target Token Count.
            *   Add basic configuration for a Summarization LLM (e.g., allow selecting from existing "Enabled Models" or a hardcoded test endpoint).
        *   **`electron-store`:** Add `summarizationSettings` to schema.
        *   **Token Counting:**
            *   Integrate `gpt-tokenizer` (or similar) into the main process.
            *   Implement `countTokens` IPC call.
        *   **Main Process Summarization Logic (IPC `getSummarizedHistory`):**
            *   If enabled and threshold exceeded:
                *   Identify messages for summarization.
                *   Construct summarization prompt.
                *   Make an `axios` call to the configured summarization LLM.
                *   Replace older messages with a system message: `[System: Previous conversation summarized as: {summary}]`.
        *   **Renderer Integration (`handleSendMessage`):**
            *   Call `getSummarizedHistory` before sending.
            *   If summarized, use the new history for the LLM call.
            *   Show a toast notification (e.g., "Chat history summarized to maintain context").
            *   **Decision Point:** For V1.5, the UI will show the summarized history directly. (Simpler to implement initially).
        *   **Dependencies:** `gpt-tokenizer`.
    3.  **Documentation:** Update internal and potentially user-facing documentation for these new features.

---

### **Version 2.0: Multi-Modal Input (Images) & Advanced Summarization**
*   **Objective:** Introduce image attachments with OCR and direct VLM input, and refine summarization.
*   **Meticulous Steps:**
    1.  **Image Attachment - OCR & VLM Data Preparation:**
        *   **UI:** Update "Attach File" dialog to accept common image types (PNG, JPG, WEBP).
        *   **Dependencies:** Integrate an OCR library (e.g., Tesseract.js) into the main process.
        *   **IPC & Main Process (`extractContentFromFile` enhancement):**
            *   If an image is provided:
                *   Perform OCR to get `extractedOcrText`.
                *   Convert image to base64 `imageDataUrl`.
                *   Return both `extractedOcrText` and `imageDataUrl`.
        *   **`ChatMessage.content` Structure Change:**
            *   Modify `ChatMessage.content` to support `string | Array<{ type: 'text', text: string } | { type: 'image_url', image_url: { url: string } }>`.
            *   Add `attachmentName?: string` to `ChatMessage` for UI reference.
        *   **Renderer (`handleSendMessage`):**
            *   Construct `messageContentParts` array:
                *   Include `extractedOcrText` as a text part.
                *   Include `imageDataUrl` as an image part.
                *   Include user's typed prompt as a text part.
            *   Set `userMessage.content` to this array.
        *   **Main Process (`sendChatMessage` & `formatHistoryFor<Provider>`):**
            *   **Crucial Refactor:** Adapt these functions to handle the new array-based `content` structure.
            *   Format the payload according to the specific multi-modal API requirements of providers (e.g., OpenAI GPT-4V, Claude 3).
            *   `EnabledModelEntry` may need a flag like `acceptsMultimodalContent: boolean` or `contentTypeSupport: ['text', 'image']`.
        *   **Renderer (`addMessageToChat`):**
            *   Update to display messages with `attachmentName`.
            *   Render `message.content` parts: text as text, images using `<img>` tag with base64 src.
    2.  **Advanced Summarization LLM Configuration:**
        *   **Settings UI:** Enhance summarization LLM configuration:
            *   Dedicated fields for LM Studio URL.
            *   Clearer selection from "Enabled Models."
            *   Option for custom OpenAI-compatible endpoints with dedicated API key input if needed.
    3.  **Refine Summarization UX:**
        *   Investigate smoother UI updates when summarization occurs (e.g., subtle indicators rather than full re-render if too jarring).
    4.  **Technical Strategy - UI Framework Consideration:**
        *   **Evaluation Point:** Assess the complexity of the multi-modal message rendering in vanilla JS.
        *   If development becomes significantly slow or error-prone, begin planning for incremental adoption of a UI framework (e.g., Svelte, Vue) for the chat display component. This is a strategic technical debt reduction step.

---

### **Version 2.5: Broader File Support & Robust Content Extraction**
*   **Objective:** Expand attachment handling to include PDF and DOCX, making the content extraction more robust.
*   **Meticulous Steps:**
    1.  **PDF Text Extraction:**
        *   **Dependencies:** Add `pdf-parse` to the project.
        *   **Main Process (`extractContentFromFile`):** Add logic to use `pdf-parse` for `.pdf` files, returning `extractedText`.
        *   **UI:** Add `.pdf` to accepted file types in the "Attach File" dialog.
    2.  **DOCX Text Extraction:**
        *   **Dependencies:** Add `mammoth.js` (or similar) for `.docx` processing.
        *   **Main Process (`extractContentFromFile`):** Add logic to use `mammoth.js` to convert DOCX to plain text or HTML (decide which is better for LLMs), returning `extractedText` or `rawHtmlContent`.
        *   **UI:** Add `.docx` to accepted file types.
    3.  **Modular Content Extraction Service (Refactor):**
        *   In the main process, refactor content extraction logic into a dedicated module/service (e.g., `src/main/services/content-extractor.ts`).
        *   This service will have a primary function like `async function extractFileContents(filePath: string, fileType: string): Promise<{ textContent?: string; imageDataUrl?: string; rawHtmlContent?: string; error?: string }>` that internally routes to the correct library (Tesseract, pdf-parse, mammoth, fs.readFile).
        *   The IPC handler `extractContentFromFile` will call this service.
    4.  **Error Handling:** Improve error handling for all file extraction processes (e.g., corrupted files, library errors) and provide clear feedback to the user.

---

### **Version 3.0: The "One-Stop" Multi-Modal Hub**
*   **Objective:** Realize the vision of a comprehensive multi-modal AI client by adding audio/video processing and further extensibility.
*   **Meticulous Steps:**
    1.  **Audio Processing (Transcription):**
        *   **Research:** Investigate local and API-based speech-to-text solutions (e.g., OpenAI Whisper via API, or local models if feasible).
        *   **UI:** Allow attaching common audio files.
        *   **Main Process:** Implement audio transcription. Extracted text is then handled like other text attachments.
        *   **`ChatMessage.content`:** May need a new part type if sending audio data directly to models that support it, or just use the transcribed text.
    2.  **Video Processing (Basic Analysis/Transcription):**
        *   **Research:** Similar to audio, investigate options for video transcription or basic frame analysis if VLMs can process individual frames.
        *   **UI:** Allow attaching common video files.
        *   **Main Process:** Implement video content processing.
    3.  **PPTX Content Extraction:**
        *   **Dependencies:** Add a library for PPTX processing.
        *   **Main Process:** Integrate into the `ContentExtractionService`.
    4.  **Plugin Architecture (Exploration):**
        *   Investigate a simple plugin system for:
            *   Adding new AI providers/APIs.
            *   Adding custom content extractors for niche file types.
    5.  **Advanced UI/UX Refinements:**
        *   If a UI framework was adopted, leverage it for richer interactions, animations, and potentially theming.
        *   More sophisticated display for different media types in chat.
    6.  **Performance Optimization:** Profile and optimize all aspects of the application, especially content processing and communication with numerous APIs.

## 5. Key Technical Strategies & Considerations (Reiteration & Emphasis)

*   **Platform:** Electron remains the core platform.
*   **Main Process:** Node.js/TypeScript for all backend logic, file operations, native module integrations (OCR, PDF parsing), and AI API communications.
*   **Renderer Process (UI Strategy):**
    *   Start with enhancing the existing vanilla JS/TS.
    *   **Proactively plan for and execute an incremental adoption of a modern UI framework (e.g., Svelte, Vue, or React/Preact) as UI complexity for multi-modal display and interaction grows.** This is critical for long-term maintainability and development velocity. Target components like chat message rendering first.
*   **State Management (Renderer):** If a UI framework is adopted, use its idiomatic state management. If remaining vanilla, consider a simple state management pattern or a lightweight library if global state becomes too complex.
*   **Modular Services:** Continue to build backend functionalities (content extraction, API interaction for specific providers, summarization) as well-defined, reusable modules/services.
*   **Asynchronous Operations:** Ensure all I/O-bound and potentially long-running operations (file processing, API calls) are asynchronous to keep the UI responsive.
*   **Configuration Management:** Robustly manage user configurations for API keys, enabled models, summarization settings, etc., using `electron-store`.
*   **Testing:** Implement unit and integration tests for critical components, especially content extraction and API interaction logic.

## 6. Success Metrics & Future Outlook

*   **User Adoption & Feedback:** Positive user feedback and growing usage.
*   **Feature Completion:** Successful implementation of roadmap versions.
*   **Performance:** Application remains responsive and stable under load.
*   **Extensibility:** Ease of adding new AI models, providers, and file types.
*   **Community (Long-Term):** Potential for community contributions if a plugin system is realized.

OmniChat has the potential to become an indispensable tool for anyone working extensively with diverse AI models. By following this versioned roadmap and adhering to sound technical strategies, we can build this vision incrementally and sustainably. This document should be considered living and revisited at the start of each major version cycle.
