import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { marked } from 'marked';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

@customElement('chat-message-component')
export class ChatMessageComponent extends LitElement {
  @property({ type: String })
  role: 'user' | 'assistant' | 'system' | 'error' = 'user';

  @property({ type: String })
  messageContent = '';

  @property({ type: String })
  outputType: 'text' | 'image' | 'error' | 'loading' = 'text';

  @property({ type: String })
  imageUrl?: string;

  @property({ type: String })
  modelUsed?: string;

  @property({ type: String })
  personaUsedName?: string;

  @property({ type: String })
  messageId?: string; 

  @property({ type: Object })
  onCopy?: (component: ChatMessageComponent) => Promise<void>;

  @state()
  private _isCopied = false;

  // _isImageLoading and _imageLoadError are bypassed in this diagnostic version's render method for images
  @state() 
  private _isImageLoading = false; // Still declare for willUpdate
  @state()
  private _imageLoadError = false; // Still declare for willUpdate


  static styles = css`
    :host {
      display: block;
      margin-bottom: 12px;
      font-family: var(--font-family, sans-serif);
    }

    .chat-entry {
      display: flex;
      flex-direction: column;
    }

    .chat-entry.user {
      align-items: flex-end;
    }
    .chat-entry.assistant, .chat-entry.system, .chat-entry.error {
      align-items: flex-start;
    }

    .message-bubble {
      max-width: 85%;
      padding: 10px 15px;
      border-radius: 18px;
      line-height: 1.5;
      position: relative; /* For copy button positioning */
    }

    .message-bubble.user {
      background-color: var(--user-message-bg, #007bff);
      color: var(--user-message-text, white);
      border-bottom-right-radius: 4px;
    }

    .message-bubble.assistant {
      background-color: var(--assistant-message-bg, #f0f0f0);
      color: var(--assistant-message-text, #333);
      border-bottom-left-radius: 4px;
    }

    .message-bubble.system {
      background-color: var(--system-message-bg, #e0e0e0);
      color: var(--system-message-text, #555);
      font-style: italic;
      font-size: 0.9em;
      border-radius: 8px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    
    .message-bubble.error {
      background-color: var(--error-message-bg, #ffebee);
      color: var(--error-message-text, #c62828);
      border: 1px solid var(--error-message-border, #c62828);
      border-radius: 8px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .message-content {
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .message-content pre {
      background-color: var(--code-block-bg, #2d2d2d);
      color: var(--code-block-text, #f8f8f2);
      padding: 1em;
      border-radius: 0.3em;
      overflow-x: auto;
      font-family: var(--font-family-monospace, monospace);
      font-size: 0.9em;
    }
    .message-content code:not(pre code) {
      background-color: var(--inline-code-bg, #e0e0e0);
      color: var(--inline-code-text, #333);
      padding: 0.2em 0.4em;
      border-radius: 0.2em;
      font-family: var(--font-family-monospace, monospace);
      font-size: 0.9em;
    }
    .message-content table {
      border-collapse: collapse;
      margin: 1em 0;
      width: auto;
      border: 1px solid var(--table-border-color, #ccc);
    }
    .message-content th, .message-content td {
      border: 1px solid var(--table-border-color, #ccc);
      padding: 0.5em;
      text-align: left;
    }
    .message-content th {
      background-color: var(--table-header-bg, #f0f0f0);
    }
    .message-content blockquote {
      border-left: 4px solid var(--blockquote-border-color, #ccc);
      padding-left: 1em;
      margin-left: 0;
      color: var(--blockquote-text-color, #555);
    }
    .message-content ul, .message-content ol {
      padding-left: 1.5em;
    }
    .message-content p {
        margin-top: 0;
        margin-bottom: 0.5em;
    }
    .message-content p:last-child {
        margin-bottom: 0;
    }
    .message-content img { /* General image styling */
      max-width: 100%;
      height: auto;
      border-radius: 10px;
      margin-top: 8px;
      display: block;
    }
    .image-loading-placeholder { /* Still needed for non-diagnostic version */
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 150px;
      width: 100%;
      background-color: var(--assistant-message-bg, #f0f0f0);
      border-radius: 10px;
      color: var(--assistant-message-text, #333);
    }

    .model-label-outside {
      font-size: 0.75em;
      color: var(--model-label-text, #777);
      margin-top: 4px;
      padding-left: 5px;
    }
    .chat-entry.user .model-label-outside {
      text-align: right;
      padding-right: 5px;
      padding-left: 0;
    }

    .copy-button {
      position: absolute;
      top: 5px;
      right: 5px;
      background: var(--copy-button-bg, rgba(0,0,0,0.1));
      color: var(--copy-button-text, #fff);
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.3;
      transition: opacity 0.2s ease-in-out;
    }
    .message-bubble:hover .copy-button {
      opacity: 1;
    }
    .copy-button:hover {
      background: var(--copy-button-hover-bg, rgba(0,0,0,0.2));
    }

    .loading-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 20px;
    }
    .loading-indicator span {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin: 0 2px;
      background-color: var(--assistant-message-text, #333);
      border-radius: 50%;
      animation: loading-dots 1.4s infinite ease-in-out both;
    }
    .loading-indicator span:nth-child(1) {
      animation-delay: -0.32s;
    }
    .loading-indicator span:nth-child(2) {
      animation-delay: -0.16s;
    }
    @keyframes loading-dots {
      0%, 80%, 100% {
        transform: scale(0);
      }
      40% {
        transform: scale(1.0);
      }
    }
  `;

