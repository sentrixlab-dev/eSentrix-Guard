const axios = require('axios');

async function run() {
    try {
        const jsRes = await axios.get('https://app.courier.com.bd/assets/index-DSdpgs34.js');
        const jsCode = jsRes.data;
        const matches = [...new Set(jsCode.match(/https?:\/\/api\.bdcourier\.com[^\s"']*/g))];
        console.log(matches);
    } catch (e) {
        console.error(e.message);
    }
}
run();
