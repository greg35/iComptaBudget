const http = require('http');

const options = {
    hostname: 'localhost',
    port: 2113,
    path: '/api/transactions/search?limit=5',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const transactions = JSON.parse(data);
            if (!Array.isArray(transactions)) {
                console.log('Response is not an array:', transactions);
                return;
            }
            console.log(`Received ${transactions.length} transactions`);

            if (transactions.length > 0) {
                const firstTx = transactions[0];
                console.log('First Transaction Structure:');
                console.log(JSON.stringify(firstTx, null, 2));

                if (firstTx.splits && Array.isArray(firstTx.splits)) {
                    console.log('✅ Transaction has splits array');
                    if (firstTx.splits.length > 0) {
                        console.log('✅ Splits array is not empty');
                        if (firstTx.splits[0].comment !== undefined) {
                            console.log('✅ Split has comment field');
                        } else {
                            console.error('❌ Split missing comment field');
                        }
                    }
                } else {
                    console.error('❌ Transaction missing splits array');
                }
            }
        } catch (e) {
            console.error('Error parsing response:', e);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();
