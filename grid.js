const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let points = [];

// Sliders
const spacingSlider = document.getElementById('spacingRange');
const tensionSlider = document.getElementById('tensionRange');
const frictionSlider = document.getElementById('frictionRange');
const forceSlider = document.getElementById('forceRange');
const lightRadiusSlider = document.getElementById('lightRadiusRange');
const lightBoostSlider = document.getElementById('lightBoostRange');
const layoutSlider = document.getElementById('layoutRange');
const resetBtn = document.getElementById('resetBtn');

// Labels
const spacingLabel = document.getElementById('spacingValue');
const tensionLabel = document.getElementById('tensionValue');
const frictionLabel = document.getElementById('frictionValue');
const forceLabel = document.getElementById('forceValue');
const lightRadiusLabel = document.getElementById('lightRadiusValue');
const lightBoostLabel = document.getElementById('lightBoostValue');

// UI Visibility
const controlsPanel = document.querySelector('.controls');
const toggleBtn = document.getElementById('toggleControls');

function updateLabels() {
    spacingLabel.innerText = spacingSlider.value + 'px';
    tensionLabel.innerText = tensionSlider.value;
    frictionLabel.innerText = frictionSlider.value;
    forceLabel.innerText = forceSlider.value;
    lightRadiusLabel.innerText = lightRadiusSlider.value + 'px';
    lightBoostLabel.innerText = lightBoostSlider.value;
}

spacingSlider.addEventListener('input', function () { updateLabels(); init(); });
layoutSlider.addEventListener('input', function () { init(); });
tensionSlider.addEventListener('input', updateLabels);
frictionSlider.addEventListener('input', updateLabels);
forceSlider.addEventListener('input', updateLabels);
lightRadiusSlider.addEventListener('input', updateLabels);
lightBoostSlider.addEventListener('input', updateLabels);

resetBtn.addEventListener('click', function () {
    spacingSlider.value = 25;
    tensionSlider.value = 0.15;
    frictionSlider.value = 0.80;
    forceSlider.value = 10;
    lightRadiusSlider.value = 388;
    lightBoostSlider.value = 0.24;
    layoutSlider.value = 0;
    updateLabels();
    init();
});

toggleBtn.addEventListener('click', function () {
    controlsPanel.classList.toggle('hidden');
    if (controlsPanel.classList.contains('hidden')) toggleBtn.innerText = 'Show Settings';
    else toggleBtn.innerText = 'Hide Settings';
});

let mouse = {
    x: undefined,
    y: undefined,
    radius: 150
}

window.addEventListener('mousemove', function (event) {
    mouse.x = event.x;
    mouse.y = event.y;
});

window.addEventListener('mouseout', function () {
    mouse.x = undefined;
    mouse.y = undefined;
});

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.originX = x;
        this.originY = y;
        this.vx = 0;
        this.vy = 0;
    }

    update() {
        // Physics Params from Sliders
        let friction = parseFloat(frictionSlider.value);
        let tension = parseFloat(tensionSlider.value);
        let maxPush = parseInt(forceSlider.value);

        // 1. Mouse Repulsion
        if (mouse.x !== undefined) {
            let dx = this.x - mouse.x;
            let dy = this.y - mouse.y;
            let dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < mouse.radius) {
                const forceDirectionX = dx / dist;
                const forceDirectionY = dy / dist;
                const force = (mouse.radius - dist) / mouse.radius;

                this.vx += forceDirectionX * force * maxPush * 0.5; // Damping kick
                this.vy += forceDirectionY * force * maxPush * 0.5;
            }
        }

        // 2. Spring Force
        let springX = (this.originX - this.x) * tension;
        let springY = (this.originY - this.y) * tension;

        this.vx += springX;
        this.vy += springY;

        // 3. Friction
        this.vx *= friction;
        this.vy *= friction;

        this.x += this.vx;
        this.y += this.vy;
    }
}

