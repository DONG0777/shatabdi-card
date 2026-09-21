import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hwofisrbphmcnyburaht.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lDHd8hpKX20VuGnFXxFiow_LWdzhSsn';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    const { id, img, lang } = req.query;

    if (!id) {
        return res.redirect(302, '/');
    }

    let imageUrl = img ? decodeURIComponent(img) : 'https://shatabdi-card.vercel.app/logo.png';
    let userName = 'স্বয়ংসেবক';
    let userDham = 'পশ্চিমবঙ্গ';

    try {
        const { data, error } = await supabase
            .from('swayamsevak_cards')
            .select('*')
            .eq('card_id', id)
            .single();

        if (data) {
            userName = data.full_name || userName;
            userDham = data.dham || userDham;
            if (data.image_url) {
                imageUrl = data.image_url;
            }
        }
    } catch (err) {
        console.error("Supabase fetch error:", err);
    }

    const title = `শতবর্ষী স্মারক পরিচিতিপত্র | ${userName}`;
    const description = `ধাম: ${userDham} | "প্রচার নয়, এটি আমার পরিচয় — আমি স্বয়ংসেবক!" শতবর্ষের গৌরবময় যাত্রায় আপনার কার্ড তৈরি করুন।`;
    
    const shareUrl = `https://shatabdi-card.vercel.app/api/card?id=${id}&img=${encodeURIComponent(imageUrl)}`;

    const html = `
        <!DOCTYPE html>
        <html lang="${lang || 'bn'}">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <meta property="og:title" content="${title}" />
            <meta property="og:description" content="${description}" />
            <meta property="og:image" content="${imageUrl}" />
            <meta property="og:image:secure_url" content="${imageUrl}" />
            <meta property="og:image:type" content="image/png" />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:url" content="${shareUrl}" />
            <meta property="og:type" content="website" />
            
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="${title}" />
            <meta name="twitter:description" content="${description}" />
            <meta name="twitter:image" content="${imageUrl}" />
            
            <!-- Cache Control & Direct Redirect for users -->
            <meta http-equiv="refresh" content="0;url=/?id=${id}" />
        </head>
        <body style="background:#0f172a; color:#fff; text-align:center; padding-top:100px; font-family:sans-serif;">
            <h3>কার্ড লোড হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন 🚩</h3>
            <script>
                window.location.href = "/?id=" + "${id}";
            </script>
        </body>
        </html>
    `;

    // ক্যাশ ক্লিয়ার করার হেডার যাতে ফেসবুক পুরোনো সাদা ছবি না ধরে
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).send(html);
}
