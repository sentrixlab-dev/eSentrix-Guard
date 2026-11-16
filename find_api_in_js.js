const axios = require('axios');

async function findApiInJs() {
    try {
        const res = await axios.get('https://app.courier.com.bd/search');
        const html = res.data;
        
        const scriptRegex = /<script\s+[^>]*src="([^"]+\.js)"/g;
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            let src = match[1];
            const jsUrl = src.startsWith('http') ? src : `https://app.courier.com.bd${src.startsWith('/') ? '' : '/'}${src}`;
            console.log(`Checking ${jsUrl}...`);
            try {
                const jsRes = await axios.get(jsUrl);
                const jsCode = jsRes.data;
                const matches = jsCode.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/api)?\/[a-zA-Z0-9.\-/]+/g);
                if (matches) {
                    console.log(`Found URLs in ${src}:`, [...new Set(matches)]);
                }
            } catch (e) {
                console.error(`Failed to fetch ${jsUrl}`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}
findApiInJs();
