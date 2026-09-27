import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL || 'https://shatabdi-card.vercel.app';

const ALLOWED_LANGS = new Set(['bn', 'hi', 'en']);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_TEXT_LENGTH = 300;
const MAX_WHATSAPP_LENGTH = 30;


const TRANSLATIONS = {
  bn: {
    title: 'শতবর্ষী স্মারক পরিচিতিপত্র',
    description:
      'শতবর্ষী স্মারক পরিচিতিপত্র | স্বয়ংসেবকের ব্যক্তিগত পরিচিতি কার্ড।',
    loading: 'কার্ড লোড হচ্ছে...',
    notFound: 'কার্ডটি পাওয়া যায়নি।',
    nameLabel: 'নাম',
    dhamLabel: 'ধাম',
    ctaTitle: 'আপনার নিজের কার্ড তৈরি করুন',
    ctaButton: 'কার্ড তৈরি করুন 🚩',
    tagline: 'প্রচার নয়, এটি আমার পরিচয় — আমি স্বয়ংসেবক!',
  },
  hi: {
    title: 'शताब्दी स्मारक परिचय पत्र',
    description:
      'शताब्दी स्मारक परिचय पत्र | स्वयंसेवक का व्यक्तिगत परिचय कार्ड।',
    loading: 'कार्ड लोड हो रहा है...',
    notFound: 'कार्ड नहीं मिला।',
    nameLabel: 'नाम',
    dhamLabel: 'धाम',
    ctaTitle: 'अपना खुद का कार्ड बनाएं',
    ctaButton: 'कार्ड बनाएं 🚩',
    tagline: 'प्रचार नहीं, यह मेरी पहचान है — मैं स्वयंसेवक हूँ!',
  },
  en: {
    title: 'Centenary Memorial Identity Card',
    description:
      'Centenary Memorial Identity Card | Personal identity card for a volunteer.',
    loading: 'Loading card...',
    notFound: 'Card not found.',
    nameLabel: 'Name',
    dhamLabel: 'Dham',
    ctaTitle: 'Create your own card',
    ctaButton: 'Create Card 🚩',
    tagline: 'Not publicity, this is my identity — I am a Swayamsevak!',
  },
};
function getLanguage(value) {
  const lang = String(value || 'bn').toLowerCase();
  return ALLOWED_LANGS.has(lang) ? lang : 'bn';
}

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function normalizeId(value) {
  const raw = String(value ?? '').trim();

  if (!/^\d{6,12}$/.test(raw)) {
    return null;
  }

  return raw;
}

function isCrawler(req) {
  const userAgent = String(
    req.headers?.['user-agent'] ||
      req.headers?.['User-Agent'] ||
      ''
  ).toLowerCase();

  return /facebookexternalhit|facebookcatalog|whatsapp|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|googlebot|bingbot|duckduckbot|applebot|pinterest|crawler|spider|bot\b/.test(
    userAgent
  );
}

function setCommonHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'User-Agent');
}

function setDynamicHeaders(res) {
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function getShareUrl(cardId, version) {
  const url = new URL('/api/card', PUBLIC_SITE_URL);

  url.searchParams.set('id', String(cardId));

  if (version) {
    url.searchParams.set('v', String(version));
  }

  return url.toString();
}

function getHumanUrl(cardId, version) {
  const url = new URL('/', PUBLIC_SITE_URL);

  url.searchParams.set('id', String(cardId));

  if (version) {
    url.searchParams.set('v', String(version));
  }

  return url.toString();
}

function jsonError(res, status, message, code = 'REQUEST_FAILED') {
  setCommonHeaders(res);
  setDynamicHeaders(res);

  return res.status(status).json({
    ok: false,
    error: message,
    code,
  });
}

function generateCardId() {
  return String(crypto.randomInt(100000000, 1000000000));
}

async function generateUniqueCardId(supabase) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const cardId = generateCardId();

    const { data, error } = await supabase
      .from('swayamsevak_cards')
      .select('card_id')
      .eq('card_id', cardId)
      .maybeSingle();

    if (error) {
      throw new Error(`CARD_ID_CHECK_FAILED: ${error.message}`);
    }

    if (!data) {
      return cardId;
    }
  }

  throw new Error('CARD_ID_GENERATION_FAILED');
}

function parseImageDataUrl(imageDataUrl) {
  const value = String(imageDataUrl || '');

  const match = value.match(
    /^data:(image\/png|image\/jpeg|image\/jpg);base64,([A-Za-z0-9+/=\s]+)$/
  );

  if (!match) {
    return null;
  }

  const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  const base64 = match[2].replace(/\s/g, '');

  let buffer;

  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return null;
  }

  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    return null;
  }

  return {
    buffer,
    mimeType,
  };
}

