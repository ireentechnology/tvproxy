const express = require('express');
const fetch = require('node-fetch');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url parameter');

  try {
    const fetchOptions = {
      headers: {
        'User-Agent': req.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': req.get('referer') || 'https://www.google.com/',
        'Origin': req.get('origin') || ''
      },
      redirect: 'follow'
    };

    const upstream = await fetch(target, fetchOptions);
    const contentType = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
      const txt = await upstream.text().catch(()=>null);
      return res
        .status(upstream.status)
        .set('Content-Type', contentType || 'text/plain')
        .send(txt || `Upstream returned ${upstream.status}`);
    }

    // যদি m3u8 ফাইল হয় তাহলে ভিতরের সব লিংককেও proxy করে দাও
    if (contentType.includes('application/vnd.apple.mpegurl') || target.endsWith('.m3u8')) {
      let bodyText = await upstream.text();
      bodyText = bodyText.replace(/(https?:\/\/[^\s\r\n]+)/g, (m) => {
        const myHost = `${req.protocol}://${req.get('host')}`;
        return `${myHost}/?url=${encodeURIComponent(m)}`;
      });
      res.set({
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
      return res.send(bodyText);
    }

    // .ts বা অন্যান্য ফাইল সরাসরি পাঠাও
    res.status(upstream.status);
    res.set({
      'Content-Type': contentType || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    upstream.body.pipe(res);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy Error: ' + err.message);
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
