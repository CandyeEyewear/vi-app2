/**
 * API Route: /api/receipts
 * Handles receipt retrieval for users
 */

import { ReceiptService } from '../services/receiptService';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { email, receiptNumber } = req.query;

      if (receiptNumber) {
        const receipt = await ReceiptService.getReceipt(receiptNumber);
        return res.status(200).json({ receipt });
      }

      if (email) {
        const receipts = await ReceiptService.getUserReceipts(email);
        return res.status(200).json({ receipts });
      }

      return res.status(400).json({ error: 'Email or receiptNumber required' });
    } catch (error: any) {
      console.error('Receipt API error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

