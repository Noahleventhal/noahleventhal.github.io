const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let particlesArray;

// SLIDER CONTROLS
const radiusSlider = document.getElementById('radiusRange');
const strengthSlider = document.getElementById('strengthRange');
const densitySlider = document.getElementById('densityRange');
const speedSlider = document.getElementById('speedRange');
const linkSlider = document.getElementById('linkRange');
const filterSlider = document.getElementById('depthRange');
const frictionSlider = document.getElementById('frictionRange');
const lightRadiusSlider = document.getElementById('lightRadiusRange');
const lightBoostSlider = document.getElementById('lightBoostRange');
const resetBtn = document.getElementById('resetBtn');

// UI Visibility Elements
const controlsPanel = document.querySelector('.controls');
const toggleBtn = document.getElementById('toggleControls');


// LABELS
const radiusLabel = document.getElementById('radiusValue');
const strengthLabel = document.getElementById('strengthValue');
const densityLabel = document.getElementById('densityValue');
const speedLabel = document.getElementById('speedValue');
const linkLabel = document.getElementById('linkValue');
const filterLabel = document.getElementById('depthValue');
const frictionLabel = document.getElementById('frictionValue');
const lightRadiusLabel = document.getElementById('lightRadiusValue');
const lightBoostLabel = document.getElementById('lightBoostValue');


function updateLabels() {
    radiusLabel.innerText = radiusSlider.value + 'px';
    strengthLabel.innerText = strengthSlider.value;
    densityLabel.innerText = densitySlider.value;
    speedLabel.innerText = speedSlider.value + 'x';
    linkLabel.innerText = linkSlider.value + 'px';
    filterLabel.innerText = filterSlider.value;
    frictionLabel.innerText = frictionSlider.value;
    lightRadiusLabel.innerText = lightRadiusSlider.value + 'px';
    lightBoostLabel.innerText = lightBoostSlider.value;
}

radiusSlider.addEventListener('input', updateLabels);
strengthSlider.addEventListener('input', updateLabels);
speedSlider.addEventListener('input', updateLabels);
linkSlider.addEventListener('input', updateLabels);
filterSlider.addEventListener('input', updateLabels);
frictionSlider.addEventListener('input', updateLabels);
lightRadiusSlider.addEventListener('input', updateLabels);
lightBoostSlider.addEventListener('input', updateLabels);

densitySlider.addEventListener('input', function () {
    updateLabels();
    init();
});

// RESET LOGIC (Updated Defaults)
resetBtn.addEventListener('click', function () {
    radiusSlider.value = 100;
    strengthSlider.value = 0.15;
    densitySlider.value = 3.5;
    speedSlider.value = 1.0;
    linkSlider.value = 125;
    filterSlider.value = 1.0;

    // Updated Light Defaults
    lightRadiusSlider.value = 500;
    lightBoostSlider.value = 0.05;

    frictionSlider.value = 0.940;

    updateLabels();
    init();
});

// TOGGLE SETTINGS LOGIC
toggleBtn.addEventListener('click', function () {
    controlsPanel.classList.toggle('hidden');

    if (controlsPanel.classList.contains('hidden')) {
        toggleBtn.innerText = 'Show Settings';
    } else {
        toggleBtn.innerText = 'Hide Settings';
    }
});


updateLabels();

let mouse = {
    x: undefined,
    y: undefined,
    lastX: undefined,
    lastY: undefined,
    speed: 0,
    radius: (canvas.height / 100) * (canvas.width / 100)
}

window.addEventListener('mousemove',
    function (event) {
        if (mouse.lastX !== undefined) {
            let dx = event.x - mouse.lastX;
            let dy = event.y - mouse.lastY;
            mouse.speed = Math.sqrt(dx * dx + dy * dy);
        }
        mouse.lastX = event.x;
        mouse.lastY = event.y;
        mouse.x = event.x;
        mouse.y = event.y;
    }
);




class Particle {
    constructor(x, y, directionX, directionY, size, color) {
        this.x = x;
        this.y = y;
        this.z = Math.random();

        this.baseSize = size;
        this.baseDirectionX = directionX;
        this.baseDirectionY = directionY;

        this.directionX = directionX;
        this.directionY = directionY;

        this.color = color;
        this.pushX = 0;
        this.pushY = 0;
        this.friction = 0.95;

        this.rangeOffset = (Math.random() * 60) - 30;
    }

    draw() {
        ctx.beginPath();

        let depthStrength = parseFloat(filterSlider.value);
        let zDev = this.z - 0.5;

        let scaleFactor = 1.0 + (zDev * depthStrength * 1.5);
        if (scaleFactor < 0.1) scaleFactor = 0.1;

        let currentSize = this.baseSize * scaleFactor;

        ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2, false);

        // --- LOGIC ---
        let opacity = 0.6 + (zDev * 0.8 * depthStrength);

