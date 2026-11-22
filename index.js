const { WebcastPushConnection } = require('tiktok-live-connector');

const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || 'kullanici_adi';
const TARGET_URL = process.env.TARGET_URL || 'https://senin-siten.netlify.app/api/gift';
const PORT = process.env.PORT || 3000;

const tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME);

tiktokConnection
  .connect()
  .then((state) => {
    console.log(`Bağlandı! Room ID: ${state.roomId} (@${TIKTOK_USERNAME})`);
  })
  .catch((err) => {
    console.error('TikTok bağlantısı başarısız:', err);
  });

tiktokConnection.on('gift', async (data) => {
  const giftPayload = {
    uniqueId: data.uniqueId,
    nickname: data.nickname,
    giftId: data.giftId,
    giftName: data.giftName,
    repeatCount: data.repeatCount,
    diamondCount: data.diamondCount,
  };

  console.log('Hediye geldi:', giftPayload);

  if (!TARGET_URL.includes('senin-siten.netlify.app')) {
    try {
      await fetch(TARGET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(giftPayload),
      });
    } catch (err) {
      console.error('Hedef adrese gönderme hatası:', err);
    }
  }
});

tiktokConnection.on('disconnected', () => {
  console.log('TikTok canlı yayın bağlantısı koptu.');
});

// Render web servisinin ayakta kalması için basit HTTP sunucusu
const http = require('http');
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', username: TIKTOK_USERNAME }));
  })
  .listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor.`);
  });
