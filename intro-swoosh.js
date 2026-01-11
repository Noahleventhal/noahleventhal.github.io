document.addEventListener('DOMContentLoaded', () => {
    const h1 = document.querySelector('.container h1');
    if (!h1) return;

    // Create SVG namespace
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");

    // Exact positioning to cover H1
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.zIndex = '-1';
    svg.style.overflow = 'visible';
    svg.style.pointerEvents = 'none';

    // Definitions for Gradient
    const defs = document.createElementNS(ns, "defs");
    const gradient = document.createElementNS(ns, "linearGradient");
    gradient.setAttribute("id", "swooshGradient");
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "100%");
    gradient.setAttribute("y2", "0%"); // Horizontal gradient flow

    // Stop 1: Bright Cyan/Teal
    const stop1 = document.createElementNS(ns, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "#22d3ee"); // Cyan-400

    // Stop 2: Vibrant Violet
    const stop2 = document.createElementNS(ns, "stop");
    stop2.setAttribute("offset", "50%");
    stop2.setAttribute("stop-color", "#a855f7"); // Purple-500

    // Stop 3: Hot Pink
    const stop3 = document.createElementNS(ns, "stop");
    stop3.setAttribute("offset", "100%");
    stop3.setAttribute("stop-color", "#f472b6"); // Pink-400

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    const path = document.createElementNS(ns, "path");

    // Stretch to fill container
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    // The "Cool Z Swoosh" path
    const d = `
        M -5 95 
        C 30 95, 20 10, 50 20 
        C 40 90, 50 100, 105 40
    `;

    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "url(#swooshGradient)");
    path.setAttribute("stroke-width", "14");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    svg.appendChild(path);
    h1.appendChild(svg);

    // Animation: Draw Stroke
    const totalLength = path.getTotalLength();
    path.style.strokeDasharray = totalLength;
    path.style.strokeDashoffset = totalLength;

    path.getBoundingClientRect();

    path.style.transition = "stroke-dashoffset 1.5s cubic-bezier(0.25, 1, 0.5, 1)";

    setTimeout(() => {
        path.style.strokeDashoffset = '0';
    }, 500);
});
