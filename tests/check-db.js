const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
    try {
        console.log('\n📊 DATABASE CONTENTS:\n');
        
        const result = await pool.query(`
            SELECT id, phoneNumber as phone, email, linkedId, linkPrecedence as type, 
                   createdAt, updatedAt 
            FROM Contact 
            WHERE deletedAt IS NULL 
            ORDER BY id
        `);
        
        if (result.rows.length === 0) {
            console.log('No contacts in database.');
            await pool.end();
            return;
        }
        
        // Display as table
        console.table(result.rows.map(row => ({
            id: row.id,
            email: row.email || '-',
            phone: row.phone || '-',
            type: row.type,
            linkedId: row.linkedid || '-',
            created: new Date(row.createdat).toLocaleString()
        })));
        
        // Summary
        const primaries = result.rows.filter(r => r.type === 'primary');
        const secondaries = result.rows.filter(r => r.type === 'secondary');
        
        console.log('\n📈 SUMMARY:');
        console.log(`Total Contacts: ${result.rows.length}`);
        console.log(`Primary Contacts: ${primaries.length}`);
        console.log(`Secondary Contacts: ${secondaries.length}`);
        
        // Show relationships
        console.log('\n🔗 RELATIONSHIPS:');
        for (const primary of primaries) {
            const linked = secondaries.filter(s => s.linkedid === primary.id);
            if (linked.length > 0) {
                console.log(`\nPrimary #${primary.id} (${primary.email || 'no email'}, ${primary.phone || 'no phone'}):`);
                linked.forEach(s => {
                    console.log(`  └─ Secondary #${s.id} (${s.email || 'no email'}, ${s.phone || 'no phone'})`);
                });
                
                // Show all emails and phones for this group
                const allEmails = [primary.email, ...linked.map(l => l.email)].filter(e => e);
                const allPhones = [primary.phone, ...linked.map(l => l.phone)].filter(p => p);
                console.log(`     Emails: ${[...new Set(allEmails)].join(', ')}`);
                console.log(`     Phones: ${[...new Set(allPhones)].join(', ')}`);
            }
        }
        
        await pool.end();
    } catch (error) {
        console.error('Error:', error.message);
        await pool.end();
    }
}

checkDatabase();