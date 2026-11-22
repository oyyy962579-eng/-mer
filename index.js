const http = require('http');
const { URL } = require('url');
const connectorPkg = require('tiktok-live-connector');

const TikTokClient =
  connectorPkg.TikTokLiveConnection ||
  connectorPkg.WebcastPushConnection ||
  connectorPkg.default ||
  (typeof connectorPkg === 'function' ? connectorPkg : null);

const DEFAULT_USERNAME = (process.env.TIKTOK_USERNAME || '').trim();
const TARGET_URL = (process.env.TARGET_URL || '').trim();
const PORT = process.env.PORT || 3000;

// Her kullanıcı adı için ayrı bağlantı ve son hediye bilgisini tutar
const sessions = new Map();

function cleanUsername(raw) {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

async function connectUser(rawUsername) {
  const username = cleanUsername(rawUsername);
  if (!username) {
    return { ok: false, error: 'Kullanici adi bos olamaz.' };
  }

  if (typeof TikTokClient !== 'function') {
    return { ok: false, error: 'TikTok baglanti sinifi yuklenemedi.' };
  }

  // Varsa eski bağlantıyı kapat
  const existing = sessions.get(username);
  if (existing && existing.client && typeof existing.client.disconnect === 'function') {
    try {
      existing.client.disconnect();
    } catch (_) {}
  }

  const stateObj = {
    username,
    status: 'connecting',
    roomId: null,
    lastError: null,
    lastGift: null,
    updatedAt: new Date().toISOString(),
    client: null,
  };

  const client = new TikTokClient(username, {});
  stateObj.client = client;
  sessions.set(username, stateObj);

  client
    .connect()
    .then((connState) => {
      stateObj.status = 'connected';
      stateObj.roomId = connState && connState.roomId ? connState.roomId : null;
      stateObj.lastError = null;
      stateObj.updatedAt = new Date().toISOString();
      console.log(`[${username}] yayina baglandi. Room ID: ${stateObj.roomId}`);
    })
    .catch((err) => {
      stateObj.status = 'disconnected';
      stateObj.lastError = err && err.message ? err.message : String(err);
      stateObj.updatedAt = new Date().toISOString();
      console.log(`[${username}] baglanti notu:`, stateObj.lastError);
    });

  client.on('gift', async (data) => {
    const giftPayload = {
      channel: username,
      user: data.uniqueId,
      nickname: data.nickname,
      giftName: data.giftName,
      repeatCount: data.repeatCount || 1,
      diamondCount: data.diamondCount || 0,
      time: new Date().toISOString(),
    };

    stateObj.lastGift = giftPayload;
    stateObj.updatedAt = new Date().toISOString();
    console.log(`[${username}] Hediye geldi:`, giftPayload);

    if (TARGET_URL) {
      try {
        await fetch(TARGET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(giftPayload),
        });
      } catch (e) {
        console.log(`[${username}] Hedef URL gonderim hatasi:`, e.message);
      }
    }
  });

  client.on('disconnected', () => {
    stateObj.status = 'disconnected';
    stateObj.updatedAt = new Date().toISOString();
    console.log(`[${username}] baglantisi koptu.`);
  });

  return {
    ok: true,
    username: stateObj.username,
    status: stateObj.status,
    lastError: stateObj.lastError,
  };
}

function serializeSession(s) {
  return {
    username: s.username,
    status: s.status,
    roomId: s.roomId,
    lastError: s.lastError,
    lastGift: s.lastGift,
    updatedAt: s.updatedAt,
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const userParam = cleanUsername(parsedUrl.searchParams.get('user'));

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });

  if (pathname === '/connect') {
    const targetUser = userParam || cleanUsername(DEFAULT_USERNAME);
    const result = await connectUser(targetUser);
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/disconnect') {
    if (!userParam || !sessions.has(userParam)) {
      res.end(JSON.stringify({ ok: false, error: 'Aktif oturum bulunamadi.' }));
      return;
    }
    const s = sessions.get(userParam);
    try {
      if (s.client && typeof s.client.disconnect === 'function') {
        s.client.disconnect();
      }
    } catch (_) {}
    sessions.delete(userParam);
    res.end(JSON.stringify({ ok: true, disconnected: userParam }));
    return;
  }

  if (pathname === '/status') {
    if (userParam) {
      const s = sessions.get(userParam);
      res.end(
        JSON.stringify({
          ok: true,
          session: s ? serializeSession(s) : null,
        })
      );
      return;
    }
  }

  const allSessions = Array.from(sessions.values()).map(serializeSession);
  res.end(
    JSON.stringify({
      ok: true,
      service: 'tiktok-gift-bot',
      activeCount: allSessions.length,
      sessions: allSessions,
    })
  );
});

server.listen(PORT, () => {
  console.log(`HTTP sunucu ${PORT} portunda calisiyor.`);
  if (DEFAULT_USERNAME) {
    connectUser(DEFAULT_USERNAME);
  }
});
