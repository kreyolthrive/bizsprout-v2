export default function StatusPage() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || '0.0.0';
  return (
    <main className="status-main">
      <h1>Status</h1>
      <p>OK</p>
      <p>Version: {version}</p>
      <p>Time: {new Date().toISOString()}</p>
      <style jsx>{`
        .status-main{padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial,sans-serif}
      `}</style>
    </main>
  );
}
