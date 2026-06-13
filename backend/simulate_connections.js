const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { poolPromise, sql } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const SERVER_URL = 'ws://localhost:5000';

async function startSimulation() {
    console.log('🤖 NEXABANK CLIENT SIMULATOR');
    console.log('🔌 Querying registered customers from database...');

    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT c.Customer_ID, a.Account_No, c.Name 
            FROM Customer c
            JOIN Accounts a ON c.Customer_ID = a.Customer_ID
        `);

        const customers = result.recordset;
        console.log(`📊 Found ${customers.length} registered customer accounts in database.`);

        if (customers.length === 0) {
            console.log('⚠️ No customers found to connect.');
            process.exit(0);
        }

        const activeSockets = [];

        console.log(`🔌 Establishing WebSocket connections for all ${customers.length} customers...`);

        for (const customer of customers) {
            // Sign JWT token for the customer
            const token = jwt.sign(
                { id: customer.Customer_ID, account_no: customer.Account_No },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log(`➡️ Connecting ${customer.Name} (ID: ${customer.Customer_ID}, Account: ${customer.Account_No})...`);

            const ws = new WebSocket(SERVER_URL, ['nexa-auth', token]);

            ws.on('open', () => {
                console.log(`💚 Connected: ${customer.Name}`);
            });

            ws.on('message', (data) => {
                try {
                    const payload = JSON.parse(data);
                    if (payload.type === 'STATE_UPDATE') {
                        console.log(`📡 [Sync Event] ${customer.Name} received state update: Balance = ₹${payload.balance}`);
                    }
                } catch (e) {
                    console.log(`📡 [Message] ${customer.Name} received raw: ${data}`);
                }
            });

            ws.on('error', (err) => {
                console.error(`❌ [Error] ${customer.Name}:`, err.message);
            });

            ws.on('close', (code, reason) => {
                console.warn(`🔌 [Closed] ${customer.Name} connection closed. Code: ${code}`);
            });

            activeSockets.push(ws);
            // Small artificial delay to avoid overwhelming network buffers instantly
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        console.log(`\n🎉 All ${activeSockets.length} connections initiated successfully!`);
        console.log('📡 Listening for real-time broadcasts. Press Ctrl+C to stop simulation.\n');

    } catch (err) {
        console.error('❌ Simulation initiation failed:', err);
    }
}

// Start after database initializes
startSimulation();
