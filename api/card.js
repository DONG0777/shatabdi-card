import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hwofisrbphmcnyburaht.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lDHd8hpKX20VuGnFXxFiow_LWdzhSsn';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    const { id, img, lang } = req.query;

    if (!id) {
        return res.redirect(302, '/');
    }

    try {
        const { data, error } = await supabase
            .from('swayamsevak_cards')
            .select('*')
            .eq('card_id', id)
            .single();

        let imageUrl = img || 'https://shatabdi-card.vercel.app/logo.png';
        let userName = data ? data.full_name : 'স্বয়ংসেবক';
        let userDham = data ? data.dham : 'পশ্চিমবঙ্গ';

        const title = `শতবর্ষী স্মারক পরিচিতিপত্র | ${userName}`;
        const description = `ধাম: ${userDham} | "প্রচার নয়, এটি আমার পরিচয় — আমি স্বয়ংসেবক!" শতবর্ষের গৌরবময় যাত্রায় আপনার কার্ড তৈরি করুন।`;

        const html = `
            <!DOCTYPE html>
            <html lang="${lang || 'bn'}">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <meta property="og:title" content="${title}" />
                <meta property="og:description" content="${description}" />
                <meta property="og:image" content="${imageUrl}" />
                <meta property="og:url" content="https://shatabdi-card.vercel.app" />
                <meta property="og:type" content="website" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:image" content="${imageUrl}" />
                <meta http-equiv="refresh" content="0;url=/" />
            </head>
            <body style="background:#0f172a; color:#fff; text-align:center; padding-top:50px; font-family:sans-serif;">
                <h2>কার্ড লোড হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন 🚩</h2>
                <script>
                    window.location.href = "/";
                </script>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);

    } catch (err) {
        res.redirect(302, '/');
    }
}