function init() {
    points = [];
    let spacing = parseInt(spacingSlider.value);
    let layout = parseInt(layoutSlider.value); // 0=Square, 1=Tri, 2=Hex

    // --- SQUARE / TRI MESH ---
    if (layout !== 2) {
        for (let y = 0; y < canvas.height + spacing; y += spacing) {
            let row = [];
            let yIndex = Math.round(y / spacing);

            let xOffset = 0;
            if (layout === 1 && yIndex % 2 !== 0) {
                xOffset = spacing / 2;
            }
            for (let x = -spacing; x < canvas.width + spacing; x += spacing) {
                row.push(new Point(x + xOffset, y));
            }
            points.push(row);
        }
    }

    // --- HEX MESH (Sparse Flat-Top) ---
    else {
        let hexHeight = spacing * 0.866;
        let y = -hexHeight;
        let rowIndex = 0;

        while (y < canvas.height + hexHeight * 2) {
            let row = [];
            let x = -spacing;

            let startOffset = (rowIndex % 2 === 0) ? 0 : 1.5 * spacing;
            x = -spacing * 2 + startOffset;

            while (x < canvas.width + spacing * 2) {
                row.push(new Point(x, y));
                row.push(new Point(x + spacing, y));
                x += 3 * spacing;
            }

            points.push(row);
            y += hexHeight;
            rowIndex++;
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    updateLabels();

    let layout = parseInt(layoutSlider.value);

    // Light Params
    let lightRadius = parseInt(lightRadiusSlider.value);
    let lightBoost = parseFloat(lightBoostSlider.value);

    // DRAW GRID
    for (let i = 0; i < points.length; i++) {
        for (let j = 0; j < points[i].length; j++) {
            let p = points[i][j];
            p.update();

            // CHILL LIGHT EFFECT logic using sliders
            let dist = 9999;
            if (mouse.x !== undefined) {
                dist = Math.sqrt((p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2);
            }

            // Base alpha 0.2
            let alpha = 0.2;
            if (dist < lightRadius) {
                // Boost alpha based on proximity
                alpha += (1 - dist / lightRadius) * lightBoost;
            }
            // Clamp alpha
            if (alpha > 1) alpha = 1;

            ctx.strokeStyle = `rgba(45, 212, 191, ${alpha})`;
            if (layout === 2 && dist < 150) ctx.lineWidth = 2;
            else ctx.lineWidth = 1;

            ctx.beginPath();

            // --- SQUARE ---
            if (layout === 0) {
                if (j < points[i].length - 1) { ctx.moveTo(p.x, p.y); ctx.lineTo(points[i][j + 1].x, points[i][j + 1].y); }
                if (i < points.length - 1) { ctx.moveTo(p.x, p.y); ctx.lineTo(points[i + 1][j].x, points[i + 1][j].y); }
            }
            // --- TRI ---
            else if (layout === 1) {
                if (j < points[i].length - 1) { ctx.moveTo(p.x, p.y); ctx.lineTo(points[i][j + 1].x, points[i][j + 1].y); }
                if (i < points.length - 1) {
                    if (i % 2 === 0) {
                        ctx.moveTo(p.x, p.y); ctx.lineTo(points[i + 1][j].x, points[i + 1][j].y);
                        if (j > 0) { ctx.moveTo(p.x, p.y); ctx.lineTo(points[i + 1][j - 1].x, points[i + 1][j - 1].y); }
                    } else {
                        ctx.moveTo(p.x, p.y); ctx.lineTo(points[i + 1][j].x, points[i + 1][j].y);
                        if (j < points[i].length - 1) { ctx.moveTo(p.x, p.y); ctx.lineTo(points[i + 1][j + 1].x, points[i + 1][j + 1].y); }
                    }
                }
            }
            // --- HEX (RIGID) ---
            else if (layout === 2) {
                if (j % 2 === 0 && j < points[i].length - 1) {
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(points[i][j + 1].x, points[i][j + 1].y);
                }
                if (i < points.length - 1) {
                    let nextRow = points[i + 1];
                    if (i % 2 === 0) {
                        if (j > 0 && j - 1 < nextRow.length) { ctx.moveTo(p.x, p.y); ctx.lineTo(nextRow[j - 1].x, nextRow[j - 1].y); }
                    } else {
                        if (j + 1 < nextRow.length) { ctx.moveTo(p.x, p.y); ctx.lineTo(nextRow[j + 1].x, nextRow[j + 1].y); }
                    }
                }
            }

            ctx.stroke();
        }
    }
}

window.addEventListener('resize', function () {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    init();
});

init();
animate();
