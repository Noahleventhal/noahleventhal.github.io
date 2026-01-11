document.addEventListener('DOMContentLoaded', () => {
    const h1 = document.querySelector('.container h1');
    if (!h1) return;

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;

    // Move to BODY to break stacking context isolation
    canvas.style.position = 'fixed'; // Use fixed to match viewport like body
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999'; // On top of everything

    // Multiply Mode on Body:
    // Red * Black BG = Black (Invisible)
    // Red * White Text = Red (Visible)
    canvas.style.mixBlendMode = 'multiply';

    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    let h1Rect;

    const resize = () => {
        // Canvas covers entire screen for simplicity in tracking?
        // Or just the H1 area?
        // Covering screen is safer for alignment if H1 moves logic is simple.
        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    };

    resize();
    window.addEventListener('resize', resize);

    let points = [];
    const trailLength = 15;

    // Track mouse globally or on H1? 
    // Effect should strictly be inside H1, but track everywhere for smoothness?
    // User wants interaction with H1.
    document.addEventListener('mousemove', (e) => {
        // Check collision with H1 for adding points
        h1Rect = h1.getBoundingClientRect();

        const relX = e.clientX - h1Rect.left;
        const relY = e.clientY - h1Rect.top;

        // Only add points if inside H1 rect (loose check, exact verify later)
        if (
            e.clientX >= h1Rect.left &&
            e.clientX <= h1Rect.right &&
            e.clientY >= h1Rect.top &&
            e.clientY <= h1Rect.bottom
        ) {
            points.push({
                x: e.clientX, // Global coordinates for Fixed canvas
                y: e.clientY,
                age: 0
            });
        }
    });

    const animate = () => {
        ctx.clearRect(0, 0, width, height);

        if (points.length > 0) {

            points = points.filter(p => p.age < trailLength);
            points.forEach(p => p.age++);

            if (points.length > 1) {
                ctx.beginPath();
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#000000';

                ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y);
                for (let i = points.length - 2; i >= 0; i--) {
                    const pt = points[i];
                    ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            }
        }

        requestAnimationFrame(animate);
    };

    animate();
});
