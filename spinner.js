const descriptors = [
    "Organizer", "Builder", "Optimizer", "Problem-solver", "Spreadsheet nerd",
    "Tinkerer", "Planner", "Puzzle guy", "Efficiency chaser", "Pattern spotter",
    "List maker", "Framework builder"
];

const things = [
    "data dashboards", "web apps", "optimization models", "systems that run well",
    "simple tools", "clean spreadsheets", "data projects", "process improvements",
    "multiplayer games", "spreadsheet tools", "project budgets", "data trackers",
    "prototypes", "little experiments"
];

document.addEventListener('DOMContentLoaded', () => {
    initSpinner('spinner-descriptors', descriptors, 3500, 0);
    initSpinner('spinner-things', things, 3500, 300);
});

function initSpinner(elementId, items, intervalTime, delay) {
    const container = document.getElementById(elementId);
    if (!container) return;

    // Buffer x3 on each side
    // Shuffle logic to ensure randomness on load
    const shuffle = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    // Shuffle the base items once, then repeat that sequence
    const uniqueOrder = shuffle(items);

    const renderItems = [...uniqueOrder, ...uniqueOrder, ...uniqueOrder, ...uniqueOrder, ...uniqueOrder, ...uniqueOrder, ...uniqueOrder];

    container.innerHTML = '';
    renderItems.forEach(text => {
        const el = document.createElement('div');
        el.className = 'spinner-item';
        el.textContent = text;
        container.appendChild(el);
    });

    setTimeout(() => {
        let itemHeight = 50;
        const first = container.querySelector('.spinner-item');
        if (first) itemHeight = first.offsetHeight;

        // Start in middle
        let currentIndex = items.length * 3;
        container.scrollTop = currentIndex * itemHeight;

        let isAnimating = false;
        let isUserInteract = false;
        let intervalId = null;
        let rafId = null;
        let interactionTimer = null;

        // Custom Easing: Cubic In-Out
        // t is 0-1
        const ease = (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

        const updateActive = () => {
            const center = container.scrollTop + (container.clientHeight / 2);
            const index = Math.floor(center / itemHeight);
            Array.from(container.children).forEach((c, i) => {
                if (i === index) c.classList.add('active');
                else c.classList.remove('active');
            });
        };

        const animateTo = (targetY, duration) => {
            if (isUserInteract) return;
            isAnimating = true;

            const startY = container.scrollTop;
            const dist = targetY - startY;
            let startT = null;

            const loop = (now) => {
                if (isUserInteract) {
                    isAnimating = false;
                    return;
                }
                if (!startT) startT = now;
                const elapsed = now - startT;
                const p = Math.min(elapsed / duration, 1);

                container.scrollTop = startY + (dist * ease(p));
                updateActive();

                if (p < 1) {
                    rafId = requestAnimationFrame(loop);
                } else {
                    isAnimating = false;
                }
            };
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(loop);
        };

        const nextSlide = () => {
            if (isUserInteract || isAnimating) return;

            // Infinite loop jump protection
            const maxIdx = items.length * 5;
            const minIdx = items.length * 2;

            if (currentIndex >= maxIdx) {
                currentIndex = items.length * 3;
                container.scrollTop = currentIndex * itemHeight;
            } else if (currentIndex <= minIdx) {
                currentIndex = items.length * 3;
                container.scrollTop = currentIndex * itemHeight;
            }

            currentIndex++;
            animateTo(currentIndex * itemHeight, 2000); // 2s transition (slow & elegant)
        };

        updateActive();

        setTimeout(() => {
            intervalId = setInterval(nextSlide, intervalTime);
        }, delay);


        // Interaction
        const onInteract = () => {
            isUserInteract = true;
            isAnimating = false;
            cancelAnimationFrame(rafId);
            clearInterval(intervalId);
            clearTimeout(interactionTimer);

            container.style.scrollBehavior = 'auto';

            // Constantly update active while dragging
            let dragLoop;
            const dragTick = () => {
                if (isUserInteract) {
                    updateActive();
                    dragLoop = requestAnimationFrame(dragTick);
                }
            };
            dragLoop = requestAnimationFrame(dragTick);

            interactionTimer = setTimeout(() => {
                isUserInteract = false;
                cancelAnimationFrame(dragLoop);

                // Snap
                currentIndex = Math.round(container.scrollTop / itemHeight);
                container.scrollTo({
                    top: currentIndex * itemHeight,
                    behavior: 'smooth'
                });

                // Restart
                setTimeout(() => {
                    updateActive();
                    intervalId = setInterval(nextSlide, intervalTime);
                }, 1000);

            }, 800);
        };

        container.addEventListener('scroll', () => {
            if (isUserInteract) updateActive();
        }, { passive: true });

        container.addEventListener('touchstart', onInteract, { passive: true });
        container.addEventListener('wheel', onInteract, { passive: true });
        container.addEventListener('mousedown', onInteract);

    }, 200);
}
