// ── UNIFIED FILE UPLOAD PIPELINE ─────────────────────────────────────────────
// Every upload in the app routes through processFileForUpload + uploadProcessed.
// Why: iPhone photos are usually HEIC, which Android/Chrome cannot display.
// We normalize ALL images to JPEG on the uploading device (Apple devices can
// decode HEIC natively, so converting at upload is bulletproof for every viewer).
// PDFs convert to JPEG pages (existing behavior). Office files warn.
import { storage, storageRef, uploadBytes, getDownloadURL } from "./firebase";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "heif", "bmp", "tiff", "tif"];
const OFFICE_EXTS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];
const MAX_DIMENSION = 2560; // long-edge cap — keeps field photos crisp but fast to load

function getExt(name) { return ((name || "").split(".").pop() || "").toLowerCase(); }

// Decode any image the device understands (incl. HEIC on Apple devices) and
// re-encode as JPEG. Returns a new File, or null if the device can't decode it.
function normalizeImageToJpeg(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (Math.max(width, height) > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          if (!blob) { resolve(null); return; }
          const newName = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], newName, { type: "image/jpeg" }));
        }, "image/jpeg", 0.9);
      } catch (e) {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function loadPdfJs() {
  if (window.pdfjsLib) return;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; res(); };
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── Smart file processor ─────────────────────────────────────────────────────
// Images (any format) → JPEG. PDFs → JPEG page images. Office files → warn.
// Returns: {file, warn, wasConverted} or {files, multiPage, warn, wasConverted}
export async function processFileForUpload(file) {
  const ext = getExt(file.name);
  const isImage = IMAGE_EXTS.includes(ext) || (file.type || "").startsWith("image/");

  // Images — normalize everything to JPEG (fixes HEIC-on-Android, odd formats, oversized photos)
  if (isImage) {
    // Already a small-ish JPEG/PNG? Still normalize — guarantees correct content type + universal display.
    const jpeg = await normalizeImageToJpeg(file);
    if (jpeg) {
      const wasHeic = ext === "heic" || ext === "heif" || /hei[cf]/.test(file.type || "");
      return { file: jpeg, warn: null, wasConverted: wasHeic };
    }
    // Device couldn't decode (e.g. HEIC picked on a non-Apple device) — upload original but warn.
    if (ext === "heic" || ext === "heif") {
      return { file, warn: `"${file.name}" couldn't be converted on this device and may not display for everyone. If possible, re-take or re-save as JPEG.` };
    }
    return { file, warn: null };
  }

  // PDFs — convert every page to a JPEG image using PDF.js
  if (ext === "pdf" || file.type === "application/pdf") {
    try {
      await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const blobs = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
        const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
        blobs.push(blob);
      }
      if (blobs.length === 1) {
        const imgFile = new File([blobs[0]], file.name.replace(/\.pdf$/i, ".jpg"), { type: "image/jpeg" });
        return { file: imgFile, warn: null, wasConverted: true };
      }
      const imgFiles = blobs.map((b, i) => new File([b], file.name.replace(/\.pdf$/i, `_page${i + 1}.jpg`), { type: "image/jpeg" }));
      return { files: imgFiles, warn: null, wasConverted: true, multiPage: true };
    } catch {
      return { file, warn: null }; // fall through — upload original PDF
    }
  }

  // Office files — warn and upload original
  if (OFFICE_EXTS.includes(ext)) {
    return { file, warn: `"${file.name}" is a ${ext.toUpperCase()} file. For best mobile viewing, save as PDF before uploading. Uploading original.` };
  }

  return { file, warn: null };
}

// ── Upload with explicit content type ────────────────────────────────────────
// pathPrefix e.g. "attachments", "suborders", "fieldnotes", "files", "materials"
export async function uploadProcessed(pathPrefix, file) {
  const fn = `${Date.now()}_${file.name}`;
  const fr = storageRef(storage, `${pathPrefix}/${fn}`);
  const metadata = file.type ? { contentType: file.type } : undefined;
  await uploadBytes(fr, file, metadata);
  const url = await getDownloadURL(fr);
  return { url, storedName: fn };
}
