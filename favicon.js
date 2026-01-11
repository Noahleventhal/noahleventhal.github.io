const faviconCanvas = document.createElement('canvas');
faviconCanvas.width = 64;
faviconCanvas.height = 64;
const faviconCtx = faviconCanvas.getContext('2d');
const faviconLink = document.querySelector("link[rel*='icon']") || document.createElement('link');
faviconLink.type = 'image/x-icon';
faviconLink.rel = 'shortcut icon';
document.getElementsByTagName('head')[0].appendChild(faviconLink);

const fonts = [
    'Inter', 'Times New Roman', 'Courier New', 'Brush Script MT',
    'Copperplate', 'Papyrus', 'Comic Sans MS', 'Impact', 'Georgia',
    'Verdana', 'Arial Black', 'Lucida Console', 'Garamond',
    'Trebuchet MS', 'Palatino', 'Geneva', 'Optima', 'Didot',
    'American Typewriter', 'Andale Mono'
];

let fontIndex = 0;

// Helper for rounded rect
function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Start loop immediately (no image load needed)
setInterval(() => {
    // 1. Clear
    faviconCtx.clearRect(0, 0, 64, 64);

    // 2. Draw Yellow Rounded Background
    faviconCtx.fillStyle = '#FFD700'; // "Bit more yellow" (Goldish yellow)
    // or try #FCD34D (Tailwind yellow-300) for a nice soft yellow
    // Let's go with a nice bright but standard yellow
    faviconCtx.fillStyle = '#FACC15';

    roundedRect(faviconCtx, 0, 0, 64, 64, 24); // Heavy rounding (24px radius on 64px box)
    faviconCtx.fill();

    // 3. Draw 'N'
    faviconCtx.fillStyle = 'black';
    faviconCtx.textAlign = 'center';
    faviconCtx.textBaseline = 'middle';

    // Pick font
    let font = fonts[fontIndex];
    fontIndex = (fontIndex + 1) % fonts.length;

    faviconCtx.font = `bold 40px "${font}"`;
    faviconCtx.fillText('N', 32, 34);

    // 4. Update
    faviconLink.href = faviconCanvas.toDataURL('image/png');
}, 2500);
