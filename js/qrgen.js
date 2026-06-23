/* =========================================================
   EMS Stock Manager — qrgen.js
   QR Code generation per inventory item
   ========================================================= */

/* ── Generate QR Code into a container element ── */
export function generateQR(containerId, text, options = {}) {
  const container = typeof containerId === 'string'
    ? document.getElementById(containerId)
    : containerId;
  if (!container) return;

  container.innerHTML = '';

  if (window.QRCode) {
    new QRCode(container, {
      text:          text,
      width:         options.size || 160,
      height:        options.size || 160,
      colorDark:     options.dark  || '#0D2844',
      colorLight:    options.light || '#FFFFFF',
      correctLevel:  QRCode.CorrectLevel.M,
    });
  } else {
    container.innerHTML = `<div style="padding:16px;color:#9E9E9E;font-size:12px;text-align:center;">QR Code<br>${text}</div>`;
  }
}

/* ── Generate and return as data URL ── */
export function generateQRDataUrl(text, size = 200) {
  return new Promise((resolve, reject) => {
    if (!window.QRCode) {
      reject(new Error('QRCode library not loaded'));
      return;
    }
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    document.body.appendChild(div);

    new QRCode(div, {
      text,
      width:        size,
      height:       size,
      colorDark:    '#0D2844',
      colorLight:   '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H,
    });

    setTimeout(() => {
      const canvas = div.querySelector('canvas');
      const img    = div.querySelector('img');
      let dataUrl  = '';
      if (canvas) dataUrl = canvas.toDataURL('image/png');
      else if (img) dataUrl = img.src;
      document.body.removeChild(div);
      resolve(dataUrl);
    }, 200);
  });
}

/* ── Download QR Code as PNG ── */
export async function downloadQR(text, filename) {
  try {
    const dataUrl = await generateQRDataUrl(text, 300);
    const a = document.createElement('a');
    a.href     = dataUrl;
    a.download = filename || `qr-${text}.png`;
    a.click();
  } catch (err) {
    console.error('QR download error:', err);
  }
}

/* ── Print QR Code label ── */
export async function printQRLabel(item) {
  const dataUrl = await generateQRDataUrl(item.qr_code || item.barcode, 200);
  const win = window.open('', '_blank', 'width=400,height=500');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>QR Label - ${item.item_name}</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
        img  { width: 180px; height: 180px; }
        h3   { font-size: 13px; margin: 8px 0 4px; max-width: 200px; margin: 8px auto 4px; }
        p    { font-size: 11px; color: #666; margin: 2px 0; }
        .box { border: 1px solid #ddd; border-radius: 8px; padding: 16px; display: inline-block; }
      </style>
    </head>
    <body onload="window.print();window.close()">
      <div class="box">
        <img src="${dataUrl}" alt="QR Code" />
        <h3>${item.item_name}</h3>
        <p>Barcode: ${item.barcode}</p>
        <p>Location: ${item.location}</p>
        <p>Unit: ${item.unit}</p>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}
