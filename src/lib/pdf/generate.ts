import { resolvePdfMode } from './mode';
import type { PdfGenerateInput, PdfGenerateResult } from './types';

// Utility to create and trigger a download (kept here to reduce duplication)
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function generatePdfReport(input: PdfGenerateInput): Promise<PdfGenerateResult> {
  const { diagnostics, modeResolution, idea, avg, status, highlights, scores, survey, logoUrl, rawApi, simulateFailure } = input;
  const { mode } = modeResolution;
  const t0 = performance.now();
  const push = (s: string) => diagnostics?.enabled && diagnostics.push(s);
  push(`Mode: ${mode}`);

  try {
    // Fast mode: tiny placeholder bytes
    if (mode === 'fast') {
      push('Fast mode start');
      if (simulateFailure) {
        push('Fast mode simulated failure');
        throw new Error('PDF generation failed.');
      }
      const blob = new Blob([new Uint8Array([0x25,0x50,0x44,0x46])], { type: 'application/pdf' });
      push('Fast blob created');
      triggerDownload(blob, `BizSproutAI-Validation-Report-${new Date().toISOString().split('T')[0]}.pdf`);
      const durationMs = Math.round(performance.now() - t0);
      push(`Fast mode done (${durationMs} ms)`);
      return { success: true, blob, durationMs, mode };
    }

    if (mode === 'slow') {
      push('Slow mode engaged (artificial delay)');
      await new Promise(r => setTimeout(r, 1500));
      push('Slow mode delay complete');
      const blob = new Blob([
        '%PDF-1.3\n% SlowMode Placeholder PDF\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'
      ], { type: 'application/pdf' });
      push(`Slow mode placeholder blob size ${blob.size} bytes`);
      triggerDownload(blob, `BizSproutAI-Validation-Report-${new Date().toISOString().split('T')[0]}-slow.pdf`);
      const durationMs = Math.round(performance.now() - t0);
      push(`Slow mode download triggered (duration ${durationMs} ms)`);
      return { success: true, blob, durationMs, mode };
    }

    // Real mode
    push('Real mode import start');
    const [{ pdf }, pdfReportMod, React] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/ComprehensivePdfReport'),
      import('react')
    ]);
    
    // Get the ComprehensivePdfReport component (try both named and default exports)
    const PdfReportComp = pdfReportMod.ComprehensivePdfReport || pdfReportMod.default;
    if (!PdfReportComp) throw new Error('ComprehensivePdfReport component not found');
    if (simulateFailure) throw new Error('Simulated PDF failure');
    
    push('Real mode rendering comprehensive report');
    const element = React.createElement(PdfReportComp, {
      idea, avg, status, highlights, scores, survey, logoUrl, rawApi
    });
    
    const blob = await pdf(element as React.ReactElement).toBlob();
    if (!(blob instanceof Blob)) throw new Error('Invalid PDF blob');
    push(`Real mode blob size ${blob.size}`);
    triggerDownload(blob, `BizSproutAI-Validation-Report-${new Date().toISOString().split('T')[0]}.pdf`);
    const durationMs = Math.round(performance.now() - t0);
    push(`Real mode download triggered (${durationMs} ms)`);
    return { success: true, blob, durationMs, mode };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - t0);
    const msg = err instanceof Error ? err.message : 'PDF generation failed.';
    push(`Error: ${msg}`);
    return { success: false, error: msg, durationMs, mode };
  }
}

export { resolvePdfMode };
