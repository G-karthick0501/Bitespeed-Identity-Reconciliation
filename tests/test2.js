const fetch = require('node-fetch');
const { Pool } = require('pg');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000/identify';

// Database connection for cleanup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Helper function to make requests
async function makeRequest(data) {
    const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return response.json();
}

// Helper to wait between tests
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Color codes for console
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Test counter
let testNumber = 0;
let passedTests = 0;
let failedTests = 0;

// Clean database before tests
async function cleanDatabase() {
    try {
        console.log(colors.yellow + '\nCleaning database...' + colors.reset);
        
        // Delete all records
        await pool.query('DELETE FROM Contact');
        
        // Reset the ID sequence to start from 1
        await pool.query("SELECT setval(pg_get_serial_sequence('contact', 'id'), 1, false)");
        
        console.log(colors.green + '✓ Database cleaned successfully' + colors.reset);
    } catch (error) {
        console.error(colors.red + 'Error cleaning database:', error.message + colors.reset);
        console.log('Continuing anyway...');
    }
}

// Helper to run and validate test
async function runTest(name, input, expectedChecks) {
    testNumber++;
    console.log(colors.yellow + `\n─────────────────────────────────────────`);
    console.log(`TEST ${testNumber}: ${name}`);
    console.log(`─────────────────────────────────────────` + colors.reset);
    console.log('Input:', JSON.stringify(input, null, 2));
    
    try {
        const result = await makeRequest(input);
        console.log('Response:', JSON.stringify(result, null, 2));
        
        // Run validation checks
        let passed = true;
        for (const check of expectedChecks) {
            if (!check.condition(result)) {
                console.log(colors.red + `✗ Failed: ${check.message}` + colors.reset);
                passed = false;
            } else {
                console.log(colors.green + `✓ Passed: ${check.message}` + colors.reset);
            }
        }
        
        if (passed) {
            console.log(colors.green + `\n✓ Test passed!` + colors.reset);
            passedTests++;
        } else {
            console.log(colors.red + `\n✗ Test failed!` + colors.reset);
            failedTests++;
        }
        
        return result;
    } catch (error) {
        console.log(colors.red + `✗ Error: ${error.message}` + colors.reset);
        failedTests++;
        return null;
    }
}

