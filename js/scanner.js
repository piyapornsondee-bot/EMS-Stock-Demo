/* =========================================================
   EMS Stock Manager — scanner.js
   Camera-based QR Code and Barcode scanner using ZXing
   ========================================================= */

let _stream    = null;
let _reader    = null;
let _scanning  = false;
let _onResult  = null;
let _onClose   = null;

/* ── Open scanner ── */
export async function openScanner(onResult, onClose) {
  _onResult = onResult;
  _onClose  = onClose;

  const container = document.getElementById('scanner-container');
  const video     = document.getElementById('scanner-video');
  if (!container || !video) {
    console.error('Scanner DOM elements not found');
    return;
  }

  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.srcObject = _stream;
    await video.play();

    container.classList.add('active');
    _scanning = true;

    // Use ZXing if available
    if (window.ZXing) {
      await startZXingScanner(video);
    } else {
      // Fallback: manual barcode input
      showManualFallback();
    }
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      showManualFallback('ไม่ได้รับอนุญาตใช้กล้อง กรุณาป้อนบาร์โค้ดด้วยตนเอง');
    } else {
      showManualFallback('ไม่สามารถเปิดกล้องได้ กรุณาป้อนบาร์โค้ดด้วยตนเอง');
    }
  }
}

async function startZXingScanner(video) {
  try {
    const hints = new Map();
    const formats = [
      ZXing.BarcodeFormat.QR_CODE,
      ZXing.BarcodeFormat.EAN_13,
      ZXing.BarcodeFormat.EAN_8,
      ZXing.BarcodeFormat.CODE_128,
      ZXing.BarcodeFormat.CODE_39,
      ZXing.BarcodeFormat.DATA_MATRIX,
    ];
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    _reader = new ZXing.BrowserMultiFormatReader(hints);
    await _reader.decodeFromVideoElement(video, (result, err) => {
      if (result && _scanning) {
        const code = result.getText();
        _scanning = false;
        closeScanner();
        if (_onResult) _onResult(code);
      }
    });
  } catch (err) {
    console.warn('ZXing error:', err);
    showManualFallback();
  }
}

/* ── Close scanner ── */
export function closeScanner() {
  _scanning = false;

  if (_reader) {
    try { _reader.reset(); } catch {}
    _reader = null;
  }

  if (_stream) {
    _stream.getTracks().forEach(t => t.stop());
    _stream = null;
  }

  const container = document.getElementById('scanner-container');
  const video     = document.getElementById('scanner-video');
  if (container) container.classList.remove('active');
  if (video)     { video.srcObject = null; video.pause(); }

  // Remove manual overlay if present
  const manual = document.getElementById('scanner-manual-overlay');
  if (manual) manual.remove();

  if (_onClose) _onClose();
}

/* ── Fallback: manual entry ── */
function showManualFallback(message = 'ป้อนบาร์โค้ดหรือ QR Code ด้วยตนเอง') {
  const container = document.getElementById('scanner-container');
  if (!container) return;

  container.classList.add('active');

  const overlay = document.createElement('div');
  overlay.id = 'scanner-manual-overlay';
  overlay.style.cssText = `
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 24px; gap: 16px;
  `;
  overlay.innerHTML = `
    <div style="background:rgba(255,255,255,.1);backdrop-filter:blur(12px);border-radius:16px;padding:32px;max-width:360px;width:100%;text-align:center;">
      <span class="material-symbols-rounded" style="font-size:48px;color:#90CAF9;display:block;margin-bottom:16px;">qr_code_scanner</span>
      <p style="color:white;font-size:14px;margin-bottom:20px;line-height:1.5;">${message}</p>
      <input id="manual-barcode-input" type="text" placeholder="EMS-001 หรือสแกนด้วย Scanner"
        style="width:100%;padding:12px 16px;border-radius:10px;border:none;font-size:16px;outline:none;margin-bottom:12px;"
        autofocus />
      <button id="manual-barcode-ok" style="width:100%;padding:12px;background:#1565C0;color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">
        ยืนยัน
      </button>
    </div>
  `;

  container.appendChild(overlay);

  const input = overlay.querySelector('#manual-barcode-input');
  const okBtn = overlay.querySelector('#manual-barcode-ok');

  const submit = () => {
    const val = input.value.trim();
    if (!val) return;
    closeScanner();
    if (_onResult) _onResult(val);
  };

  okBtn.addEventListener('click', submit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
  });

  // Focus input
  setTimeout(() => input.focus(), 200);
}

/* ── Check camera availability ── */
export async function hasCameraSupport() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(d => d.kind === 'videoinput');
  } catch { return false; }
}
