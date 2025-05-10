**Part 1: The Revised Vision Statement & Core Principles**

---

## OmniChat: The Unified Desktop Client for Bi-Directional Multi-Modal AI Interaction

**Vision Statement:**

To establish OmniChat as an intuitive, powerful, and elegant desktop application that serves as a **universal client for seamless, bi-directional interaction with a diverse array of local and cloud-based Artificial Intelligence models.** OmniChat will empower users to effortlessly send various inputs—including text, images, audio, and video clips—to specialized AI endpoints (such as those hosted via LM Studio, custom servers, or remote APIs). Crucially, it will enable users to receive, manage, interact with, and display the corresponding multi-modal outputs from these AIs, encompassing text, generated images, synthesized audio, video analysis, and other emerging AI-generated content.

OmniChat will achieve this by centralizing API key and endpoint management, providing robust context and session organization, fostering a highly extensible platform for both personal and power-user needs, and prioritizing a clean, aesthetically pleasing, and supremely usable "Paper Modern" interface. It aims to be the go-to application for anyone looking to harness the full spectrum of AI capabilities in a single, consolidated environment.

**Core Pillars of the Vision:**

1.  **Universal AI Endpoint Connectivity:**
    *   Connect to a wide range of AI models: LLMs, VLMs, Image Generation Models, Speech-to-Text (STT), Text-to-Speech (TTS), future audio/video analysis models, and other specialized AI systems.
    *   Support for various hosting methods: Commercial APIs (OpenAI, Anthropic, Gemini, etc.), semi-local solutions (OpenRouter, LM Studio), and potentially direct local model execution.
2.  **Bi-Directional Multi-Modal Interaction:**
    *   **Input:** Users can send text, images (for analysis or as prompt components), audio clips (for transcription or commands), and video snippets (for analysis).
    *   **Output:** The AI can respond with text, generated images, synthesized audio, links to generated/analyzed video, structured data, or other forms of AI-generated content. OmniChat will render these natively or provide appropriate interaction mechanisms.
3.  **Intelligent Context & Session Management:**
    *   Sophisticated conversation history management, including intelligent summarization for long contexts.
    *   Seamless persistence and organization of chat sessions, even those containing diverse media types.
    *   User-defined personas and system prompts applicable across different models.
4.  **Extensibility & Future-Proofing:**
    *   Modular architecture to easily integrate new AI providers, model types, and content handlers.
    *   Potential for a plugin system to allow community or user contributions.
    *   Adaptability to the rapidly evolving AI landscape.
5.  **Superior User Experience & Customization:**
    *   Intuitive, "Paper Modern" design focusing on clarity, ease of use, and aesthetic appeal.
    *   Non-blocking, responsive UI with clear feedback.
    *   Customizable interface elements and workflows where appropriate.
6.  **Privacy & Local Control:**
    *   Prioritize local data storage (`electron-store`) for user-generated content and configurations.
    *   Empower users with control over their data and API key security within their trusted device environment.

**Guiding Principles (Reiteration & Refinement):**

*   **User-Centricity & Intuition:** The user's workflow and ease of interaction are paramount.
*   **Power & Flexibility:** Enable complex interactions without overwhelming the user.
*   **Elegance & Simplicity:** Achieve sophisticated functionality through a clean and uncluttered interface.
*   **Performance & Reliability:** Ensure a stable, responsive application.
*   **Modularity & Maintainability:** Facilitate ongoing development and adaptation.

---
**Part 2: The Detailed Roadmap - Foundational Versions**

This roadmap is designed to incrementally build towards the full vision, ensuring each version delivers tangible value and builds upon a stable foundation.

---

## OmniChat Detailed Roadmap

### **Pre-Roadmap: Current State (as per `documentation.md` v1.4)**

*   **Features:** Multi-LLM text chat, API key/enabled model/persona management, multi-session support with local persistence, basic Markdown rendering, toast notifications, chat export/copy, basic chat search, text-file attachments for context.
*   **Architecture:** Electron, vanilla TS/HTML/CSS, `electron-store`, modular settings UI.
*   **Key Limitation:** Uni-modal output (text-only from AI). Attachments are for *input context* extraction only.

---

### **Version 1.5: Laying the Multi-Modal Output Groundwork**

*   **Objective:** Introduce the capability for OmniChat to receive and display a non-text output (specifically, an image) from an AI, and refine existing text-based context features. This version is critical for breaking the text-only output paradigm.
*   **Theme:** "Seeing is Believing" – First visual output from an AI.

