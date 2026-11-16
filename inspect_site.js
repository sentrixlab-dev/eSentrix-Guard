const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function inspect() {
    try {
        console.log('Fetching https://elitemart.com.bd/fraud-check-2...');
        const res1 = await axios.get('https://elitemart.com.bd/fraud-check-2', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        fs.writeFileSync(path.join(__dirname, 'elitemart.html'), res1.data);
        console.log('Saved elitemart.html.');
    } catch (e) {
        console.error('Error fetching Elite Mart:', e.message);
    }

    try {
        console.log('Fetching https://bdcourier.com/...');
        const res2 = await axios.get('https://bdcourier.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        fs.writeFileSync(path.join(__dirname, 'bdcourier.html'), res2.data);
        console.log('Saved bdcourier.html.');
    } catch (e) {
        console.error('Error fetching BD Courier:', e.message);
    }
}

inspect();
