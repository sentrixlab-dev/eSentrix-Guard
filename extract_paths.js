const axios = require('axios');

async function run() {
    try {
        const jsRes = await axios.get('https://app.courier.com.bd/assets/index-DSdpgs34.js');
        const jsCode = jsRes.data;
        const matches = [...new Set(jsCode.match(/["']\/[a-z0-9\-_]+["']/g))];
        console.log("Paths found:", matches.filter(m => m.includes('search') || m.includes('check') || m.includes('api')));
    } catch (e) {
        console.error(e.message);
    }
}
run();
