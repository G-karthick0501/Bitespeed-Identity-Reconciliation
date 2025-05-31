import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// Define Contact interface (matches PostgreSQL lowercase column names)
interface Contact {
    id: number;
    phonenumber: string | null;
    email: string | null;
    linkedid: number | null;
    linkprecedence: 'primary' | 'secondary';
    createdat: string;
    updatedat: string;
    deletedat: string | null;
}

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize database
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS Contact (
                id SERIAL PRIMARY KEY,
                phoneNumber TEXT,
                email TEXT,
                linkedId INTEGER REFERENCES Contact(id),
                linkPrecedence TEXT CHECK(linkPrecedence IN ('primary', 'secondary')),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deletedAt TIMESTAMP
            )
        `);
        
        console.log('✅ Database initialized!');
    } catch (error) {
        console.error('Database init error:', error);
    }
}

// Main endpoint
app.post('/identify', async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;
    
    try {
        console.log('📨 Received request:', { email, phoneNumber });
        
        // Build query conditions
        const conditions = [];
        const params = [];
        let paramCount = 1;
        
        if (email) {
            conditions.push(`email = $${paramCount}`);
            params.push(email);
            paramCount++;
        }
        
        if (phoneNumber) {
            conditions.push(`phoneNumber = $${paramCount}`);
            params.push(phoneNumber);
            paramCount++;
        }
        
        // Find matches only if we have at least one condition
        let matches = { rows: [] };
        if (conditions.length > 0) {
            const query = `
                SELECT id, phoneNumber as phonenumber, email, linkedId as linkedid, 
                       linkPrecedence as linkprecedence, createdAt as createdat, 
                       updatedAt as updatedat, deletedAt as deletedat
                FROM Contact 
                WHERE deletedAt IS NULL 
                AND (${conditions.join(' OR ')})
            `;
            matches = await pool.query(query, params);
        }
        
        console.log(`Found ${matches.rows.length} matches`);
        
        // No matches - create new primary
        if (matches.rows.length === 0) {
            const result = await pool.query(
                'INSERT INTO Contact (email, phoneNumber, linkPrecedence) VALUES ($1, $2, $3) RETURNING id',
                [email || null, phoneNumber || null, 'primary']
            );
            
            console.log('✨ Created new primary contact with ID:', result.rows[0].id);
            
            return res.json({
                contact: {
                    primaryContatctId: result.rows[0].id,
                    emails: email ? [email] : [],
                    phoneNumbers: phoneNumber ? [phoneNumber] : [],
                    secondaryContactIds: []
                }
            });
        }
        
        // Find all unique contacts
        const uniqueContactMap = new Map<number, Contact>();
        matches.rows.forEach((contact: Contact) => {
            uniqueContactMap.set(contact.id, contact);
        });
        const uniqueContacts = Array.from(uniqueContactMap.values());
        
        // Find all primary contacts
        const primaryContactMap = new Map<number, Contact>();
        
        for (const contact of uniqueContacts) {
            if (contact.linkprecedence === 'primary') {
                primaryContactMap.set(contact.id, contact);
            } else if (contact.linkedid) {
                // Get the primary of this secondary
                const primaryResult = await pool.query(
                    `SELECT id, phoneNumber as phonenumber, email, linkedId as linkedid, 
                            linkPrecedence as linkprecedence, createdAt as createdat, 
                            updatedAt as updatedat, deletedAt as deletedat
                     FROM Contact WHERE id = $1 AND deletedAt IS NULL`,
                    [contact.linkedid]
                );
                if (primaryResult.rows[0]) {
                    primaryContactMap.set(primaryResult.rows[0].id, primaryResult.rows[0]);
                }
            }
        }
        
        const uniquePrimaries = Array.from(primaryContactMap.values());
        
        if (uniquePrimaries.length === 0) {
            throw new Error('No primary contact found');
        }
        
        // Determine the ultimate primary (oldest by createdAt, then by ID)
        let finalPrimary = uniquePrimaries[0];
        
        if (uniquePrimaries.length > 1) {
            console.log('🔄 Merging multiple primary contacts...');
            
            // Sort by createdAt, then by ID to find the oldest
            finalPrimary = uniquePrimaries.sort((a, b) => {
                const timeA = new Date(a.createdat).getTime();
                const timeB = new Date(b.createdat).getTime();
                
                if (timeA === timeB) {
                    return a.id - b.id; // Lower ID wins if times are equal
                }
                return timeA - timeB; // Earlier time wins
            })[0];
            
            console.log(`Selected primary: ${finalPrimary.id} (created at ${finalPrimary.createdat})`);
            
            // Update all other primaries to become secondary
            for (const primary of uniquePrimaries) {
                if (primary.id !== finalPrimary.id) {
                    await pool.query(
                        'UPDATE Contact SET linkPrecedence = $1, linkedId = $2, updatedAt = CURRENT_TIMESTAMP WHERE id = $3',
                        ['secondary', finalPrimary.id, primary.id]
                    );
                    
                    // Update all contacts linked to this primary
                    await pool.query(
                        'UPDATE Contact SET linkedId = $1, updatedAt = CURRENT_TIMESTAMP WHERE linkedId = $2',
                        [finalPrimary.id, primary.id]
                    );
                }
            }
        }
        
        // Check if we need to create a new secondary contact
        let needNewSecondary = false;
        
        if (email && phoneNumber) {
            // Check if this exact combination already exists
            const existingResult = await pool.query(
                'SELECT * FROM Contact WHERE email = $1 AND phoneNumber = $2 AND deletedAt IS NULL AND (id = $3 OR linkedId = $3)',
                [email, phoneNumber, finalPrimary.id]
            );
            
            needNewSecondary = existingResult.rows.length === 0;
        } else if (email && !phoneNumber) {
            // Check if we already have this email linked to this primary
            const hasEmailLinked = await pool.query(
                'SELECT * FROM Contact WHERE email = $1 AND deletedAt IS NULL AND (id = $2 OR linkedId = $2)',
                [email, finalPrimary.id]
            );
            needNewSecondary = hasEmailLinked.rows.length === 0;
        } else if (!email && phoneNumber) {
            // Check if we already have this phone linked to this primary
            const hasPhoneLinked = await pool.query(
                'SELECT * FROM Contact WHERE phoneNumber = $1 AND deletedAt IS NULL AND (id = $2 OR linkedId = $2)',
                [phoneNumber, finalPrimary.id]
            );
            needNewSecondary = hasPhoneLinked.rows.length === 0;
        }
        
        if (needNewSecondary) {
            const newSecondary = await pool.query(
                'INSERT INTO Contact (email, phoneNumber, linkedId, linkPrecedence) VALUES ($1, $2, $3, $4) RETURNING id',
                [email || null, phoneNumber || null, finalPrimary.id, 'secondary']
            );
            console.log('➕ Created new secondary contact with ID:', newSecondary.rows[0].id);
        }
        
        // Get all linked contacts for the response
        const allLinkedResult = await pool.query(
            `SELECT id, phoneNumber as phonenumber, email, linkedId as linkedid, 
                    linkPrecedence as linkprecedence, createdAt as createdat, 
                    updatedAt as updatedat, deletedAt as deletedat
             FROM Contact 
             WHERE (id = $1 OR linkedId = $1) AND deletedAt IS NULL 
             ORDER BY id`,
            [finalPrimary.id]
        );
        
        const allLinked = allLinkedResult.rows;
        
        // Build response arrays
        const emails: string[] = [];
        const phoneNumbers: string[] = [];
        const secondaryContactIds: number[] = [];
        
        // Add primary's data first
        if (finalPrimary.email) emails.push(finalPrimary.email);
        if (finalPrimary.phonenumber) phoneNumbers.push(finalPrimary.phonenumber);
        
        // Add all linked contacts
        for (const contact of allLinked) {
            if (contact.id !== finalPrimary.id) {
                secondaryContactIds.push(contact.id);
                if (contact.email && !emails.includes(contact.email)) {
                    emails.push(contact.email);
                }
                if (contact.phonenumber && !phoneNumbers.includes(contact.phonenumber)) {
                    phoneNumbers.push(contact.phonenumber);
                }
            }
        }
        
        console.log('✅ Returning consolidated contact');
        
        res.json({
            contact: {
                primaryContatctId: finalPrimary.id,
                emails,
                phoneNumbers,
                secondaryContactIds
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        console.error('Stack trace:', (error as Error).stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy' });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy' });
    }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
    res.json({ 
        message: 'Bitespeed Identity Reconciliation API',
        endpoint: 'POST /identify',
        example: {
            email: 'test@example.com',
            phoneNumber: '1234567890'
        }
    });
});

const PORT = process.env.PORT || 3000;

// Start server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`
🚀 Server is running!
📍 URL: http://localhost:${PORT}
📮 Test endpoint: POST http://localhost:${PORT}/identify
        `);
    });
}).catch(console.error);