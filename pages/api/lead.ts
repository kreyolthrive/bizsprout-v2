import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // For now, just log the lead data and return success
  console.log('Lead submission:', req.body);
  
  // In a real implementation, you'd save this to a database
  // await saveLead(req.body);
  
  return res.status(200).json({ success: true });
}