function getExtension(mimeType) {
  return mimeType === 'image/png' ? 'png' : 'jpg';
}

function normalizePhone(value) {
  return cleanText(value, MAX_WHATSAPP_LENGTH).replace(
    /[^\d+()\-\s]/g,
    ''
  );
}

async function createCard(req, res, supabase) {
  const body =
    req.body && typeof req.body === 'object' ? req.body : {};

  const fullName = cleanText(body.full_name, MAX_NAME_LENGTH);
  const dham = cleanText(body.dham, MAX_TEXT_LENGTH);
  const kaam = cleanText(body.kaam, MAX_TEXT_LENGTH);
  const shakha = cleanText(body.shakha, MAX_TEXT_LENGTH);
  const barga = cleanText(body.barga, MAX_TEXT_LENGTH);
  const role = cleanText(body.role, 120);
  const sanghayu = cleanText(body.sanghayu, 60);
  const yearRaw = cleanText(body.year, 20);
  const whatsappNumber = normalizePhone(body.whatsapp_number);
  const lang = getLanguage(body.lang);

  if (!fullName || fullName.length < 2) {
    return jsonError(res, 400, 'Full name is required.', 'INVALID_NAME');
  }

  if (!body.terms_accepted) {
    return jsonError(
      res,
      400,
      'Terms must be accepted.',
      'TERMS_REQUIRED'
    );
  }

  let year = null;

  if (yearRaw) {
    if (!/^\d{4}$/.test(yearRaw)) {
      return jsonError(
        res,
        400,
        'Year must be a valid four-digit year.',
        'INVALID_YEAR'
      );
    }

    const parsedYear = Number(yearRaw);

    if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2026) {
      return jsonError(
        res,
        400,
        'Year must be between 1900 and 2026.',
        'INVALID_YEAR'
      );
    }

    year = parsedYear;
  }

  const image = parseImageDataUrl(body.image_data_url);

  if (!image) {
    return jsonError(
      res,
      400,
      'A valid PNG or JPEG card image is required.',
      'INVALID_IMAGE'
    );
  }

  const cardId = await generateUniqueCardId(supabase);
  const extension = getExtension(image.mimeType);
  const storagePath = `cards/${cardId}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from('card-images')
    .upload(storagePath, image.buffer, {
      contentType: image.mimeType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    console.error('Storage upload failed:', uploadError);

    let serviceKeyRole = '';
    let serviceKeyFormat = '';
    let serviceKeyJwtParts = 0;
    let serviceKeyPayloadDecoded = false;

    try {
      const key = String(SUPABASE_SERVICE_ROLE_KEY || '');
      const tokenParts = key.split('.');
      serviceKeyJwtParts = tokenParts.length;

      if (tokenParts.length === 3) {
        serviceKeyFormat = 'legacy_jwt';
        const payload = JSON.parse(
          Buffer.from(tokenParts[1], 'base64url').toString('utf8')
        );
        serviceKeyPayloadDecoded = true;
        serviceKeyRole = payload?.role ? String(payload.role) : '';
      } else if (key.startsWith('sb_secret_')) {
        serviceKeyFormat = 'new_secret';
      } else if (key) {
        serviceKeyFormat = 'other';
      }
    } catch {}

    const uploadDiagnostic = [
      uploadError?.message ? `message=${uploadError.message}` : '',
      uploadError?.name ? `name=${uploadError.name}` : '',
      uploadError?.statusCode ? `statusCode=${uploadError.statusCode}` : '',
      uploadError?.error ? `error=${uploadError.error}` : '',
      serviceKeyFormat ? `serviceKeyFormat=${serviceKeyFormat}` : '',
      `serviceKeyJwtParts=${serviceKeyJwtParts}`,
      `serviceKeyPayloadDecoded=${serviceKeyPayloadDecoded}`,
      serviceKeyRole ? `serviceKeyRole=${serviceKeyRole}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    return jsonError(
      res,
      500,
      uploadDiagnostic
        ? `Card image upload failed: ${uploadDiagnostic}`
        : 'Card image upload failed.',
      'IMAGE_UPLOAD_FAILED'
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from('card-images')
    .getPublicUrl(storagePath);

  const imageUrl = publicUrlData?.publicUrl;

  if (!imageUrl) {
    await supabase.storage.from('card-images').remove([storagePath]);

    return jsonError(
      res,
      500,
      'Could not create public image URL.',
      'IMAGE_URL_FAILED'
    );
  }

  const insertPayload = {
    card_id: cardId,
    full_name: fullName,
    dham,
    kaam,
    whatsapp_number: whatsappNumber || null,
    shakha,
    barga,
    role,
    year,
    sanghayu: sanghayu || null,
    image_url: imageUrl,
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
    lang,
  };

  const { data: insertedCard, error: insertError } = await supabase
    .from('swayamsevak_cards')
    .insert(insertPayload)
    .select(
      'card_id, full_name, dham, kaam, whatsapp_number, shakha, barga, role, year, sanghayu, image_url, terms_accepted, terms_accepted_at, lang'
    )
    .single();

  if (insertError) {
    console.error('Database insert failed:', insertError);

    await supabase.storage.from('card-images').remove([storagePath]);

    return jsonError(
      res,
      500,
      'Card record could not be created.',
      'DATABASE_INSERT_FAILED'
    );
  }

  const version = Date.now();
  const shareUrl = getShareUrl(cardId, version);

  setCommonHeaders(res);
  setDynamicHeaders(res);

  return res.status(201).json({
    ok: true,
    card: {
      ...insertedCard,
      year,
      sanghayu,
    },
    id: String(cardId),
    imageUrl,
    shareUrl,
  });
}