// Simple test without validation (for setup)
async function setupTest(name, input) {
    console.log(colors.blue + `\nSetup: ${name}` + colors.reset);
    console.log('Input:', JSON.stringify(input, null, 2));
    try {
        const result = await makeRequest(input);
        console.log('Created:', JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.log(colors.red + `Setup failed: ${error.message}` + colors.reset);
        return null;
    }
}

async function runAllTests() {
    console.log(colors.cyan + '\n🧪 COMPLETE BITESPEED TEST SUITE\n' + colors.reset);
    console.log('This will test all requirements from the Bitespeed Identity Reconciliation task');
    console.log('─────────────────────────────────────────\n');
    
    // Clean database first
    await cleanDatabase();
    await wait(1000);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 1: BASIC FUNCTIONALITY TESTS
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 1: BASIC FUNCTIONALITY       ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // TEST 1: Create First Primary Contact
    await runTest(
        'Create First Primary Contact',
        { email: 'lorraine@hillvalley.edu', phoneNumber: '123456' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 1, message: 'Primary ID should be 1' },
            { condition: (r) => r.contact.emails.length === 1, message: 'Should have 1 email' },
            { condition: (r) => r.contact.emails[0] === 'lorraine@hillvalley.edu', message: 'Email should match input' },
            { condition: (r) => r.contact.phoneNumbers.length === 1, message: 'Should have 1 phone' },
            { condition: (r) => r.contact.phoneNumbers[0] === '123456', message: 'Phone should match input' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(500);
    
    // TEST 2: Same Phone, Different Email (Create Secondary)
    await runTest(
        'Same Phone, Different Email → Create Secondary',
        { email: 'mcfly@hillvalley.edu', phoneNumber: '123456' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 1, message: 'Primary ID should remain 1' },
            { condition: (r) => r.contact.emails.length === 2, message: 'Should have 2 emails' },
            { condition: (r) => r.contact.emails.includes('lorraine@hillvalley.edu'), message: 'Should include original email' },
            { condition: (r) => r.contact.emails.includes('mcfly@hillvalley.edu'), message: 'Should include new email' },
            { condition: (r) => r.contact.secondaryContactIds.includes(2), message: 'Should have secondary ID 2' }
        ]
    );
    await wait(500);
    
    // TEST 3: Same Email, Different Phone
    await runTest(
        'Same Email, Different Phone → Create Secondary',
        { email: 'lorraine@hillvalley.edu', phoneNumber: '987654' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 1, message: 'Primary ID should remain 1' },
            { condition: (r) => r.contact.phoneNumbers.length === 2, message: 'Should have 2 phones' },
            { condition: (r) => r.contact.phoneNumbers.includes('123456'), message: 'Should include original phone' },
            { condition: (r) => r.contact.phoneNumbers.includes('987654'), message: 'Should include new phone' },
            { condition: (r) => r.contact.secondaryContactIds.length === 2, message: 'Should have 2 secondaries' }
        ]
    );
    await wait(500);
    
    // TEST 4: Exact Match (Should Return Existing)
    await runTest(
        'Exact Match → No New Contact Created',
        { email: 'mcfly@hillvalley.edu', phoneNumber: '123456' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 1, message: 'Primary ID should remain 1' },
            { condition: (r) => r.contact.secondaryContactIds.length === 2, message: 'Should still have 2 secondaries (no new contact)' }
        ]
    );
    await wait(500);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 2: PRIMARY TO SECONDARY CONVERSION (MERGE SCENARIOS)
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 2: PRIMARY→SECONDARY MERGE   ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Setup for merge test
    await runTest(
        'Create Primary Contact (George)',
        { email: 'george@hillvalley.edu', phoneNumber: '919191' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 4, message: 'Primary ID should be 4' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(500);
    
    await runTest(
        'Create Primary Contact (Biff)',
        { email: 'biffsucks@hillvalley.edu', phoneNumber: '717171' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 5, message: 'Primary ID should be 5' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(500);
    
    // CRITICAL TEST: Primary → Secondary Conversion
    await runTest(
        '🔥 CRITICAL: Primary→Secondary Merge (Document Example)',
        { email: 'george@hillvalley.edu', phoneNumber: '717171' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 4, message: '❗ PRIMARY MUST BE 4 (older), NOT 5!' },
            { condition: (r) => r.contact.emails.includes('george@hillvalley.edu'), message: 'Should include george email' },
            { condition: (r) => r.contact.emails.includes('biffsucks@hillvalley.edu'), message: 'Should include biffsucks email' },
            { condition: (r) => r.contact.phoneNumbers.includes('919191'), message: 'Should include 919191' },
            { condition: (r) => r.contact.phoneNumbers.includes('717171'), message: 'Should include 717171' },
            { condition: (r) => r.contact.secondaryContactIds.includes(5), message: 'Contact 5 should become secondary' }
        ]
    );
    await wait(500);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 3: OPTIONAL FIELDS & EDGE CASES
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 3: OPTIONAL FIELDS & EDGES   ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // TEST: Only Email Provided
    await runTest(
        'Only Email Provided (Optional phoneNumber)',
        { email: 'lorraine@hillvalley.edu' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 1, message: 'Should find contact 1' },
            { condition: (r) => r.contact.emails.includes('lorraine@hillvalley.edu'), message: 'Should include the searched email' },
            { condition: (r) => r.contact.phoneNumbers.length === 2, message: 'Should return all linked phones' }
        ]
    );
    await wait(500);
    
    // TEST: Only Phone Provided
    await runTest(
        'Only Phone Provided (Optional email)',
        { phoneNumber: '919191' },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === 4, message: 'Should find merged contact 4' },
            { condition: (r) => r.contact.phoneNumbers.includes('919191'), message: 'Should include the searched phone' }
        ]
    );
    await wait(500);
    
    // TEST: Both Fields Null
    await runTest(
        'Both Fields Null → New Primary',
        { email: null, phoneNumber: null },
        [
            { condition: (r) => r.contact && r.contact.emails.length === 0, message: 'Should have empty emails array' },
            { condition: (r) => r.contact.phoneNumbers.length === 0, message: 'Should have empty phones array' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(500);
    
    // TEST: Empty Strings
    await runTest(
        'Empty Strings (Different from null)',
        { email: '', phoneNumber: '' },
        [
            { condition: (r) => r.contact && r.contact.emails.length === 0, message: 'Should handle empty strings' },
            { condition: (r) => r.contact.phoneNumbers.length === 0, message: 'Should have empty phones array' }
        ]
    );
    await wait(500);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 4: RESPONSE FORMAT VALIDATION
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 4: RESPONSE FORMAT           ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    console.log('\nValidating primary contact appears first in arrays...');
    
    // Setup for ordering test
    await setupTest('Primary for ordering', { email: 'primary@order.com', phoneNumber: '5555' });
    await setupTest('Secondary 1', { email: 'secondary1@order.com', phoneNumber: '5555' });
    await setupTest('Secondary 2', { email: 'secondary2@order.com', phoneNumber: '5555' });
    
    await runTest(
        'Response Ordering - Primary First',
        { phoneNumber: '5555' },
        [
            { condition: (r) => r.contact && r.contact.emails[0] === 'primary@order.com', message: 'First email must be from primary contact' },
            { condition: (r) => r.contact.phoneNumbers[0] === '5555', message: 'First phone must be from primary contact' }
        ]
    );
    await wait(500);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 5: COMPLEX MERGE SCENARIOS
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 5: COMPLEX MERGES            ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Chain Merge Test
    console.log('\nSetting up chain merge scenario...');
    await setupTest('Create A (Primary)', { email: 'a@chain.com', phoneNumber: '111' });
    await setupTest('Create B (Secondary to A)', { email: 'b@chain.com', phoneNumber: '111' });
    await setupTest('Create C (New Primary)', { email: 'c@chain.com', phoneNumber: '333' });
    
    await runTest(
        'Chain Merge - Linking Two Chains',
        { email: 'a@chain.com', phoneNumber: '333' },
        [
            { condition: (r) => r.contact && r.contact.emails.length === 3, message: 'Should have all 3 emails after chain merge' },
            { condition: (r) => r.contact.emails.includes('a@chain.com'), message: 'Should include a@chain.com' },
            { condition: (r) => r.contact.emails.includes('b@chain.com'), message: 'Should include b@chain.com' },
            { condition: (r) => r.contact.emails.includes('c@chain.com'), message: 'Should include c@chain.com' }
        ]
    );
    await wait(500);
    
    // Three-way merge
    console.log('\nSetting up three-way merge...');
    await setupTest('X Primary', { email: 'x@three.com', phoneNumber: '777' });
    await setupTest('Y Primary', { email: 'y@three.com', phoneNumber: '888' });
    await setupTest('Z Primary', { email: 'z@three.com', phoneNumber: '999' });
    await setupTest('Link X-Y', { email: 'x@three.com', phoneNumber: '888' });
    
    await runTest(
        'Three-way Merge - All Primaries Linked',
        { email: 'y@three.com', phoneNumber: '999' },
        [
            { condition: (r) => r.contact && r.contact.emails.length === 3, message: 'Should merge all 3 primaries' },
            { condition: (r) => r.contact.phoneNumbers.length === 3, message: 'Should have all 3 phones' }
        ]
    );
    await wait(500);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 6: STRESS TESTS
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 6: STRESS TESTS              ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    console.log('\nTesting large chain...');
    await setupTest('Chain primary', { email: 'chain@stress.com', phoneNumber: '10000' });
    
    for (let i = 1; i <= 10; i++) {
        await setupTest(`Chain secondary ${i}`, { email: `chain${i}@stress.com`, phoneNumber: '10000' });
    }
    
    await runTest(
        'Large Chain - 11 Contacts Linked',
        { phoneNumber: '10000' },
        [
            { condition: (r) => r.contact && r.contact.emails.length === 11, message: 'Should have 11 emails' },
            { condition: (r) => r.contact.secondaryContactIds.length === 10, message: 'Should have 10 secondaries' }
        ]
    );
    await wait(500);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 7: BITESPEED DOCUMENT EXAMPLES
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 7: DOCUMENT EXAMPLES         ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Example from document
    await setupTest('Doc Brown Primary', { email: 'doc.brown@future.com', phoneNumber: '88888' });
    
    await runTest(
        'Document Example - Secondary Creation',
        { email: 'emmett@time.com', phoneNumber: '88888' },
        [
            { condition: (r) => r.contact && r.contact.emails.includes('doc.brown@future.com'), message: 'Should include first email' },
            { condition: (r) => r.contact.emails.includes('emmett@time.com'), message: 'Should include second email' },
            { condition: (r) => r.contact.phoneNumbers.includes('88888'), message: 'Should include phone number' },
            { condition: (r) => r.contact.secondaryContactIds.length > 0, message: 'Should create secondary' }
        ]
    );
    await wait(500);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 8: ADDITIONAL EDGE CASES
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 8: ADDITIONAL EDGE CASES     ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Diamond Pattern
    console.log('\nSetting up diamond pattern...');
    await setupTest('Diamond 1', { email: 'diamond1@test.com', phoneNumber: 'D1' });
    await setupTest('Diamond 2', { email: 'diamond1@test.com', phoneNumber: 'D2' });
    await setupTest('Diamond 3', { email: 'diamond2@test.com', phoneNumber: 'D2' });
    
    await runTest(
        'Diamond Pattern Merge',
        { email: 'diamond2@test.com', phoneNumber: 'D1' },
        [
            { condition: (r) => r.contact && r.contact.emails.length === 2, message: 'Should have both emails' },
            { condition: (r) => r.contact.phoneNumbers.length === 2, message: 'Should have both phones' }
        ]
    );
    
    // ═══════════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.cyan + '\n\n╔═══════════════════════════════════════╗');
    console.log('║        TEST SUITE SUMMARY             ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    console.log(`Total Tests: ${testNumber}`);
    console.log(colors.green + `Passed: ${passedTests}` + colors.reset);
    console.log(colors.red + `Failed: ${failedTests}` + colors.reset);
    console.log(`Pass Rate: ${((passedTests/testNumber)*100).toFixed(1)}%`);
    
    if (failedTests === 0) {
        console.log(colors.green + '\n✨ ALL TESTS PASSED! ✨' + colors.reset);
        console.log('Your implementation correctly handles all Bitespeed requirements!');
        console.log('\n🚀 Ready for deployment!');
    } else {
        console.log(colors.red + '\n⚠️  SOME TESTS FAILED!' + colors.reset);
        console.log('Review the failed tests above and fix the issues.');
        console.log('\nCommon issues to check:');
        console.log('1. Primary contact selection (always choose the older one)');
        console.log('2. Proper linking when merging two primaries');
        console.log('3. Handling of null/empty values');
        console.log('4. Response format (arrays, correct field names)');
        console.log('5. Column name case sensitivity in PostgreSQL');
    }
    
    // View database state
    console.log('\n📋 To view current database state:');
    console.log(colors.yellow + 'node tests/check-db-pg.js' + colors.reset);
    
    // Close database connection
    await pool.end();
}

// Check if server is running before starting tests
async function checkServer() {
    try {
        const response = await fetch('http://localhost:3000/');
        if (response.ok) {
            return true;
        }
    } catch (error) {
        return false;
    }
    return false;
}

// Main execution
async function main() {
    console.log('Checking if server is running...');
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.log(colors.red + '\n❌ Server is not running!' + colors.reset);
        console.log('Please start your server first:');
        console.log(colors.yellow + 'npm run dev' + colors.reset);
        process.exit(1);
    }
    
    console.log(colors.green + '✓ Server is running!' + colors.reset);
    console.log('\nStarting tests in 3 seconds...');
    console.log(colors.yellow + '\n⚠️  WARNING: This will clean and recreate test data in your database!' + colors.reset);
    console.log('Press Ctrl+C now to cancel.\n');
    
    await wait(3000);
    
    runAllTests().catch(console.error);
}

main();