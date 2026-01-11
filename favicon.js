const faviconCanvas = document.createElement('canvas');
faviconCanvas.width = 64;
faviconCanvas.height = 64;
const faviconCtx = faviconCanvas.getContext('2d');
const faviconLink = document.querySelector("link[rel*='icon']") || document.createElement('link');
faviconLink.type = 'image/x-icon';
faviconLink.rel = 'shortcut icon';
document.getElementsByTagName('head')[0].appendChild(faviconLink);

// Start Loop
setInterval(() => {
    // 1. Clear
    faviconCtx.clearRect(0, 0, 64, 64);

    faviconCtx.save();

    // 2. Rounded Clip
    faviconCtx.beginPath();
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

    // 3. Fill Yellow (More vibrant than beige)
    faviconCtx.fillStyle = '#F4D03F';
    faviconCtx.fillRect(0, 0, 64, 64);

    // 4. Draw 'N'
    faviconCtx.fillStyle = 'black';
    faviconCtx.textAlign = 'center';
    faviconCtx.textBaseline = 'middle';

    let font = fonts[fontIndex];
    fontIndex = (fontIndex + 1) % fonts.length;

    faviconCtx.font = `bold 40px "${font}"`;
    faviconCtx.fillText('N', 32, 34);

    // 5. Update Link
    faviconLink.href = faviconCanvas.toDataURL('image/png');

    faviconCtx.restore();
}, 1000);
