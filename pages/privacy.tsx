import Head from 'next/head';

export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <Head>
        <title>Privacy Policy • BizSproutAI</title>
      </Head>

      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Privacy Policy</h1>
      <p className="text-slate-500">Effective date: {new Date().toLocaleDateString()}</p>

      <section className="mt-6 space-y-2">
        <h2 className="text-xl font-bold">1. Overview</h2>
        <p>We respect your privacy. This policy explains what information we collect, how we use it, and your choices.</p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-xl font-bold">2. Information We Collect</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Information you provide (e.g., email, idea text, survey responses)</li>
          <li>Usage data (product analytics to improve the service)</li>
          <li>Log data and cookies (for performance and security)</li>
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-xl font-bold">3. How We Use Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Provide and improve validation and reporting features</li>
          <li>Communicate updates and support</li>
          <li>Protect against fraud, abuse, and misuse</li>
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-xl font-bold">4. Data Sharing</h2>
        <p>We do not sell your personal information. We may share data with service providers under strict confidentiality for hosting, analytics, and support.</p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-xl font-bold">5. Your Choices</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Opt out of non-essential emails</li>
          <li>Request data deletion or export by contacting support@bizsproutai.com</li>
          <li>Control cookies through your browser settings</li>
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-xl font-bold">6. Contact</h2>
        <p>Questions? Email support@bizsproutai.com.</p>
      </section>
    </main>
  );
}
