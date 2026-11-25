// =====================================================
//  /api/stats – private server function for the admin page
//
//  It runs on Vercel (not in the visitor's browser), so the
//  secret Vercel token never reaches anyone's computer.
//
//  Settings it needs (Vercel → Project → Settings →
//  Environment Variables):
//    VERCEL_TOKEN    – your Vercel access token (secret)
//    ADMIN_PASSWORD  – the password you type on /admin
//  Optional:
//    ANALYTICS_PROJECT – project name (default: waithaka_steev)
//    ANALYTICS_TEAM    – team slug    (default: steev4)
// =====================================================

const crypto = require('crypto');

const API = 'https://api.vercel.com/v1/query/web-analytics/visits/aggregate';

// Compare passwords without leaking timing information
function passwordMatches(given, expected) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(a, b);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

async function query(params) {
  const url = new URL(API);
  url.searchParams.set('projectId', process.env.ANALYTICS_PROJECT || 'waithaka_steev');
  url.searchParams.set('slug', process.env.ANALYTICS_TEAM || 'steev4');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + process.env.VERCEL_TOKEN },
  });

  if (!response.ok) {
    let detail = '';
    try { detail = JSON.stringify(await response.json()); } catch (e) { /* ignore */ }
    const error = new Error('Vercel API error ' + response.status);
    error.status = response.status;
    error.detail = detail.slice(0, 300);
    throw error;
  }
  const json = await response.json();
  return json.data || [];
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  if (!process.env.ADMIN_PASSWORD || !process.env.VERCEL_TOKEN) {
    return res.status(500).json({
      error: 'setup',
      message: 'ADMIN_PASSWORD or VERCEL_TOKEN is missing in Vercel Environment Variables.',
    });
  }

  if (!passwordMatches(req.headers['x-admin-password'], process.env.ADMIN_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down password guessing
    return res.status(401).json({ error: 'password', message: 'Wrong password.' });
  }

  // Free plan keeps one month of data, so allow 1–30 days
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const range = { since: isoDay(since), until: isoDay(until) };

  try {
    const [totals, daily, pages, referrers, countries, devices] = await Promise.all([
      query({ ...range, by: 'environment', limit: '1' }), // one row = totals for the period
      query({ ...range, by: 'day' }),
      query({ ...range, by: 'requestPath', limit: '10' }),
      query({ ...range, by: 'referrerHostname', limit: '10' }),
      query({ ...range, by: 'country', limit: '10' }),
      query({ ...range, by: 'deviceType', limit: '5' }),
    ]);

    // Totals: use the one-row answer if Vercel gives it, otherwise add up the days
    const sum = (rows, key) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
    const totalRow = totals[0] || {};
    const total = {
      visitors: Number(totalRow.visitors) || sum(daily, 'visitors'),
      pageviews: Number(totalRow.pageviews) || sum(daily, 'pageviews'),
      fromDays: !Number(totalRow.visitors),
    };

    // Debug mode: show exactly what Vercel sent (numbers only, no secrets)
    if (req.query.debug === '1') {
      return res.status(200).json({ debug: true, range, totals, daily, pages, referrers, countries, devices });
    }

    return res.status(200).json({
      days,
      since: range.since,
      until: range.until,
      visitors: total.visitors || 0,
      pageviews: total.pageviews || 0,
      totalsFromDays: total.fromDays,
      daily: daily.map((d) => ({ date: d.timestamp, visitors: d.visitors || 0, pageviews: d.pageviews || 0 })),
      pages: pages.map((r) => ({ label: r.requestPath, visitors: r.visitors || 0 })),
      referrers: referrers.map((r) => ({ label: r.referrerHostname, visitors: r.visitors || 0 })),
      countries: countries.map((r) => ({ label: r.country, visitors: r.visitors || 0 })),
      devices: devices.map((r) => ({ label: r.deviceType, visitors: r.visitors || 0 })),
    });
  } catch (err) {
    console.error('stats error', err.status, err.detail);
    const messages = {
      401: 'Vercel rejected the token. Create a new token and update VERCEL_TOKEN.',
      403: 'The token is not allowed to read this project. Make sure its scope is your steev4 account.',
      402: 'Vercel says this API is not included in your current plan.',
      404: 'Vercel could not find the project. Check ANALYTICS_PROJECT and ANALYTICS_TEAM.',
    };
    return res.status(502).json({
      error: 'vercel',
      status: err.status || 0,
      message: messages[err.status] || 'Could not load analytics from Vercel right now. Try again in a minute.',
      detail: err.detail || String(err.message || ''),
    });
  }
};
