import React from 'react';
import { useRouter } from 'next/router';

export default function UploadLogoPage() {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<string>('');
  const [url, setUrl] = React.useState<string>('');
  const [localPreview, setLocalPreview] = React.useState<string>('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Uploading...');
    if (!file) {
      setStatus('Please choose a file');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload-logo', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setUrl(data.url);
      setStatus('Uploaded. Preview will update.');
      try {
        localStorage.setItem('bs:logoUrl', data.url);
        window.dispatchEvent(new Event('bs:logo-updated'));
      } catch {}
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const useLocally = async () => {
    if (!file) {
      setStatus('Please choose a file');
      return;
    }
    try {
      setStatus('Preparing local preview...');
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const dataUrl = String(reader.result || '');
          try {
            localStorage.setItem('bs:logoUrl', dataUrl);
          } catch (e) {
            setStatus('Image is too large to store locally. Please click Upload to host it, or choose a smaller image.');
            return;
          }
          window.dispatchEvent(new Event('bs:logo-updated'));
          setLocalPreview(dataUrl);
          // Heuristic: very large data URLs may still stress the browser; hint to upload instead
          if (dataUrl.length > 1_500_000) {
            setStatus('Using selected file locally (large image). Consider clicking Upload to host it for better performance. Redirecting to homepage…');
          } else {
            setStatus('Using selected file locally. Redirecting to homepage…');
          }
          // Give the storage event a tick, then show the result live
          setTimeout(() => {
            try { router.push('/'); } catch {}
          }, 300);
        } catch {
          setStatus('Could not save to localStorage');
        }
      };
      reader.onerror = () => setStatus('Could not read file');
      reader.readAsDataURL(file);
    } catch {
      setStatus('Could not prepare local preview');
    }
  };

  const resetOverride = () => {
    try {
      localStorage.removeItem('bs:logoUrl');
      setLocalPreview('');
      setStatus('Local logo override cleared.');
      window.dispatchEvent(new Event('bs:logo-updated'));
    } catch {}
  };

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Upload a Logo</h1>
      <p style={{ color: '#555', marginBottom: 16 }}>PNG, JPG, SVG, or WebP. After upload, the site will preview with your new logo immediately.</p>
      <form onSubmit={onSubmit}>
        <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div style={{ marginTop: 12 }}>
          <button type="submit" style={{ padding: '8px 16px', background: '#0EA5E9', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>Upload</button>
        </div>
      </form>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <button onClick={useLocally} style={{ padding: '8px 12px', background: '#10B981', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>Use this file now</button>
        <button onClick={resetOverride} style={{ padding: '8px 12px', background: '#EF4444', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>Reset local override</button>
      </div>
      {status && <p style={{ marginTop: 12 }}>{status}</p>}
      {url && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Public URL</div>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#0EA5E9' }}>{url}</a>
        </div>
      )}
      {localPreview && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Local preview (data URL)</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={localPreview} alt="Local logo preview" style={{ maxWidth: 180, maxHeight: 80, border: '1px solid #eee', borderRadius: 8, background: '#fff', padding: 4 }} />
        </div>
      )}
      <div style={{ marginTop: 24, fontSize: 12, color: '#666' }}>
        Tip: To make this default for everyone, set NEXT_PUBLIC_LOGO_URL to this URL and redeploy.
      </div>
    </div>
  );
}
