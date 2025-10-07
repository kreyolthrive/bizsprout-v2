import React from 'react';
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer';

export type PilotContractProps = {
  company?: string;
  customer?: string;
  pilotLengthWeeks?: number;
  successMetrics?: string[];
  pricingNote?: string;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 12, color: '#111827' },
  h1: { fontSize: 18, marginBottom: 8, fontWeight: 700 },
  h2: { fontSize: 14, marginTop: 12, marginBottom: 6, fontWeight: 700 },
  p: { marginBottom: 6, lineHeight: 1.4 },
  li: { marginLeft: 12, marginBottom: 4 },
});

export default function PilotContractPdf({ company = 'Bizsprout AI', customer = 'Customer', pilotLengthWeeks = 4, successMetrics = ['Signup conversion %', 'Activation %', 'Retention %', 'ROI model complete'], pricingNote = 'Discounted pilot fee credited toward annual plan' }: PilotContractProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Paid Pilot Agreement</Text>
  <Text style={styles.p}>This Paid Pilot Agreement (the “Agreement”) is entered into between {company} (&quot;Provider&quot;) and {customer} (&quot;Customer&quot;).</Text>

        <Text style={styles.h2}>1. Scope</Text>
        <Text style={styles.p}>Provider will deliver access to the product and onboarding support for the duration of the Pilot.</Text>

        <Text style={styles.h2}>2. Term</Text>
        <Text style={styles.p}>The Pilot term is {pilotLengthWeeks} weeks starting on the Effective Date.</Text>

        <Text style={styles.h2}>3. Success Metrics</Text>
        {successMetrics.map((m, i) => (
          <Text key={i} style={styles.li}>• {m}</Text>
        ))}

        <Text style={styles.h2}>4. Data & Security</Text>
        <Text style={styles.p}>Customer data remains Customer’s property. Provider will apply industry-standard security controls. PHI/PII handling requires signed BAA or equivalent.</Text>

        <Text style={styles.h2}>5. Pricing</Text>
        <Text style={styles.p}>Pilot fee: $1,000 – $5,000 (depending on scope). {pricingNote}.</Text>

        <Text style={styles.h2}>6. Termination</Text>
        <Text style={styles.p}>Either party may terminate with 7 days’ written notice. Fees are non-refundable once onboarding commences.</Text>

        <Text style={styles.h2}>7. Confidentiality</Text>
        <Text style={styles.p}>Both parties agree to keep confidential information private and use it only for evaluating the Pilot.</Text>

        <Text style={styles.h2}>8. Signatures</Text>
        <Text style={styles.p}>Signed by authorized representatives as of the Effective Date.</Text>
      </Page>
    </Document>
  );
}
