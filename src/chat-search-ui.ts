import type { ChatSessionMetadata } from './preload'; // Import type from preload

let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Sets up the chat search input field listeners.
 * @param searchInput The HTML input element for chat search.
 * @param onSearchResults A callback function to be invoked with search results (or null if search is cleared).
 *                        The callback will receive an array of ChatSessionMetadata or null.
 */
export function setupChatSearch(
    searchInput: HTMLInputElement, 
    onSearchResults: (results: ChatSessionMetadata[] | null) => void
): void {
    if (!searchInput) {
        console.warn("ChatSearchUI: Search input element not provided.");
        return;
    }

    searchInput.addEventListener('input', () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
            const searchTerm = searchInput.value.trim();
            console.log(`ChatSearchUI: Debounced search for: "${searchTerm}"`);

            if (!searchTerm) {
                onSearchResults(null); // Pass null to indicate clearing search / show all
                return;
            }

            try {
                const results = await window.electronAPI.searchChats(searchTerm);
                console.log(`ChatSearchUI: Received ${results.length} results from main process.`);
                onSearchResults(results);
            } catch (error) {
                console.error("ChatSearchUI: Error calling searchChats IPC:", error);
                // Optionally, notify the user via toast or a message in the UI
                // For now, just clear results or show an error state via the callback if desired
                onSearchResults([]); // Pass empty array on error, or handle differently
            }
        }, 300); // 300ms debounce time
    });

    console.log("ChatSearchUI: Chat search listeners initialized.");
}
