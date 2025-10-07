export type PdfMode = 'fast' | 'slow' | 'real';

export interface PdfModeResolution {
  mode: PdfMode;
  fastFlag: boolean;
  slowFlag: boolean;
}

export interface PdfGenerateInput {
  idea: string;
  avg: number | null;
  status: 'GO' | 'REVIEW' | 'NO-GO' | undefined;
  highlights: string[];
  scores: any; // TODO: tighten
  survey: any; // survey data shape from page
  logoUrl: string;
  rawApi: any; // raw result passthrough
  modeResolution: PdfModeResolution;
  simulateFailure?: boolean;
  diagnostics?: { enabled: boolean; push: (s: string) => void };
}

export interface PdfGenerateResult {
  success: boolean;
  blob?: Blob;
  error?: string;
  durationMs: number;
  mode: PdfMode;
  steps?: string[];
}