async function getCard(req, res, supabase) {
  const id = normalizeId(req.query?.id);
  const format = String(req.query?.format || '').toLowerCase();
  const version = cleanText(req.query?.v, 80);

  if (!id) {
    if (format === 'json') {
      return jsonError(
        res,
        400,
        'A valid card ID is required.',
        'INVALID_CARD_ID'
      );
    }

    setCommonHeaders(res);
    return res.redirect(302, '/');
  }

  const { data, error } = await supabase
    .from('swayamsevak_cards')
    .select(
      'card_id, full_name, dham, kaam, whatsapp_number, shakha, barga, role, year, sanghayu, image_url, terms_accepted_at, lang'
    )
    .eq('card_id', id)
    .maybeSingle();

  if (error) {
    console.error('Supabase card fetch failed:', error);

    if (format === 'json') {
      return jsonError(
        res,
        500,
        'Could not load the card.',
        'CARD_FETCH_FAILED'
      );
    }

    setCommonHeaders(res);
    setDynamicHeaders(res);

    return res.status(500).send('Card could not be loaded.');
  }

  if (!data) {
    if (format === 'json') {
      return jsonError(
        res,
        404,
        'Card not found.',
        'CARD_NOT_FOUND'
      );
    }


    return sendOgPage(req, res, {
      cardId: id,
      fullName: '',
      dham: '',
      imageUrl: `${PUBLIC_SITE_URL}/logo.png`,
      lang: getLanguage(req.query?.lang),
      version,
      notFound: true,
    });
  }

  const lang = getLanguage(data.lang || req.query?.lang);

  if (format === 'json') {
    const shareUrl = getShareUrl(
      id,
      version || data.terms_accepted_at || ''
    );

    setCommonHeaders(res);
    setDynamicHeaders(res);

    return res.status(200).json({
      ok: true,
      card: {
        id: String(data.card_id),
        full_name: data.full_name || '',
        dham: data.dham || '',
        kaam: data.kaam || '',
        whatsapp_number: data.whatsapp_number || '',
        shakha: data.shakha || '',
        barga: data.barga || '',
        role: data.role || '',
        year: data.year ?? null,
        sanghayu: data.sanghayu || '',
        image_url: data.image_url || '',
        lang,
      },
      imageUrl: data.image_url || '',
      shareUrl,
    });
  }


  return sendOgPage(req, res, {
    cardId: id,
    fullName: data.full_name || '',
    dham: data.dham || '',
    imageUrl:
      data.image_url || `${PUBLIC_SITE_URL}/logo.png`,
    lang,
    version: version || data.terms_accepted_at || '',
    notFound: false,
  });
}


