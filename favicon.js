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
        // 1. Draw Background Tile
        faviconCtx.clearRect(0, 0, 64, 64);
        faviconCtx.drawImage(bgImage, 0, 0, 64, 64);

        // 2. Draw 'N'
        faviconCtx.fillStyle = '#00ff00'; // Green
        faviconCtx.textAlign = 'center';
        faviconCtx.textBaseline = 'middle';

        // Pick font
        let font = fonts[fontIndex];
        fontIndex = (fontIndex + 1) % fonts.length;

        faviconCtx.font = `bold 40px "${font}"`;
        faviconCtx.fillText('N', 32, 34); // Slight vertical offset to center visually

        // 3. Update Favicon
        faviconLink.href = faviconCanvas.toDataURL('image/png');
    }, 1000); // Cycle every second
};
