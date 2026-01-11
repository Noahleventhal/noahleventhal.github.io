const faviconCanvas = document.createElement('canvas');
faviconCanvas.width = 64;
faviconCanvas.height = 64;
const faviconCtx = faviconCanvas.getContext('2d');
const faviconLink = document.querySelector("link[rel*='icon']") || document.createElement('link');
faviconLink.type = 'image/x-icon';
faviconLink.rel = 'shortcut icon';
document.getElementsByTagName('head')[0].appendChild(faviconLink);

const bgImage = new Image();
bgImage.src = 'favicon-bg.png';

const fonts = [
    'Inter', 'Times New Roman', 'Courier New', 'Brush Script MT',
    'Copperplate', 'Papyrus', 'Comic Sans MS', 'Impact', 'Georgia',
    'Verdana', 'Arial Black', 'Lucida Console', 'Garamond',
    'Trebuchet MS', 'Palatino', 'Geneva', 'Optima', 'Didot',
    'American Typewriter', 'Andale Mono'
];

let fontIndex = 0;

bgImage.onload = function () {
    setInterval(() => {
        // 1. Draw Background Tile with Rounded Corners
        faviconCtx.clearRect(0, 0, 64, 64);

        faviconCtx.save();
        faviconCtx.beginPath();
        // Super rounded corners (Squircle-ish)
        const r = 24;
        faviconCtx.moveTo(r, 0);
        faviconCtx.lineTo(64 - r, 0);
        faviconCtx.quadraticCurveTo(64, 0, 64, r);
        faviconCtx.lineTo(64, 64 - r);
        faviconCtx.quadraticCurveTo(64, 64, 64 - r, 64);
        faviconCtx.lineTo(r, 64);
        faviconCtx.quadraticCurveTo(0, 64, 0, 64 - r);
        faviconCtx.lineTo(0, r);
        faviconCtx.quadraticCurveTo(0, 0, r, 0);
        faviconCtx.closePath();
        faviconCtx.clip();

        faviconCtx.drawImage(bgImage, 0, 0, 64, 64);

        // 2. Draw 'N'
        faviconCtx.fillStyle = 'black';
        faviconCtx.textAlign = 'center';
        faviconCtx.textBaseline = 'middle';

        // Pick font
        let font = fonts[fontIndex];
        fontIndex = (fontIndex + 1) % fonts.length;

        faviconCtx.font = `bold 40px "${font}"`;
        faviconCtx.fillText('N', 32, 34); // Slight vertical offset to center visually

        // 3. Update Favicon
        faviconLink.href = faviconCanvas.toDataURL('image/png');

        faviconCtx.restore();
    }, 1000); // Cycle every second
};