  private async _handleCopy() {
    if (this.onCopy) {
      await this.onCopy(this);
      this._isCopied = true;
      setTimeout(() => { this._isCopied = false; }, 1500);
    }
  }

  // These handlers are not used by the diagnostic image rendering below, but kept for completeness
  private _handleImageLoad() {
    this._isImageLoading = false;
    this._imageLoadError = false;
  }

  private _handleImageError() {
    this._isImageLoading = false;
    this._imageLoadError = true;
  }

  // willUpdate is kept as it might be relevant for other property changes
  willUpdate(changedProperties: Map<string | symbol, unknown>) {
    if (changedProperties.has('imageUrl') && this.outputType === 'image' && this.imageUrl) {
      // For the diagnostic version, we are not using _isImageLoading for the main image display path
      // but we'll set it for consistency if other parts of the component were to rely on it.
      this._isImageLoading = true; 
      this._imageLoadError = false;
    }
  }

  render() {
    let contentBlock;

    if (this.outputType === 'loading' || (this.role === 'assistant' && this.messageContent === '...')) {
      contentBlock = html`<div class="loading-indicator"><span></span><span></span><span></span></div>`;
    } 
    else if (this.outputType === 'image' && this.imageUrl) {
      // Always render the img tag if we have a URL, so its load/error events can fire.
      // Control visibility of placeholder/image/error based on state.
      contentBlock = html`
        <div class="image-container">
          ${this._isImageLoading ? html`
            <div class="image-loading-placeholder"><div class="loading-indicator"><span></span><span></span><span></span></div></div>
          ` : ''}
          ${this._imageLoadError && !this._isImageLoading ? html`
            <div class="image-loading-placeholder">Error loading image. URL: ${this.imageUrl}</div>
          ` : ''}
          <img 
            src="${this.imageUrl}" 
            alt="AI Generated Image" 
            @load=${() => this._handleImageLoad()} 
            @error=${() => this._handleImageError()}
            style="${this._isImageLoading || this._imageLoadError ? 'display: none;' : ''}"
          >
        </div>
      `;
    } 
    else if (this.role === 'assistant' || this.role === 'system' || this.role === 'error') {
      contentBlock = unsafeHTML(marked.parse(this.messageContent || '', { gfm: true, breaks: true }) as string);
    } else { // user role (always text for now)
      const tempDiv = document.createElement('div');
      tempDiv.textContent = this.messageContent;
      contentBlock = unsafeHTML(tempDiv.innerHTML.replace(/\n/g, '<br>'));
    }

    return html`
      <div class="chat-entry ${this.role}">
        <div class="message-bubble ${this.role}" id=${this.messageId || ''}>
          <div class="message-content">
            ${contentBlock}
          </div>
          ${this.role === 'assistant' && this.outputType !== 'loading' && this.outputType !== 'image' && this.messageContent !== '...' && this.onCopy ? html`
            <button class="copy-button" @click=${this._handleCopy} title="Copy Q&A">
              ${this._isCopied ? '✔️' : '📋'}
            </button>
          ` : ''}
        </div>
        ${this.modelUsed && this.outputType !== 'loading' && this.messageContent !== '...' ? html`
          <div class="model-label-outside">
            Model: ${this.modelUsed}
            ${this.personaUsedName ? ` (Persona: ${this.personaUsedName})` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-message-component': ChatMessageComponent;
  }
}
