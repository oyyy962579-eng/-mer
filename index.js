const { WebcastPushConnection } = require('tiktok-live-connector');
const http = require('http');

let currentGifts = { Gül: 0, Donut: 0, Parfüm: 0 };

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/data') {
        res.end(JSON.stringify(currentGifts));
    } else {
        res.end('Server is running');
    }
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Server started');
});

const tiktokUsername = '@yayinci_hesabi';
const tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
    console.log(`Connected to ROOM ${state.roomInfo.roomId}`);
}).catch(err => {
    console.error('Connection failed', err);
});

tiktokLiveConnection.on('gift', data => {
    if (currentGifts[data.giftName] !== undefined) {
        currentGifts[data.giftName] += data.repeatCount;
    }
    
    fetch('https://fanciful-puppy-7e9e4f.netlify.app/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gift: data.giftName, count: data.repeatCount, user: data.uniqueId })
    }).catch(err => console.log('Webhook error', err));
});
