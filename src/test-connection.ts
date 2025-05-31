import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('Testing connection to:', process.env.DATABASE_URL?.split('@')[1]); // Shows host without password

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Connected! Time:', result.rows[0].now);
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed:', error);
        process.exit(1);
    }
}

testConnection();