// --- Toast Notification Functionality ---
const toastContainer = document.getElementById('toast-notification-container');

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
    if (!toastContainer) {
        console.error("Toast container not found. Cannot display toast:", message);
        // Fallback to console if container is missing, as alerts are problematic.
        console.log(`Toast (${type}): ${message}`); 
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    // Trigger the animation by adding 'show' class after a brief delay
    // This ensures the element is in the DOM and CSS transitions can apply.
    requestAnimationFrame(() => {
        // Forcing a reflow before adding the class can sometimes help ensure transitions trigger.
        // toast.offsetHeight; // NOSONAR: This is a trick to force reflow, not always needed.
        toast.classList.add('show');
    });

    // Set a timeout to start the fade-out process
    setTimeout(() => {
        toast.classList.remove('show');
        // Remove the element from DOM after the fade-out animation completes
        toast.addEventListener('transitionend', () => {
            if (toast.parentNode) { 
                toast.remove();
            }
        }, { once: true }); // Ensure listener is removed after firing once

        // Fallback removal in case transitionend doesn't fire (e.g., if display:none is used or no transition)
        // Make this timeout slightly longer than the transition duration.
        // Assuming a 0.3s transition (300ms) from CSS, add a buffer.
        setTimeout(() => {
             if (toast.parentNode) toast.remove();
        }, duration + 500); // duration of visibility + animation_out_duration + buffer
    }, duration);
}
