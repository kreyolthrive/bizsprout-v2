import type { NextApiRequest, NextApiResponse } from 'next';
import { getSupabaseAdmin } from '@/lib/db';
import { ensureCsrf } from '@/lib/csrfMiddleware';

// Disable Next's default body parsing so we can read the raw multipart stream
export const config = {
  api: {
    bodyParser: false,
    sizeLimit: '8mb',
  },
};

// Simple upload API to store a logo in Supabase Storage and return a public URL
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and a bucket named 'assets'
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') { await ensureCsrf(req, res); return res.status(204).end(); }
  if (req.method === 'GET') { await ensureCsrf(req, res); return res.status(200).json({ ok: true }); }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ok = await ensureCsrf(req, res);
  if (!ok) return;

  try {
    // Environment checks for clearer errors (avoid HTML error page from runtime crashes)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
    if (!url || !serviceKey) {
      return res.status(503).json({
        error: 'Supabase is not configured',
        details: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      });
    }

    const ct = String(req.headers['content-type'] || '').toLowerCase();
    if (!ct.startsWith('multipart/form-data')) {
      return res.status(415).json({ error: 'Unsupported Media Type. Use multipart/form-data' });
    }

    // Parse form data (edge-safe minimal)
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (c) => chunks.push(Buffer.from(c)));
      req.on('end', () => resolve());
      req.on('error', reject);
    });

    const body = Buffer.concat(chunks);
    // naive boundary parse for a single file field named 'file'
    const boundaryMatch = /boundary=(.*)$/.exec(req.headers['content-type'] || '');
    if (!boundaryMatch) return res.status(400).json({ error: 'Invalid multipart payload' });
    const boundary = '--' + boundaryMatch[1];

    const parts = body.toString('binary').split(boundary);
    const filePart = parts.find((p) => p.includes('name="file"'));
    if (!filePart) return res.status(400).json({ error: 'Missing file field' });

    const headerEnd = filePart.indexOf('\r\n\r\n');
    if (headerEnd === -1) return res.status(400).json({ error: 'Malformed part' });
    const header = filePart.slice(0, headerEnd);
    const content = filePart.slice(headerEnd + 4, filePart.lastIndexOf('\r\n'));

    const filenameMatch = /filename="([^"]+)"/i.exec(header);
    const filename = filenameMatch?.[1] || `logo-${Date.now()}.bin`;

    const bytes = Buffer.from(content, 'binary');
    const ext = (filename.split('.').pop() || 'bin').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const path = `logos/${Date.now()}.${ext}`;
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }
    const { error: upErr } = await supabaseAdmin.storage.from('assets').upload(path, bytes, {
      contentType: `image/${ext === 'svg' ? 'svg+xml' : ext}`,
      upsert: false,
    });
    if (upErr) return res.status(500).json({ error: 'Upload failed', details: upErr.message });

  const { data: pub } = supabaseAdmin.storage.from('assets').getPublicUrl(path);
  if (!pub?.publicUrl) return res.status(500).json({ error: 'Failed to get public URL' });

  res.setHeader('X-Logo-Updated', '1');
  return res.status(201).json({ url: pub.publicUrl, note: 'Store this as localStorage["bs:logoUrl"] and dispatch a "bs:logo-updated" event for immediate refresh.' });
  } catch (err) {
    console.error('upload-logo error', err);
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return res.status(500).json({ error: message });
  }
}
