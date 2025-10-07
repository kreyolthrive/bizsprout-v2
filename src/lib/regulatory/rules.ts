// src/lib/regulatory/rules.ts
// Simple regex-driven red flags for regulatory/ethics gate.

export const RED_FLAGS: { pattern: RegExp; label: string; severity: 'BLOCKER' | 'HIGH' }[] = [
  { pattern: /\b(sell|broker|marketplace).{0,15}personal data\b/i, label: 'Data brokerage / sale of personal data', severity: 'BLOCKER' },
  { pattern: /\b(face|voice|biometric)\b/i, label: 'Biometric data processing', severity: 'HIGH' },
  { pattern: /\b(location data|geofence)\b/i, label: 'Precise location data', severity: 'HIGH' },
  { pattern: /\bscrape|harvest\b.*\bprofiles?\b/i, label: 'Data scraping of profiles', severity: 'HIGH' },
  // TODO: add more verticals: health (HIPAA), finance (KYC/AML/PCI), kids (COPPA), credit (FCRA), employment (EEOC), education (FERPA), etc.
];

