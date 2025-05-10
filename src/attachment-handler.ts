import { showToast } from './toast-notifications';
import { 
    messageInput,
    attachFileButton, 
    selectedAttachmentDisplay 
} from './ui-elements';

// State variables for attachment handling, scoped to this module
let currentSelectedFileInfo: { originalPath: string; name: string; type: string; size: number } | null = null;
let isAttachmentContextCommitted: boolean = false; // NEW: Tracks if the current attachment's context has been sent to LLM

function displaySelectedAttachment() {
    if (selectedAttachmentDisplay && currentSelectedFileInfo) {
        selectedAttachmentDisplay.innerHTML = `
            <span>${currentSelectedFileInfo.name} (${(currentSelectedFileInfo.size / 1024).toFixed(2)} KB)</span>
            <button class="clear-attachment-button" title="Clear Attachment">❌</button>
        `;
        selectedAttachmentDisplay.style.display = 'flex';
        const clearButton = selectedAttachmentDisplay.querySelector('.clear-attachment-button');
        if (clearButton) {
            clearButton.removeEventListener('click', clearAttachmentSelection); // Prevent duplicates
            clearButton.addEventListener('click', clearAttachmentSelection);
        }
    } else if (selectedAttachmentDisplay) {
        selectedAttachmentDisplay.innerHTML = '';
        selectedAttachmentDisplay.style.display = 'none';
    }
}

export function clearAttachmentSelection() {
    currentSelectedFileInfo = null;
    isAttachmentContextCommitted = false; // Reset commit status
    if (messageInput) { 
        messageInput.focus();
    }
    displaySelectedAttachment(); 
}

export async function handleAttachFile() {
    if (!window.electronAPI || !window.electronAPI.selectFile) {
        showToast("Attachment feature is not available.", "error");
        console.error("AttachmentHandler: window.electronAPI.selectFile is not defined.");
        return;
    }
    try {
        // Allow replacing an existing attachment.
        // If a new file is selected, it will overwrite currentSelectedFileInfo and reset commit status.
        const fileInfo = await window.electronAPI.selectFile();
        if (fileInfo) {
            const allowedTypes = ['.txt', '.html', '.htm', '.md'];
            const fileExtension = fileInfo.type.toLowerCase();
            
            if (!allowedTypes.includes(fileExtension)) {
                showToast(`Unsupported file type: ${fileInfo.name}. Please select a TXT, HTML, or MD file.`, "error");
                return;
            }
            currentSelectedFileInfo = fileInfo;
            isAttachmentContextCommitted = false; // New file, so context is not yet committed
            displaySelectedAttachment();
        }
    } catch (error) {
        console.error("AttachmentHandler: Error selecting file via IPC:", error);
        showToast("Error selecting file. See console for details.", "error");
        // Ensure state is clean if error occurs during selection
        currentSelectedFileInfo = null;
        isAttachmentContextCommitted = false;
        displaySelectedAttachment();
    }
}

export function getCurrentAttachmentInfo(): { originalPath: string; name: string; type: string; size: number } | null {
    return currentSelectedFileInfo;
}

export function isCurrentAttachmentContextCommitted(): boolean {
    return isAttachmentContextCommitted;
}

export function markCurrentAttachmentContextAsCommitted() {
    if (currentSelectedFileInfo) { // Only mark as committed if there's an active file
        isAttachmentContextCommitted = true;
    }
}

export function setupAttachFileButtonListener() {
    if (attachFileButton) {
        attachFileButton.addEventListener('click', handleAttachFile);
    }
}
