const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray = [];
let flowField;
let rows, cols;
let flowScale = 0.1; // Base internal scale

// Controls
const zoomSlider = document.getElementById('zoomRange');
const speedSlider = document.getElementById('speedRange');
const countSlider = document.getElementById('countRange');
const trailSlider = document.getElementById('trailRange');
const colorSlider = document.getElementById('colorRange');
const toggleBtn = document.getElementById('toggleControls');
const controlsPanel = document.querySelector('.controls');

// Labels
const zoomLabel = document.getElementById('zoomValue');
const speedLabel = document.getElementById('speedValue');
const countLabel = document.getElementById('countValue');

function updateLabels() {
    zoomLabel.innerText = zoomSlider.value;
    speedLabel.innerText = speedSlider.value;
    countLabel.innerText = countSlider.value;
}

zoomSlider.addEventListener('input', updateLabels);
speedSlider.addEventListener('input', updateLabels);
countSlider.addEventListener('change', function () { updateLabels(); init(); }); // Re-init on count change
trailSlider.addEventListener('input', updateLabels);
colorSlider.addEventListener('input', updateLabels);

toggleBtn.addEventListener('click', function () {
    controlsPanel.classList.toggle('hidden');
    toggleBtn.innerText = controlsPanel.classList.contains('hidden') ? 'Show Settings' : 'Hide Settings';
});

let mouse = {
    x: undefined,
    y: undefined,
    radius: 200
}

window.addEventListener('mousemove', function (e) {
    mouse.x = e.x;
    mouse.y = e.y;
});

window.addEventListener('mouseout', function () {
    mouse.x = undefined;
    mouse.y = undefined;
});

class Particle {
    constructor(effect) {
        this.effect = effect;
        this.x = Math.floor(Math.random() * canvas.width);
        this.y = Math.floor(Math.random() * canvas.height);
        this.speedX = 0;
        this.speedY = 0;
        this.speedModifier = Math.floor(Math.random() * 3 + 1);
        this.history = [{ x: this.x, y: this.y }];
        this.maxLength = Math.floor(Math.random() * 10 + 5);
        this.angle = 0;
        this.color = this.getRandomColor();
    }

    getRandomColor() {
        // Neon tech colors
        const colors = ['#2dd4bf', '#0ea5e9', '#6366f1', '#a855f7'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    update() {
        let zoom = parseFloat(zoomSlider.value);
        let globalSpeed = parseFloat(speedSlider.value);

        // FLOW FIELD
        // Simple Trigonometric Flow: Angle = (cos(x) + sin(y))
        // Scale coords down
        let xScaled = this.x * 0.005 * zoom;
        let yScaled = this.y * 0.005 * zoom;

        this.angle = (Math.cos(xScaled) + Math.sin(yScaled)) * Math.PI * 2;

        // MOUSE INTERACTION (Disturbance)
        if (mouse.x !== undefined) {
            let dx = this.x - mouse.x;
            let dy = this.y - mouse.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouse.radius) {
                // Push angle away from mouse
                let angleToMouse = Math.atan2(dy, dx);
                this.angle = angleToMouse;
            }
        }

        this.speedX = Math.cos(this.angle);
        this.speedY = Math.sin(this.angle);

        this.x += this.speedX * this.speedModifier * globalSpeed;
        this.y += this.speedY * this.speedModifier * globalSpeed;

        this.history.push({ x: this.x, y: this.y });
        if (this.history.length > this.maxLength) {
            this.history.shift();
        }

        // WRAP AROUND
        if (this.x > canvas.width || this.x < 0 || this.y > canvas.height || this.y < 0) {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.history = [];
        }
    }

    draw() {
        // Color Mode
        let mode = parseInt(colorSlider.value);

        ctx.beginPath();
        if (this.history.length > 0) {
            ctx.moveTo(this.history[0].x, this.history[0].y);
            for (let i = 0; i < this.history.length; i++) {
                ctx.lineTo(this.history[i].x, this.history[i].y);
            }
        }

        if (mode === 0) {
            // Velocity Color (Blue -> Teal)
            ctx.strokeStyle = `hsl(${180 + this.speedModifier * 20}, 70%, 50%)`;
        } else {
            // Neon Palette
            ctx.strokeStyle = this.color;
        }

        ctx.lineWidth = 1; // Delicate lines
        ctx.stroke();
    }
}

function init() {
    particlesArray = [];
    let count = parseInt(countSlider.value);
    for (let i = 0; i < count; i++) {
        particlesArray.push(new Particle());
    }
}

function animate() {
    requestAnimationFrame(animate);

    // TRAIL FADE EFFECT
    // Instead of clearRect, we draw a semi-transparent rectangle
    // Trail Value: 0 (No Fade/Solid) to 2 (Fast Fade)
    // Actually we want trail length to mean:
    // Short = High Opacity Rect (clears fast)
    // Long = Low Opacity Rect (clears slow)

    let trailSetting = parseInt(trailSlider.value);
    // 0 = Short (0.2 alpha)
    // 1 = Medium (0.1 alpha)
    // 2 = Long (0.05 alpha)
    let alpha = 0.2;
    if (trailSetting === 1) alpha = 0.1;
    if (trailSetting === 2) alpha = 0.05;

    ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`; // Start Slate-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // DRAW PARTICLES
    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
        particlesArray[i].draw();
    }
}

window.addEventListener('resize', function () {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    init();
});

init();
animate();