        let dx = this.x - mouse.x;
        let dy = this.y - mouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        let lightR = parseInt(lightRadiusSlider.value);
        let lightBoost = parseFloat(lightBoostSlider.value);

        let r = 148, g = 163, b = 184;

        if (mouse.x !== undefined && dist < lightR) {
            let normalizeDist = dist / lightR;
            let intensity = Math.pow(1 - normalizeDist, 2);

            r = r + (255 - r) * (intensity * 0.8);
            g = g + (255 - g) * (intensity * 0.8);
            b = b + (255 - b) * (intensity * 0.8);

            opacity += intensity * lightBoost;
        }

        if (opacity < 0.1) opacity = 0.1;
        if (opacity > 1) opacity = 1;

        ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${opacity})`;
        ctx.fill();
    }

    update() {
        if (this.x > canvas.width) this.x = 0;
        else if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        else if (this.y < 0) this.y = canvas.height;

        let dx = this.x - mouse.x;
        let dy = this.y - mouse.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        let effectiveRadius = parseInt(radiusSlider.value);

        if (distance < (effectiveRadius + this.rangeOffset) + this.baseSize) {
            if (mouse.speed > 0.1) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (effectiveRadius - distance) / effectiveRadius;

                let strengthMult = parseFloat(strengthSlider.value);
                let dynamicStrength = mouse.speed * strengthMult;
                if (dynamicStrength > 4) dynamicStrength = 4;

                let depthStrength = parseFloat(filterSlider.value);
                let zDev = this.z - 0.5;
                let scaleFactor = 1.0 + (zDev * depthStrength * 1.5);

                this.pushX += forceDirectionX * force * dynamicStrength * scaleFactor;
                this.pushY += forceDirectionY * force * dynamicStrength * scaleFactor;
            }
        }

        let globalSpeed = parseFloat(speedSlider.value);
        let depthStrength = parseFloat(filterSlider.value);
        let zDev = this.z - 0.5;
        let speedFactor = 1.0 + (zDev * depthStrength * 1.2);

        this.directionX = this.baseDirectionX * speedFactor * globalSpeed;
        this.directionY = this.baseDirectionY * speedFactor * globalSpeed;

        this.x += (this.directionX + this.pushX);
        this.y += (this.directionY + this.pushY);

        let currentFriction = parseFloat(frictionSlider.value);
        this.pushX *= currentFriction;
        this.pushY *= currentFriction;

        this.draw();
    }
}

function init() {
    particlesArray = [];
    let densityMult = parseFloat(densitySlider.value);
    let numberOfParticles = ((canvas.height * canvas.width) / 10000) * densityMult;

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

function connect() {
    let opacityValue = 1;
    let linkRange = parseInt(linkSlider.value);
    let linkRangeSq = linkRange * linkRange;
    let depthStrength = parseFloat(filterSlider.value);

    let lightR = parseInt(lightRadiusSlider.value);
    let lightRsq = lightR * lightR;
    let lightBoost = parseFloat(lightBoostSlider.value);

    for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a; b < particlesArray.length; b++) {
            let dx = particlesArray[a].x - particlesArray[b].x;
            let dy = particlesArray[a].y - particlesArray[b].y;
            let distanceSq = dx * dx + dy * dy;

            if (distanceSq < linkRangeSq) {
                opacityValue = 1 - (distanceSq / linkRangeSq);
                if (opacityValue < 0) opacityValue = 0;

                let compositeZ = (particlesArray[a].z + particlesArray[b].z) / 2;
                let zDev = compositeZ - 0.5;
                let opacityFactor = 1.0 + (zDev * depthStrength * 1.5);
                if (opacityFactor < 0.2) opacityFactor = 0.2;

                let lineOpacity = (opacityValue * 0.15) * opacityFactor;

                if (mouse.x !== undefined) {
                    let midX = (particlesArray[a].x + particlesArray[b].x) / 2;
                    let midY = (particlesArray[a].y + particlesArray[b].y) / 2;
                    let mdx = midX - mouse.x;
                    let mdy = midY - mouse.y;
                    let mDistSq = mdx * mdx + mdy * mdy;

                    if (mDistSq < lightRsq) {
                        let mDist = Math.sqrt(mDistSq);
                        let normalizeDist = mDist / lightR;
                        let intensity = Math.pow(1 - normalizeDist, 2);

                        lineOpacity += intensity * lightBoost;
                    }
                }

                if (lineOpacity > 1) lineOpacity = 1;

                ctx.strokeStyle = 'rgba(148, 163, 184,' + lineOpacity + ')';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                ctx.stroke();
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    mouse.speed *= 0.8;
    if (mouse.speed < 0.1) mouse.speed = 0;

    for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
    }
    connect();
}

window.addEventListener('resize', function () {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    init();
});

window.addEventListener('mouseout', function () {
    mouse.x = undefined;
    mouse.y = undefined;
    mouse.speed = 0;
});

init();
animate();
