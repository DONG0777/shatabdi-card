import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shatabdi2026';

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const password =
    req.headers['x-admin-password'] ||
    req.query?.password ||
    '';

  if (String(password) !== String(ADMIN_PASSWORD)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'Server config missing' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await supabase
      .from('swayamsevak_cards')
      .select(
        'card_id, full_name, dham, kaam, whatsapp_number, shakha, barga, role, year, sanghayu, image_url, terms_accepted, terms_accepted_at, lang'
      )
      .order('terms_accepted_at', { ascending: false });

    if (error) {
      console.error('Admin fetch failed:', error);
      return res.status(500).json({ ok: false, error: 'Failed to fetch cards' });
    }

    return res.status(200).json({
      ok: true,
      total: data?.length || 0,
      cards: data || [],
    });
  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ ok: false, error: 'Unexpected error' });
  }
}
