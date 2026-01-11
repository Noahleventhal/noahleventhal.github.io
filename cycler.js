const descriptors = [
    "Organizer",
    "Builder",
    "Optimizer",
    "Problem-solver",
    "Spreadsheet nerd",
    "Tinkerer",
    "Planner",
    "Puzzle guy",
    "Efficiency chaser",
    "Pattern spotter",
    "List maker",
    "Framework builder"
];

const things = [
    "data dashboards",
    "web apps",
    "optimization models",
    "systems that run well",
    "simple tools",
    "clean spreadsheets",
    "data projects",
    "process improvements",
    "multiplayer games",
    "spreadsheet tools",
    "project budgets",
    "data trackers",
    "prototypes",
    "little experiments"
];

document.addEventListener('DOMContentLoaded', () => {
    const descriptorEl = document.getElementById('descriptor-text');
    const thingEl = document.getElementById('thing-text');

    // Set initial text
    let descriptorIndex = 0;
    let thingIndex = 0;

    // Update function
    function cycleText() {
        // Fade out
        descriptorEl.classList.remove('visible');
        thingEl.classList.remove('visible');

        setTimeout(() => {
            // Change text
            descriptorIndex = (descriptorIndex + 1) % descriptors.length;
            thingIndex = (thingIndex + 1) % things.length;

            descriptorEl.textContent = descriptors[descriptorIndex];
            thingEl.textContent = things[thingIndex];

            // Fade in
            descriptorEl.classList.add('visible');
            thingEl.classList.add('visible');
        }, 500); // Wait for fade out
    }

    // Initial State
    descriptorEl.textContent = descriptors[0];
    thingEl.textContent = things[0];
    setTimeout(() => {
        descriptorEl.classList.add('visible');
        thingEl.classList.add('visible');
    }, 100);

    // Start loop
    setInterval(cycleText, 3000); // Cycle every 3 seconds
});
