/**
 * Turns a report from report-html.ts into an A4 PDF in the browser, and
 * shares, saves or prints it. Each block is drawn as a picture of the page,
 * so the PDF looks just like the screen; a block that doesn't fit on the
 * page starts on the next one. The PDF libraries load only when needed.
 */
import { REPORT_CSS, reportPage } from '@/lib/report-html';

const PAGE_W = 210; // mm, A4
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Smaller files than the default quality, with no visible difference. */
function jpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/jpeg', 0.8);
}

export async function makeReportPdf(body: string): Promise<Blob> {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([import('jspdf'), import('html2canvas')]);
  const html2canvas = html2canvasModule.default;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;background:#fff';
  host.innerHTML = `<style>${REPORT_CSS}</style>${body}`;
  document.body.appendChild(host);
  try {
    await document.fonts?.ready;
    const report = host.querySelector('.lg-report') as HTMLElement;
    const blocks = Array.from(report.querySelectorAll(':scope > .blk')) as HTMLElement[];
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pxToMm = CONTENT_W / report.offsetWidth;
    let y = MARGIN;

    for (const block of blocks) {
      if (block.offsetHeight === 0) continue;
      const canvas = await html2canvas(block, { scale: 2, backgroundColor: '#ffffff', logging: false });
      const heightMm = block.offsetHeight * pxToMm;
      const room = PAGE_H - MARGIN - y;

      if (heightMm <= room) {
        pdf.addImage(jpeg(canvas), 'JPEG', MARGIN, y, CONTENT_W, heightMm, undefined, 'FAST');
        y += heightMm;
        continue;
      }
      if (heightMm <= PAGE_H - MARGIN * 2) {
        pdf.addPage();
        y = MARGIN;
        pdf.addImage(jpeg(canvas), 'JPEG', MARGIN, y, CONTENT_W, heightMm, undefined, 'FAST');
        y += heightMm;
        continue;
      }
      // Taller than a page (a long essay): split it across pages.
      const pxPerMm = canvas.height / heightMm;
      let doneMm = 0;
      if (room < 40) {
        pdf.addPage();
        y = MARGIN;
      }
      while (doneMm < heightMm) {
        const sliceMm = Math.min(PAGE_H - MARGIN - y, heightMm - doneMm);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.round(sliceMm * pxPerMm));
        slice.getContext('2d')!.drawImage(canvas, 0, -Math.round(doneMm * pxPerMm));
        pdf.addImage(jpeg(slice), 'JPEG', MARGIN, y, CONTENT_W, sliceMm, undefined, 'FAST');
        doneMm += sliceMm;
        y += sliceMm;
        if (doneMm < heightMm) {
          pdf.addPage();
          y = MARGIN;
        }
      }
    }
    return pdf.output('blob');
  } finally {
    host.remove();
  }
}

export type PdfShareOutcome = 'shared' | 'saved' | 'cancelled' | 'needs-tap' | 'failed';

/**
 * Shares the PDF through the share menu (Teams, Outlook, WhatsApp …) where
 * the browser allows files; otherwise downloads it. Some browsers only allow
 * sharing straight after a tap: then it returns 'needs-tap' and the caller
 * shows a button that calls this again.
 */
export async function shareOrSavePdf(pdf: Blob, filename: string, title: string): Promise<PdfShareOutcome> {
  const file = new File([pdf], filename, { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (isTouch && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
      if (e instanceof Error && e.name === 'NotAllowedError') return 'needs-tap';
      // Fall through to saving.
    }
  }
  try {
    const url = URL.createObjectURL(pdf);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Opens the report on its own page and the print menu (which can also save a PDF). */
export function printReport(title: string, body: string): boolean {
  const page = reportPage(title, body);
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(page);
    win.document.close();
    const go = () => {
      win.focus();
      win.print();
    };
    if (win.document.readyState === 'complete') setTimeout(go, 300);
    else win.addEventListener('load', () => setTimeout(go, 300));
    return true;
  }
  // Pop-ups blocked: print from a hidden frame on this page instead.
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) return false;
  doc.open();
  doc.write(page);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  }, 400);
  return true;
}

export function reportFilename(kind: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${kind}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.pdf`;
}
