export default function HelpCenter() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight mb-2">Help Center</h1>
      <p className="text-slate-500 mb-6">Were in betaexpect fast changes and quick fixes. If youre stuck, reach us and well help.</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>Email support: <a className="text-emerald-600 underline" href="mailto:support@bizsproutai.com">support@bizsproutai.com</a></li>
        <li>Common topics: validation errors, score meaning, exporting reports, account questions.</li>
      </ul>
    </main>
  );
}
