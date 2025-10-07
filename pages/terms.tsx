import Head from 'next/head';

export default function Terms() {
  return (
    <main style={{ maxWidth: 860, margin: '40px auto', padding: '0 20px', lineHeight: 1.7 }}>
      <Head>
        <title>Terms of Service • BizSproutAI</title>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Terms of Service</h1>
      <p style={{ color: '#64748B' }}>Last updated: {new Date().toLocaleDateString()}</p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>1. Agreement</h2>
        <p>By accessing or using BizSproutAI, you agree to these Terms of Service. If you do not agree, please do not use the service.</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>2. Use of Service</h2>
        <p>You may not misuse the Service or attempt to access it using a method other than the interface and instructions we provide.</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>3. Intellectual Property</h2>
        <p>All content, trademarks, and logos are the property of BizSproutAI or its licensors. You retain ownership of content you submit.</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>4. Disclaimer</h2>
        <p>The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee outcomes or fitness for a particular purpose.</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>5. Limitation of Liability</h2>
        <p>BizSproutAI is not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>6. Contact</h2>
        <p>For questions about these terms, contact support@bizsproutai.com.</p>
      </section>
    </main>
  );
}
