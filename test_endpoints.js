const axios = require('axios');

async function testEndpoints() {
    const urls = [
        'https://api.bdcourier.com/api/v1/search',
        'https://api.bdcourier.com/api/search',
        'https://api.bdcourier.com/search',
        'https://api.bdcourier.com/v1/search',
        'https://api.bdcourier.com/api/v1/check',
        'https://api.bdcourier.com/api/check',
        'https://api.bdcourier.com/check',
        'https://api.bdcourier.com/v1/check',
        'https://api.bdcourier.com/api/v1/courier-check'
    ];

    for (const url of urls) {
        try {
            const res = await axios.post(url, { phone: '01948821476' }, {
                headers: { 'Authorization': 'Bearer FAKE_TOKEN' },
                timeout: 5000
            });
            console.log(`[POST SUCCESS] ${url} - Status: ${res.status}`);
        } catch (e) {
            if (e.response) {
                console.log(`[POST FAILED] ${url} - Status: ${e.response.status}`);
            } else {
                console.log(`[POST ERROR] ${url} - ${e.message}`);
            }
        }
        
        try {
            const res = await axios.get(url, {
                params: { phone: '01948821476' },
                headers: { 'Authorization': 'Bearer FAKE_TOKEN' },
                timeout: 5000
            });
            console.log(`[GET SUCCESS] ${url} - Status: ${res.status}`);
        } catch (e) {
            if (e.response) {
                console.log(`[GET FAILED] ${url} - Status: ${e.response.status}`);
            } else {
                console.log(`[GET ERROR] ${url} - ${e.message}`);
            }
        }
    }
}

testEndpoints();