function sendOgPage(
  req,
  res,
  {
    cardId,
    fullName,
    dham,
    imageUrl,
    lang,
    version,
    notFound,
  }
) {
  const t = TRANSLATIONS[lang] || TRANSLATIONS.bn;

  const safeName =
    cleanText(fullName, MAX_NAME_LENGTH) ||
    (lang === 'hi'
      ? 'स्वयंसेवक'
      : lang === 'en'
        ? 'Volunteer'
        : 'স্বয়ংসেবক');

  const safeDham =
    cleanText(dham, MAX_TEXT_LENGTH) ||
    (lang === 'hi'
      ? 'पश्चिम बंगाल'
      : lang === 'en'
        ? 'West Bengal'
        : 'পশ্চিমবঙ্গ');

  const title = notFound
    ? t.notFound
    : `${t.title} | ${safeName}`;

  const description = notFound
    ? t.notFound
    : `${t.description} ${safeDham}`;

  const shareUrl = getShareUrl(cardId, version);
  const homeUrl = `${PUBLIC_SITE_URL}/`;

  const cardImageHtml = notFound
    ? ''
    : `<img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(safeName)}" class="card-image" />`;

  const html = `<!DOCTYPE html>
<html lang="${escapeAttribute(lang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>${escapeHtml(title)}</title>

  <meta name="description" content="${escapeAttribute(description)}">

  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeAttribute(title)}">
  <meta property="og:description" content="${escapeAttribute(description)}">
  <meta property="og:image" content="${escapeAttribute(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeAttribute(imageUrl)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="1200">
  <meta property="og:url" content="${escapeAttribute(shareUrl)}">
  <meta property="og:site_name" content="শতবর্ষী স্মারক পরিচিতিপত্র">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttribute(title)}">
  <meta name="twitter:description" content="${escapeAttribute(description)}">
  <meta name="twitter:image" content="${escapeAttribute(imageUrl)}">

  <meta name="robots" content="noindex,nofollow">

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      min-height: 100%;
      background: linear-gradient(135deg, #0a1128 0%, #0f1b3d 50%, #0a1128 100%);
      color: #ffffff;
      font-family: 'Hind Siliguri', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
      text-align: center;
    }

    .container {
      width: 100%;
      max-width: 520px;
      border: 4px solid #f59e0b;
      border-radius: 20px;
      padding: 24px 20px 28px;
      background: rgba(15, 23, 42, 0.6);
      box-shadow: 0 0 40px rgba(245, 158, 11, 0.15);
    }

    .top-badge {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }

    .flag-text {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 800;
      color: #f59e0b;
    }

    .flag-icon { font-size: 26px; }

    .years-badge {
      background: #f59e0b;
      color: #0f172a;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.05em;
    }

    .card-image {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 12px;
      margin-bottom: 18px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .name {
      font-size: 24px;
      font-weight: 800;
      color: #fbbf24;
      margin-bottom: 6px;
    }

    .dham {
      font-size: 15px;
      color: #cbd5e1;
      margin-bottom: 18px;
    }

    .tagline {
      font-size: 16px;
      font-weight: 700;
      color: #fef3c7;
      line-height: 1.4;
      margin-bottom: 22px;
      padding: 0 8px;
    }

    .cta-button {
      display: block;
      width: 100%;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #0f172a;
      text-decoration: none;
      font-size: 17px;
      font-weight: 800;
      padding: 16px;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgba(245, 158, 11, 0.35);
      transition: transform 0.15s, box-shadow 0.15s;
    }

    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(245, 158, 11, 0.5);
    }

    .not-found {
      font-size: 18px;
      color: #f87171;
      margin-bottom: 22px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-badge">
      <div class="flag-text">
        <span class="flag-icon">🚩</span>
        <span>100 YEARS</span>
      </div>
      <div class="years-badge">1925 – 2026</div>
    </div>

    ${
      notFound
        ? `<div class="not-found">${escapeHtml(t.notFound)}</div>`
        : `
          ${cardImageHtml}
          <div class="name">${escapeHtml(safeName)}</div>
          <div class="dham">${escapeHtml(t.dhamLabel)}: ${escapeHtml(safeDham)}</div>
        `
    }

    <div class="tagline">"${escapeHtml(t.tagline)}"</div>

    <a href="${escapeAttribute(homeUrl)}" class="cta-button">
      🚩 ${escapeHtml(t.ctaButton)}
    </a>
  </div>
</body>
</html>`;

  setCommonHeaders(res);
  setDynamicHeaders(res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  return res.status(notFound ? 404 : 200).send(html);
}
export default async function handler(req, res) {
  setCommonHeaders(res);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.'
    );

    return jsonError(
      res,
      500,
      'Server configuration is incomplete.',
      'SERVER_CONFIG_MISSING'
    );
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  try {
    if (req.method === 'POST') {
      return await createCard(req, res, supabase);
    }

    if (req.method === 'GET') {
      return await getCard(req, res, supabase);
    }

    res.setHeader('Allow', 'GET, POST');

    return jsonError(
      res,
      405,
      'Method not allowed.',
      'METHOD_NOT_ALLOWED'
    );
  } catch (error) {
    console.error('Unhandled /api/card error:', error);

    return jsonError(
      res,
      500,
      'An unexpected server error occurred.',
      'INTERNAL_SERVER_ERROR'
    );
  }
}
