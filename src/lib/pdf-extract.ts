/**
 * Client-side PDF text extraction using PDF.js (pdfjs-dist).
 *
 * The PDF.js worker is bundled by Next.js (webpack/Turbopack) as a static asset
 * via `new URL(..., import.meta.url)`. The bundler emits a content-hashed file
 * under `/_next/static/media/pdf.worker.<hash>.mjs`, so HTTP cache-busting works
 * automatically when pdfjs-dist is upgraded.
 *
 * pdfjs-dist itself is loaded lazily so the ~1MB main bundle is not added to
 * the initial page load — only when a user actually uploads a PDF.
 */

let workerConfigured = false;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    workerConfigured = true;
  }
  return pdfjs;
}

/**
 * Extract plain text from a PDF file's bytes.
 *
 * Pages are joined with form-feed (\f) characters; lines within a page are
 * joined by newlines. The output is suitable for storing as a UTF-8 text file
 * to be consumed by the chat tooling layer.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfJs();
  /** Pass a copy: PDF.js takes ownership of the buffer and detaches it. */
  const data = bytes.slice();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      try {
        const textContent = await page.getTextContent();
        /** items can be TextItem or TextMarkedContent; only TextItem has `str`. */
        const lines: string[] = [];
        let currentLine = "";
        for (const item of textContent.items) {
          if (!("str" in item)) continue;
          currentLine += item.str;
          if (item.hasEOL) {
            lines.push(currentLine);
            currentLine = "";
          }
        }
        if (currentLine.length > 0) lines.push(currentLine);
        pageTexts.push(lines.join("\n"));
      } finally {
        page.cleanup();
      }
    }
    return pageTexts.join("\n\f\n");
  } finally {
    await doc.destroy();
  }
}

export function isPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  return file.name.toLowerCase().endsWith(".pdf");
}
