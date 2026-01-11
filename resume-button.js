document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('.resume-button');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
        // e.preventDefault(); // Don't prevent default, we want the download to happen!

        // Remove class if it exists to restart animation
        btn.classList.remove('downloading');

        // Force Reflow
        void btn.offsetWidth;

        // Add class
        btn.classList.add('downloading');

        // Optional: Remove class after animation ends to allow re-clicking
        setTimeout(() => {
            btn.classList.remove('downloading');
        }, 1000);
    });
});