*   **Meticulous Steps:**

    1.  **Conceptual & Architectural Adjustments (Core):**
        *   **1.1. Redefine `ChatMessage` Interface:**
            *   **Action:** Modify `ChatMessage` to support distinct structures for `userInput` and `assistantOutput`. The `assistantOutput` will need a `type` discriminator (e.g., `'text'`, `'image'`) and corresponding data fields (e.g., `text_content`, `image_url`).
            *   **Details:**
                ```typescript
                interface AssistantOutputContent {
                    type: 'text' | 'image' | 'error'; // Start with these
                    text_content?: string;
                    image_url?: string; // URL to the generated image
                    error_message?: string;
                }

                interface ChatMessage {
                    // ... existing fields like id, role, timestamp
                    userInputRaw?: string; // Store the raw user input string
                    // userInputProcessed?: any; // Future: For structured multi-modal user input
                    assistantOutput?: AssistantOutputContent;
                    modelUsed?: string;
                    // ... other metadata
                }
                ```
            *   **Impact:** `electron-store` schema update. Consider simple migration for existing text-only messages (map `old_content` to `assistantOutput: { type: 'text', text_content: old_content }`).
        *   **1.2. Enhance `EnabledModelEntry` Interface:**
            *   **Action:** Add `expectedOutputModalities: Array<'text' | 'image'>` (or similar) to `EnabledModelEntry`.
            *   **Details:** This tells OmniChat what kind of response to expect and how to parse it. Default to `['text']` for existing models.
            *   **UI:** Update the "Enabled Models" settings UI to allow specifying this (initially, could be a hidden/dev-only field or a simple checkbox "Generates Images?").
        *   **1.3. Basic Image Renderer in `addMessageToChat`:**
            *   **Action:** Modify `renderer.ts -> addMessageToChat` to check `message.assistantOutput.type`.
            *   **Details:** If `type === 'image'`, create an `<img>` element and set its `src` to `message.assistantOutput.image_url`. Add basic styling for the image.
            *   **Error Handling:** If `image_url` is missing or image fails to load, display a placeholder or error.

    2.  **Integrate a Test Image Generation Model:**
        *   **2.1. Select Test Provider/Model:**
            *   **Action:** Choose a simple, readily available text-to-image API.
                *   Option A: OpenAI DALL-E (if API key available).
                *   Option B: A public Stable Diffusion API endpoint (e.g., Replicate, or others with free tiers/simple auth).
                *   Option C (Ideal for local dev): If LM Studio or similar can expose a Stable Diffusion model via an OpenAI-compatible API that returns an image URL or base64, use that.
        *   **2.2. Implement Provider-Specific Logic (`index.ts`):**
            *   **Action:** Create a new API handler function (e.g., `handleOpenAiImageGenerationRequest` or `handleStableDiffusionRequest`).
            *   **Details:** This function will:
                *   Take the user's text prompt.
                *   Make the API call to the image generation endpoint.
                *   Parse the response to extract the image URL (or base64 data, though URL is simpler for V1.5).
                *   Return an object conforming to `AssistantOutputContent { type: 'image', image_url: '...' }`.
        *   **2.3. Update `sendChatMessage` IPC Handler (`index.ts`):**
            *   **Action:** Modify `sendChatMessage` to:
                *   Check the `expectedOutputModalities` of the selected `EnabledModelEntry`.
                *   If an image-generating model is selected, route the request to the new provider-specific image generation handler.
        *   **2.4. Configure Test "Enabled Model" in UI:**
            *   **Action:** Manually (or guide user to) add an "Enabled Model" entry for the test image generation model, correctly setting its provider, model ID, API key, and the new `expectedOutputModalities` field.

    3.  **UI/UX for Image Output (Basic):**
        *   **3.1. Display:** Ensure generated images are displayed within the chat flow.
        *   **3.2. Loading State:** While the image is being generated/fetched, display a "Generating image..." placeholder in the message bubble (similar to "..." for text).
        *   **3.3. Context Menu (Optional for 1.5, good quick win):** Right-click on image -> "Copy Image", "Save Image As...". This would require IPC calls to main for save dialog.

    4.  **Refine Existing Text Features (from original `OMNICHAT_VISION_AND_ROADMAP.md` V1.5):**
        *   **4.1. Attachment - Text & HTML Files for Context:**
            *   **Action:** Implement the already planned feature for attaching TXT/HTML files to provide *textual context* to LLMs (where the LLM's output is still text).
            *   **Details:** Follow original plan: `selectFile` IPC, `extractTextFromFile` IPC, prepend content to user prompt. User's message `userInputRaw` would contain the typed text, and the combined prompt goes to the LLM.
        *   **4.2. Chat Summarization - Core Logic & Configuration (Basic):**
            *   **Action:** Implement the foundational logic for chat summarization.
            *   **Details:** Settings UI for enable/disable, token threshold, target token count. `gpt-tokenizer`. Main process summarization logic (`getSummarizedHistory` IPC). Renderer calls this, updates UI with summarized history.
            *   **Focus:** The goal is to reduce token count for *text-based LLMs*.

    5.  **Testing & Documentation:**
        *   **5.1. Thorough Testing:** Test image generation with various prompts. Test text attachment context. Test summarization.
        *   **5.2. Update Internal Documentation:** Reflect architectural changes (`ChatMessage`, `EnabledModelEntry`), new API handlers.

*   **Key Outcomes for V1.5:**
    *   OmniChat can now display AI-generated images.
    *   Core architecture supports multi-modal AI outputs.
    *   Existing text-based features are enhanced (attachments, basic summarization).
    *   A significant step towards the broader vision is achieved.

---

### **Version 2.0: Multi-Modal Input (Images for VLMs) & Enhanced Output Capabilities**

*   **Objective:** Enable users to send images *to* Vision Language Models (VLMs) for analysis, and improve the handling and interaction with both image and potentially audio outputs.
*   **Theme:** "Two-Way Vision" – Sending and receiving visual information.

*   **Meticulous Steps:**

    1.  **Image Input for Vision Language Models (VLMs):**
        *   **1.1. Enhance `ChatMessage` for User Input:**
            *   **Action:** Define a structure for `userInput` within `ChatMessage` to handle multi-modal inputs.
            *   **Details:**
                ```typescript
                interface UserInputAttachment {
                    type: 'image' | 'document'; // Start with image
                    fileName: string;
                    mimeType: string;
                    base64Data?: string; // For sending image data directly
                    // extractedText?: string; // For documents (already in V1.5 logic)
                }

                interface UserInputContent {
                    text?: string;
                    attachments?: UserInputAttachment[];
                }

                interface ChatMessage {
                    // ... id, role, timestamp
                    userInput?: UserInputContent; // New structure
                    assistantOutput?: AssistantOutputContent;
                    // ...
                }
                ```
        *   **1.2. UI for Attaching Images for VLM Input:**
            *   **Action:** Enhance the "Attach File" functionality.
            *   **Details:**
                *   Allow selecting common image types (PNG, JPG, WEBP).
                *   Display a preview of the attached image in the input area.
                *   Allow multiple image attachments if the target VLM supports it (e.g., GPT-4V).
            *   **State Management:** `attachment-handler.ts` needs to manage image file(s) and their base64 representations.
        *   **1.3. `EnabledModelEntry` for VLMs:**
            *   **Action:** Add `acceptedInputModalities: Array<'text' | 'image'>` (or similar) to `EnabledModelEntry`.
            *   **UI:** Update settings to configure this for VLM models (e.g., GPT-4V, Claude 3 Vision).
        *   **1.4. Main Process Logic for VLM Requests (`index.ts`):**
            *   **Action:** Adapt `sendChatMessage` and provider-specific handlers (e.g., for OpenAI, Anthropic).
            *   **Details:**
                *   If `acceptedInputModalities` includes 'image', and user has attached images:
                    *   Format the payload according to the VLM's API requirements (e.g., OpenAI's message content array with text and image_url parts, Anthropic's similar structure).
                    *   Transmit image data (usually as base64 strings or URLs if pre-uploaded).
                *   The VLM's response is typically text, so `assistantOutput` will be `{ type: 'text', text_content: '...' }`.
        *   **1.5. Renderer Update for User's Multi-Modal Input Display:**
            *   **Action:** When displaying the user's own message, if it contained images, render those images alongside their text.

    2.  **Enhanced Image Output Capabilities:**
        *   **2.1. Support Base64 Image Output:**
            *   **Action:** Some image generation APIs might return base64 encoded image data directly instead of a URL.
            *   **Details:** Modify `AssistantOutputContent` for `type: 'image'` to also accept `base64Data?: string`. The renderer will use this for the `<img>` src if `image_url` is not present.
        *   **2.2. Improved Image Interaction in Chat:**
            *   **Action:** Enhance UI for displayed generated images.
            *   **Details:**
                *   Click to view full-size (modal or new window).
                *   More robust "Copy Image" and "Save Image As..." (ensure cross-platform compatibility).
                *   Display image metadata if available (e.g., dimensions, generation seed if API provides it).

    3.  **Introduction to Basic Audio Output (TTS):**
        *   **3.1. `AssistantOutputContent` for Audio:**
            *   **Action:** Add `{ type: 'audio', audio_url?: string, base64Data?: string, autoPlay?: boolean }` to `AssistantOutputContent`.
        *   **3.2. `EnabledModelEntry` for TTS:**
            *   **Action:** `expectedOutputModalities` can now include `'audio'`.
        *   **3.3. Integrate a Test Text-to-Speech (TTS) Provider:**
            *   **Action:** Select a TTS API (e.g., OpenAI TTS, ElevenLabs if simple to integrate, or a browser's built-in `SpeechSynthesis` API for a quick local test initially, though API is better for consistency).
            *   **Main Process:** Implement handler to call TTS API, get audio URL or base64.
        *   **3.4. Renderer for Audio Output:**
            *   **Action:** If `assistantOutput.type === 'audio'`, embed an HTML5 `<audio>` player.
            *   **Details:** Provide controls (play/pause, volume). Consider `autoPlay` option.

    4.  **Refine Summarization (from original roadmap):**
        *   **4.1. Advanced Summarization LLM Configuration:** Settings UI for dedicated summarization model endpoints (LM Studio, custom OpenAI-compatible).
        *   **4.2. Smoother UX for Summarization:** Investigate less disruptive UI updates if possible.

    5.  **Technical Strategy - UI Framework Consideration (as per original roadmap):**
        *   **Action:** Seriously evaluate if the complexity of rendering multi-modal messages (user inputs with image previews, assistant outputs with images/audio players) in vanilla JS is becoming a bottleneck.
        *   **Decision Point:** If so, begin planning for incremental adoption of Svelte or Vue for the chat message rendering component.

    6.  **Testing & Documentation:**
        *   **6.1. Test VLM image inputs with different models.**
        *   **6.2. Test enhanced image outputs.**
        *   **6.3. Test basic TTS audio output.**
        *   **6.4. Document new `ChatMessage` structures, VLM/TTS integration points.

*   **Key Outcomes for V2.0:**
    *   Users can send images to VLMs for analysis.
    *   Image output handling is more robust.
    *   Basic audio output (TTS) is introduced.
    *   The application is becoming a true multi-modal interaction tool.
    *   A decision on UI framework adoption for chat rendering is made or actively planned.

---
**Part 3: The Detailed Roadmap - Advanced Capabilities & Maturity**

---

### **Version 2.5: Expanding Input Horizons & Robust Content Extraction**

*   **Objective:** Broaden the types of files users can attach for AI context/input (PDFs, DOCX), make content extraction more robust and modular, and enhance audio interaction.
*   **Theme:** "Deeper Understanding" – Processing more complex document types and refining audio.

*   **Meticulous Steps:**

    1.  **PDF Content Extraction for Input Context/Analysis:**
        *   **1.1. Integrate PDF Parsing Library:**
            *   **Action:** Add `pdf-parse` (or a similar robust library) to the project dependencies.
        *   **1.2. Modular Content Extraction Service (Main Process):**
            *   **Action (Crucial Refactor):** Create a dedicated service/module (e.g., `src/main/services/content-extractor.ts`).
            *   **Details:**
                *   This service will expose a primary function like:
                    ```typescript
                    async function extractFileContents(
                        filePath: string,
                        mimeType: string
                    ): Promise<{
                        textContent?: string;
                        // Potential future: imagesEmbedded?: string[]; (for RAG on PDFs with images)
                        error?: string;
                    }>
                    ```
                *   Internally, it will route to the correct parsing logic based on `mimeType` (TXT, HTML, PDF).
                *   The existing `extractTextFromFile` IPC handler will now call this central service.
        *   **1.3. PDF Extraction Logic:**
            *   **Action:** Implement PDF parsing within the `ContentExtractionService` using `pdf-parse`.
            *   **Output:** Primarily `textContent`.
        *   **1.4. UI for Attaching PDFs:**
            *   **Action:** Update the "Attach File" dialog and `attachment-handler.ts` to accept `.pdf` files.
            *   **Details:** When a PDF is attached, its `textContent` will be extracted and can be:
                *   Prepended to a text-based LLM prompt (similar to TXT/HTML).
                *   Sent as the primary textual input to a VLM if the VLM is meant to analyze the document content.
        *   **1.5. Update `UserInputAttachment`:**
            *   Ensure `UserInputAttachment.type` can be `'document'` and can hold `extractedText`.

    2.  **DOCX Content Extraction for Input Context/Analysis:**
        *   **2.1. Integrate DOCX Parsing Library:**
            *   **Action:** Add `mammoth.js` (or similar) for `.docx` processing.
        *   **2.2. DOCX Extraction Logic:**
            *   **Action:** Implement DOCX parsing within the `ContentExtractionService`.
            *   **Details:** `mammoth.js` can convert DOCX to plain text or HTML. Plain text is generally safer/simpler for LLM input.
        *   **2.3. UI for Attaching DOCX:**
            *   **Action:** Update "Attach File" to accept `.docx` files.
            *   **Behavior:** Similar to PDFs – extracted text used for LLM/VLM input.

    3.  **Enhanced Audio Input (Transcription - STT):**
        *   **3.1. `UserInputAttachment` for Audio:**
            *   **Action:** Ensure `UserInputAttachment` can handle `type: 'audio'`, including `fileName`, `mimeType`, and `base64Data` (or path to file for local processing).
        *   **3.2. Integrate Speech-to-Text (STT) Capability:**
            *   **Action:** Choose and integrate an STT solution.
                *   Option A (Cloud): OpenAI Whisper API. Requires handling API calls.
                *   Option B (Local, Advanced): Investigate local Whisper models (e.g., via `whisper-node` or a Python bridge if necessary, or if LM Studio can expose Whisper). This is more complex but offers privacy.
                *   Option C (Simpler, Less Accurate): Browser's `SpeechRecognition` API (if acceptable for initial STT).
        *   **3.3. Main Process STT Logic:**
            *   **Action:** If an audio file is attached by the user:
                *   The `ContentExtractionService` (or a new `AudioProcessingService`) transcribes it.
                *   The resulting text is added to the `UserInputContent.text` or as a separate text block.
            *   **IPC:** New IPC call like `transcribeAudioFile(filePath: string)` might be needed.
        *   **3.4. UI for Attaching Audio Files for Transcription:**
            *   **Action:** Update "Attach File" to accept common audio formats (MP3, WAV, M4A).
            *   **Feedback:** Show "Transcribing audio..." state.
        *   **3.5. `EnabledModelEntry` (Consideration):**
            *   While STT is a pre-processing step, some models might accept direct audio input in the future. The architecture should be mindful of this. For now, STT output is text.

    4.  **Refined Audio Output (TTS):**
        *   **4.1. More TTS Provider Options:**
            *   **Action:** Allow configuration of more TTS providers in settings (e.g., ElevenLabs, other cloud services).
            *   **Details:** API key management for these new providers.
        *   **4.2. Audio Player Enhancements:**
            *   **Action:** Improve the embedded audio player.
            *   **Details:** Download button for generated audio, playback speed control (if easy with HTML5 audio).
        *   **4.3. Streaming TTS (Advanced, Optional for 2.5):**
            *   **Action:** Investigate if any TTS providers support streaming audio.
            *   **Details:** This would allow audio to start playing before the entire file is generated, improving perceived responsiveness. Complex to implement.

    5.  **Error Handling & User Feedback:**
        *   **Action:** Improve error handling for all file extraction and audio processing.
        *   **Details:** Clear toast notifications for failures (e.g., "Could not parse PDF," "Transcription failed").
        *   Progress indicators for longer operations like transcription.

    6.  **Testing & Documentation:**
        *   **6.1. Test PDF/DOCX extraction with various files (simple, complex, corrupted).**
        *   **6.2. Test audio transcription with different accents, background noise (if applicable to STT solution).**
        *   **6.3. Test enhanced TTS features.**
        *   **6.4. Document the `ContentExtractionService` and new audio processing flows.

*   **Key Outcomes for V2.5:**
    *   OmniChat can ingest and process content from PDFs and DOCX files for AI interaction.
    *   Robust, modular content extraction is in place.
    *   Users can attach audio files for transcription (STT).
    *   TTS audio output capabilities are more refined.
    *   The application handles a much wider range of user inputs.

---

### **Version 3.0: The "One-Stop" Multi-Modal Hub & Extensibility**

*   **Objective:** Realize the full vision of a comprehensive multi-modal AI client by adding basic video processing, further enhancing audio/image capabilities, and exploring a plugin architecture for future growth.
*   **Theme:** "Universal AI Access" – OmniChat as the central hub for diverse AI tasks.

*   **Meticulous Steps:**

    1.  **Basic Video Input Processing (Analysis/Transcription Context):**
        *   **1.1. `UserInputAttachment` for Video:**
            *   **Action:** Support `type: 'video'` in `UserInputAttachment`.
        *   **1.2. Video Content Processing Strategy:**
            *   **Action:** Define how video input will be handled. Direct video processing is complex.
                *   Option A (Frame Extraction + VLM): Extract keyframes from the video, send them to a VLM for description. Combine descriptions as text context.
                *   Option B (Audio Track Transcription): Extract audio track, transcribe it using STT logic from V2.5. Use transcript as text context.
                *   Option C (Combination): Both A and B.
            *   **Libraries:** Need libraries for video processing (e.g., `ffmpeg` via a Node wrapper like `fluent-ffmpeg` – can be heavy).
        *   **1.3. Main Process Video Logic:**
            *   **Action:** Implement chosen strategy in `ContentExtractionService` or a new `VideoProcessingService`.
            *   **Output:** Extracted textual descriptions or transcripts.
        *   **1.4. UI for Attaching Video Files:**
            *   **Action:** Allow attaching common video formats (MP4, MOV, WEBM).
            *   **Feedback:** Show "Processing video..." state.

    2.  **Basic Video Output (Playback Information / Links):**
        *   **2.1. `AssistantOutputContent` for Video:**
            *   **Action:** Add `{ type: 'video_info', video_url: string, title?: string, description?: string, thumbnail_url?: string }` to `AssistantOutputContent`.
            *   **Note:** AI generating entire video files on the fly is generally not feasible for a desktop client yet. This is about AI *referencing or recommending* videos.
        *   **2.2. `EnabledModelEntry` for Video Info:**
            *   **Action:** `expectedOutputModalities` can include `'video_info'`. Some AIs might be good at finding relevant videos.
        *   **2.3. Renderer for Video Info Output:**
            *   **Action:** Display video information nicely: thumbnail, title, description.
            *   **Details:** Embed a player if it's a direct link to a playable source (e.g., YouTube embed, direct MP4 link). Otherwise, a clickable link.

    3.  **Advanced Image Interaction (Consideration: Image Editing/Annotation Input):**
        *   **3.1. (Exploratory) Basic Image Annotation Input:**
            *   **Action:** Investigate simple client-side image annotation (e.g., drawing bounding boxes, adding text overlays) before sending to a VLM.
            *   **Libraries:** Libraries like `Fabric.js` or `Konva.js` could be used. This is a significant feature.
            *   **Benefit:** Allows more precise interaction with VLMs (e.g., "What is in this box?").

    4.  **PPTX Content Extraction (Input Context):**
        *   **4.1. Integrate PPTX Parsing Library:**
            *   **Action:** Research and add a library for PPTX processing (e.g., `pptx2json` or others that can extract text and image descriptions).
        *   **4.2. PPTX Extraction Logic:**
            *   **Action:** Implement in `ContentExtractionService`. Extract text slides, notes, possibly image alt-texts.
        *   **4.3. UI for Attaching PPTX:**
            *   **Action:** Update "Attach File" to accept `.pptx` files.

    5.  **Plugin Architecture (Strategic Exploration & Foundational Work):**
        *   **5.1. Define Plugin Scope:**
            *   **Action:** Determine initial areas for plugins.
                *   AI Providers/Models: Allow users/community to add support for new APIs not natively included.
                *   Content Extractors: For niche file types not covered.
                *   Renderers: For custom display of specific `AssistantOutputContent` types.
        *   **5.2. Design Plugin Interface:**
            *   **Action:** Define clear JavaScript/TypeScript interfaces that plugins must implement.
            *   **Example (Provider Plugin):** `interface AiProviderPlugin { name: string; getModels(): Promise<Model[]>; sendMessage(payload: PluginPayload): Promise<PluginResponse>; }`
        *   **5.3. Plugin Loading & Management Mechanism:**
            *   **Action:** Implement a system to discover, load, and manage plugins (e.g., from a user-defined folder).
            *   **UI:** Basic settings UI to view loaded plugins, enable/disable.
        *   **5.4. Refactor Core Logic for Plugin Hooks:**
            *   **Action:** Identify points in `index.ts` and `renderer.ts` where plugin functionality can be injected (e.g., model selection list, message sending, content rendering).
            *   **Note:** This is a significant architectural undertaking. Start with one plugin type (e.g., AI Providers).

    6.  **Performance Optimization & UI/UX Refinements:**
        *   **6.1. Profiling:** Profile application performance, especially with large files, many messages, and concurrent AI calls. Optimize bottlenecks.
        *   **6.2. UI Framework Leverage:** If a UI framework (Svelte/Vue) was adopted for chat rendering, leverage it for smoother animations, richer interactions, and potentially theming (light/dark).
        *   **6.3. Advanced Search/Filtering:** More granular search options for chat sessions (e.g., by media type contained, by specific model used).

    7.  **Testing & Documentation:**
        *   **7.1. Test video input/output flows.**
        *   **7.2. Test PPTX extraction.**
        *   **7.3. If plugin architecture started, test plugin loading and basic functionality.**
        *   **7.4. Comprehensive update to all documentation (user and developer).**

*   **Key Outcomes for V3.0:**
    *   OmniChat supports a wide range of multi-modal inputs (text, image, audio, basic video context, documents).
    *   It can handle diverse AI outputs (text, images, audio, video links).
    *   The foundation for a plugin architecture is laid, paving the way for community contributions and easier expansion.
    *   The application is highly performant and polished, truly serving as a universal AI interaction hub.

---

### **Post-V3.0: Future Horizons**

*   **Advanced RAG (Retrieval Augmented Generation):** Built-in vector DB / semantic search over user's documents for richer context.
*   **Agentic Capabilities:** Support for AI agents that can perform multi-step tasks.
*   **Real-time Collaboration (Optional):** If a use case emerges for shared AI interaction.
*   **Deeper OS Integration:** E.g., global hotkeys, system tray agent.
*   **Full Theming Support.**
*   **Mobile Companion App (Very Long Term):** Synchronized experience.

---
Regarding current architecture:

This is a critical strategic question. Based on the `documentation.md` you provided and the ambitious vision for OmniChat, here's an analysis of the current architecture's strengths and weaknesses, and whether a rewrite is necessary:

**Current Architecture (as understood from `documentation.md`):**

*   **Platform:** Electron (Node.js, HTML, CSS, TypeScript).
*   **UI (Renderer Process):** Vanilla TypeScript, HTML, CSS. No major frontend framework. Modularized settings UI.
*   **Core Logic (`src/renderer.ts`):** Main script for UI, chat session logic, event listeners, orchestrates UI modules.
*   **State Management:** Module-level variables in `src/renderer.ts`.
*   **API Integration:** Direct `axios` calls.
*   **Local Storage:** `electron-store`.
*   **Build System:** Electron Forge with Webpack.

**Strengths of the Current Architecture for the Vision:**

1.  **Electron Foundation:** Excellent choice for a cross-platform desktop application. It provides access to Node.js for backend tasks (like managing local model processes, file system access, complex API logic) and web technologies for the UI. This is well-aligned with the vision.
2.  **TypeScript:** Provides type safety and better code organization, which is crucial for a large, evolving project.
3.  **Modular UI for Settings:** The refactoring of settings into `settings-modal-manager.ts`, `settings-api-keys-ui.ts`, etc., is a good step towards maintainability. This approach can be extended.
4.  `electron-store`: Suitable for local storage of configurations, API keys, and chat history for a personal-use application.
5.  **Existing Core Functionality:** You have a working application with chat, session management, API key handling, etc. This is a valuable starting point and represents significant effort already invested.

**Weaknesses/Challenges of the Current Architecture for the Full Vision:**

1.  **Vanilla JS/TS for Complex UI (Renderer - Chat Area):**
    *   **The Biggest Concern.** As OmniChat moves towards rich multi-modal input (previews of attached images/audio/video in the input area) and especially multi-modal output (rendering images, audio players, video embeds, structured data from AI *within the chat messages*), managing the DOM, state, and event handling with vanilla JS/TS will become increasingly complex, error-prone, and slow to develop.
    *   Imagine a chat message that needs to display user-typed text, an image they attached, and then an AI response that includes generated text, a generated image, and an audio player. Managing the lifecycle, updates, and interactions of these elements purely via DOM manipulation will be very challenging.
2.  **Global State Management (Renderer):**
    *   While module-level variables in `renderer.ts` might work for the current feature set, as the application grows with more complex state (e.g., active media processing, plugin states, detailed model capabilities), this can become hard to manage, debug, and can lead to prop-drilling or tight coupling.
3.  **Direct `axios` Calls (Main Process - Can be Improved):**
    *   While functional, as you integrate more diverse AI providers with varying authentication schemes, request/response formats, and error handling, a more structured approach to API interaction (e.g., a dedicated API client service layer with provider-specific adapters/strategies) would improve maintainability and testability.
4.  **Extensibility (Plugin Architecture):**
    *   The current architecture doesn't inherently lend itself to a plugin system without significant refactoring. Adding hooks, defining plugin interfaces, and managing plugin lifecycles will require careful architectural design.

**Rewrite from Scratch vs. Refactor/Evolve:**

**A full rewrite from scratch is likely NOT necessary and would discard valuable existing work.** The Electron foundation is solid. The core problem isn't the *platform* but specific implementation choices, primarily in the renderer process for the UI.

**Recommended Approach: Strategic and Incremental Refactoring & Evolution**

Here's a path forward:

1.  **Prioritize the Renderer's Chat UI:**
    *   **Adopt a UI Framework (Svelte, Vue, or React/Preact):** This is the most critical change for realizing the multi-modal vision.
        *   **Why?** These frameworks provide declarative rendering, component-based architecture, efficient state management, and tooling that vastly simplifies building complex, interactive UIs.
        *   **How?**
            *   **Incrementally:** You don't need to rewrite the *entire* renderer at once. Start by rewriting the chat message rendering component and the chat input area. The settings panels can remain vanilla JS/TS for now if they are stable and less complex.
            *   **Svelte or Vue** are often recommended for Electron apps or for introducing a framework into an existing project due to their smaller learning curve, good performance, and ease of integration compared to React's larger ecosystem requirements (though React is also viable).
    *   **Benefit:** This will make implementing multi-modal message display (images, audio players in chat bubbles) and complex input areas (with file previews) much more manageable and maintainable.

2.  **Refine State Management (Renderer):**
    *   If you adopt a UI framework, use its idiomatic state management solution (e.g., Svelte Stores, Vuex/Pinia, React Context/Redux/Zustand).
    *   This will provide a more structured way to manage application state related to the UI, active chat, selected models, etc.

3.  **Structure API Interaction (Main Process):**
    *   Create a dedicated service layer in the main process for handling interactions with AI APIs.
    *   Use a pattern like the Strategy or Adapter pattern to handle different AI providers. This will make adding new providers cleaner.
    *   Centralize error handling, request formatting, and response parsing for different APIs.

4.  **Plan for Extensibility (Later, Post-UI Refactor):**
    *   Once the core UI and API interactions are more robust, you can start designing the plugin architecture. The modularity introduced by a UI framework and a service layer for APIs will make it easier to define clear plugin interfaces and integration points.

5.  **Evolve the Main Process Logic:**
    *   The main process logic in `index.ts` will continue to house business logic, `electron-store` interactions, IPC handling, and the new API service layer. This part of the architecture is generally sound but will grow as features are added.

**When a component becomes too complex in Vanilla JS/TS:**

*   **Symptom:** You find yourself writing a lot of manual DOM manipulation code (`document.createElement`, `appendChild`, `setAttribute`, complex event listener management).
*   **Symptom:** State updates become hard to track, leading to UI inconsistencies.
*   **Symptom:** Adding a new visual element or interaction to an existing component feels like a major undertaking.
*   **Action:** This is a strong signal that this specific component would benefit from being rewritten using a UI framework.

**Conclusion:**

Your current architecture has a **strong foundation** with Electron and TypeScript. **You do not need to rewrite from scratch.**

The **primary area requiring significant evolution is the renderer process's UI handling, especially for the chat interaction area, by adopting a modern JavaScript framework.** This is the most critical step to sustainably achieve the complex multi-modal aspects of your vision. Other areas like state management and main process API interaction can be refactored and improved incrementally.

Start with the UI framework adoption for the most complex visual part (chat messages and input). This will provide the biggest leverage for future development towards your ambitious and exciting vision for OmniChat.

