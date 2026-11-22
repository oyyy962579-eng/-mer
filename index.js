const http = require('http');
const connectorPkg = require('tiktok-live-connector');

const TikTokClient =
  connectorPkg.TikTokLiveConnection ||
  connectorPkg.WebcastPushConnection ||
  connectorPkg.default ||
  (typeof connectorPkg === 'function' ? connectorPkg : null);

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || 'kullanici_adi';
const TARGET_URL = process.env.TARGET_URL || '';
const PORT = process.env.PORT || 3000;

let connectionStatus = 'waiting';
let lastError = null;
let lastGift = null;

if (typeof TikTokClient === 'function') {
  const client = new TikTokClient(TIKTOK_USERNAME, {});

  client
    .connect()
    .then((state) => {
      connectionStatus = 'connected';
      lastError = null;
      console.log(`TikTok yayinina baglandi. Room ID: ${state.roomId}`);
    })
    .catch((err) => {
      connectionStatus = 'disconnected';
      lastError = err && err.message ? err.message : String(err);
      console.log('TikTok baglanti notu:', lastError);
    });

  client.on('gift', async (data) => {
    lastGift = {
      user: data.uniqueId,
      giftName: data.giftName,
      repeatCount: data.repeatCount || 1,
      time: new Date().toISOString(),
    };
    console.log('Hediye geldi:', lastGift);

    if (TARGET_URL) {
      try {
        await fetch(TARGET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lastGift),
        });
      } catch (e) {
        console.log('Hedef URL gonderim hatasi:', e.message);
      }
    }
  });
} else {
  connectionStatus = 'export_mismatch';
  lastError = 'Uygun baglanti sinifi bulunamadi.';
  console.log(lastError);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      ok: true,
      service: 'tiktok-gift-bot',
      status: connectionStatus,
      username: TIKTOK_USERNAME,
      lastError,
      lastGift,
    })
  );
});

server.listen(PORT, () => {
  console.log(`HTTP sunucu ${PORT} portunda calisiyor.`);
});
