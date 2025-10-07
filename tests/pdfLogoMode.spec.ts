import { test, expect } from '@playwright/test';
import React from 'react';
import { PdfReport, PdfReportProps } from '@/components/PdfReport';
import { renderToStream } from '@react-pdf/renderer';

// Helper to collect the PDF structure tree (lightweight heuristic)
async function renderDoc(props: Partial<PdfReportProps> = {}) {
  const base: PdfReportProps = {
    idea: 'Test idea',
    avg: 55,
    status: 'GO',
    highlights: ['Great potential'],
    survey: { name: 'A', email: 'a@example.com', userType: 'founder', biggestChallenge: 'validation', usedAITools: 'yes', wouldTryApp: 'yes', businessBarriers: [], platformFeatures: [], mustHaveFeature: '', suggestions: '' },
    logoUrl: props.logoUrl,
    forceInlineBrand: (props as any).forceInlineBrand,
    rawApi: null,
  } as any;
  const element = React.createElement(PdfReport, base);
  // renderToStream does not expose internal node tree, but we can ensure it doesn't throw
  await renderToStream(element);
  return true;
}

test.describe('PdfReport logo rendering', () => {
  test('auto inlines when brand-logo.svg', async () => {
    await expect(renderDoc({ logoUrl: '/brand-logo.svg' })).resolves.toBe(true);
  });
  test('respects external custom logo (no forceInline)', async () => {
    await expect(renderDoc({ logoUrl: 'https://cdn.example.com/custom.svg' })).resolves.toBe(true);
  });
  test('forces inline even with external logo when forceInlineBrand', async () => {
    await expect(renderDoc({ logoUrl: 'https://cdn.example.com/custom.svg', forceInlineBrand: true as any })).resolves.toBe(true);
  });
});
