const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray;

// Get mouse position & velocity
let mouse = {
    x: undefined,
    y: undefined,
    lastX: undefined,
    lastY: undefined,
    speed: 0,
    radius: (canvas.height / 140) * (canvas.width / 140) // Much smaller radius
}

window.addEventListener('mousemove',
    function (event) {
        if (mouse.lastX !== undefined) {
            let dx = event.x - mouse.lastX;
            let dy = event.y - mouse.lastY;
            // Calculate speed (distance moved)
            mouse.speed = Math.sqrt(dx * dx + dy * dy);
        }
        mouse.lastX = event.x;
        mouse.lastY = event.y;
        mouse.x = event.x;
        mouse.y = event.y;
    }
);

// Create particle
class Particle {
    constructor(x, y, directionX, directionY, size, color) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;

        // Momentum properties
        this.pushX = 0;
        this.pushY = 0;
        this.friction = 0.95;

        // Variance for forcefield interaction
        this.rangeOffset = (Math.random() * 60) - 30; // +/- 30px variation
    }
    // Method to draw individual particle
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        // Slate-400 equivalent for particles
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.fill();
    }
    // Check particle position, check mouse position, move the particle, draw the particle
    update() {
        // WRAP AROUND
        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;

        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;

        // Check collision detection - mouse position / particle position
        let dx = this.x - mouse.x;
        let dy = this.y - mouse.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        // DYNAMIC PHYSICS Interaction
        // Only push if within range...
        if (distance < (mouse.radius + this.rangeOffset) + this.size) {

            // ...AND if the mouse is moving!
            if (mouse.speed > 0.1) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (mouse.radius - distance) / mouse.radius;

                // Strength depends on mouse SPEED now
                // Even less force at low speeds
                let dynamicStrength = mouse.speed * 0.08;
                if (dynamicStrength > 4) dynamicStrength = 4; // Cap max force

                this.pushX += forceDirectionX * force * dynamicStrength;
                this.pushY += forceDirectionY * force * dynamicStrength;
            }
        }

        // Apply movement
        this.x += (this.directionX + this.pushX);
        this.y += (this.directionY + this.pushY);

        // Decelerate momentum
        this.pushX *= this.friction;
        this.pushY *= this.friction;

        // Draw particle
        this.draw();
    }
}

// Create particle array
function init() {
    particlesArray = [];
    let numberOfParticles = (canvas.height * canvas.width) / 5000;
    for (let i = 0; i < numberOfParticles; i++) {
        let size = (Math.random() * 2) + 1;
        let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
        let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);

        let directionX = (Math.random() * 0.4) - 0.2;
        let directionY = (Math.random() * 0.4) - 0.2;
        let color = '#94a3b8';

        particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
    }
}

// Check if particles are close AND handle separation
function connect() {
    let opacityValue = 1;
    const separationDist = 20;

    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let dx = particlesArray[a].x - particlesArray[b].x;
            let dy = particlesArray[a].y - particlesArray[b].y;
            let distanceSq = dx * dx + dy * dy;

            // Draw lines
            if (distanceSq < (canvas.width / 7) * (canvas.height / 7)) {
                opacityValue = 1 - (distanceSq / 20000);
                if (opacityValue < 0) opacityValue = 0;

                ctx.strokeStyle = 'rgba(148, 163, 184,' + (opacityValue * 0.15) + ')';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }

            // SEPARATION LOGIC (Anti-clumping)
            if (distanceSq < separationDist * separationDist && distanceSq > 0) {
                let distance = Math.sqrt(distanceSq);
                let forceX = dx / distance;
                let forceY = dy / distance;
                let force = 0.05;

                particlesArray[a].pushX += forceX * force;
                particlesArray[a].pushY += forceY * force;
                particlesArray[b].pushX -= forceX * force;
                particlesArray[b].pushY -= forceY * force;
            }
        }
    }
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    // Decay mouse speed rapidly so the effect stops when mouse stops
    mouse.speed *= 0.8;
    if (mouse.speed < 0.1) mouse.speed = 0;

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connect();
}

// Resize event
window.addEventListener('resize',
    function () {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        mouse.radius = ((canvas.height / 80) * (canvas.height / 80));
        init();
    }
);

// Mouse out event
window.addEventListener('mouseout',
    function () {
        mouse.x = undefined;
        mouse.y = undefined;
        mouse.speed = 0;
    }
)

init();
animate();