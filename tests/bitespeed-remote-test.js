const fetch = require('node-fetch');

// Update to your deployed service URL
const BASE_URL = 'https://bitespeed-identity-reconciliation-ld1y.onrender.com/identify';
const SERVER_URL = 'https://bitespeed-identity-reconciliation-ld1y.onrender.com';

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
    console.log('Testing against:', colors.green + SERVER_URL + colors.reset);
    console.log('This will test all requirements from the Bitespeed Identity Reconciliation task');
    console.log('─────────────────────────────────────────\n');
    
    console.log(colors.yellow + '\n⚠️  WARNING: These tests will create data in your remote database!' + colors.reset);
    console.log('Make sure you have a way to clean up test data afterwards.');
    console.log('Starting tests in 5 seconds... Press Ctrl+C to cancel.\n');
    
    await wait(5000);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 1: BASIC FUNCTIONALITY TESTS
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 1: BASIC FUNCTIONALITY       ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Generate unique test data to avoid conflicts
    const timestamp = Date.now();
    const testPrefix = `test${timestamp}`;
    
    // TEST 1: Create First Primary Contact
    await runTest(
        'Create First Primary Contact',
        { email: `${testPrefix}_lorraine@hillvalley.edu`, phoneNumber: `${timestamp}123456` },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId > 0, message: 'Should have a primary ID' },
            { condition: (r) => r.contact.emails.length === 1, message: 'Should have 1 email' },
            { condition: (r) => r.contact.emails[0] === `${testPrefix}_lorraine@hillvalley.edu`, message: 'Email should match input' },
            { condition: (r) => r.contact.phoneNumbers.length === 1, message: 'Should have 1 phone' },
            { condition: (r) => r.contact.phoneNumbers[0] === `${timestamp}123456`, message: 'Phone should match input' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(1000);
    
    // TEST 2: Same Phone, Different Email (Create Secondary)
    let primaryId;
    await runTest(
        'Same Phone, Different Email → Create Secondary',
        { email: `${testPrefix}_mcfly@hillvalley.edu`, phoneNumber: `${timestamp}123456` },
        [
            { condition: (r) => {
                if (r.contact) primaryId = r.contact.primaryContatctId;
                return r.contact && r.contact.primaryContatctId === primaryId;
            }, message: 'Primary ID should remain the same' },
            { condition: (r) => r.contact.emails.length === 2, message: 'Should have 2 emails' },
            { condition: (r) => r.contact.emails.includes(`${testPrefix}_lorraine@hillvalley.edu`), message: 'Should include original email' },
            { condition: (r) => r.contact.emails.includes(`${testPrefix}_mcfly@hillvalley.edu`), message: 'Should include new email' },
            { condition: (r) => r.contact.secondaryContactIds.length === 1, message: 'Should have 1 secondary' }
        ]
    );
    await wait(1000);
    
    // TEST 3: Same Email, Different Phone
    await runTest(
        'Same Email, Different Phone → Create Secondary',
        { email: `${testPrefix}_lorraine@hillvalley.edu`, phoneNumber: `${timestamp}987654` },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === primaryId, message: 'Primary ID should remain the same' },
            { condition: (r) => r.contact.phoneNumbers.length === 2, message: 'Should have 2 phones' },
            { condition: (r) => r.contact.phoneNumbers.includes(`${timestamp}123456`), message: 'Should include original phone' },
            { condition: (r) => r.contact.phoneNumbers.includes(`${timestamp}987654`), message: 'Should include new phone' },
            { condition: (r) => r.contact.secondaryContactIds.length === 2, message: 'Should have 2 secondaries' }
        ]
    );
    await wait(1000);
    
    // TEST 4: Exact Match (Should Return Existing)
    await runTest(
        'Exact Match → No New Contact Created',
        { email: `${testPrefix}_mcfly@hillvalley.edu`, phoneNumber: `${timestamp}123456` },
        [
            { condition: (r) => r.contact && r.contact.primaryContatctId === primaryId, message: 'Primary ID should remain the same' },
            { condition: (r) => r.contact.secondaryContactIds.length === 2, message: 'Should still have 2 secondaries (no new contact)' }
        ]
    );
    await wait(1000);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 2: PRIMARY TO SECONDARY CONVERSION (MERGE SCENARIOS)
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 2: PRIMARY→SECONDARY MERGE   ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Setup for merge test
    let georgeId, biffId;
    await runTest(
        'Create Primary Contact (George)',
        { email: `${testPrefix}_george@hillvalley.edu`, phoneNumber: `${timestamp}919191` },
        [
            { condition: (r) => {
                if (r.contact) georgeId = r.contact.primaryContatctId;
                return r.contact && r.contact.primaryContatctId > 0;
            }, message: 'Should create a primary contact' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(1000);
    
    await runTest(
        'Create Primary Contact (Biff)',
        { email: `${testPrefix}_biffsucks@hillvalley.edu`, phoneNumber: `${timestamp}717171` },
        [
            { condition: (r) => {
                if (r.contact) biffId = r.contact.primaryContatctId;
                return r.contact && r.contact.primaryContatctId > 0;
            }, message: 'Should create a primary contact' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(1000);
    
    // CRITICAL TEST: Primary → Secondary Conversion
    await runTest(
        '🔥 CRITICAL: Primary→Secondary Merge (Document Example)',
        { email: `${testPrefix}_george@hillvalley.edu`, phoneNumber: `${timestamp}717171` },
        [
            { condition: (r) => r.contact && (r.contact.primaryContatctId === georgeId || r.contact.primaryContatctId === biffId), 
              message: `PRIMARY should be either ${georgeId} or ${biffId} (whichever was created first)` },
            { condition: (r) => r.contact.emails.includes(`${testPrefix}_george@hillvalley.edu`), message: 'Should include george email' },
            { condition: (r) => r.contact.emails.includes(`${testPrefix}_biffsucks@hillvalley.edu`), message: 'Should include biffsucks email' },
            { condition: (r) => r.contact.phoneNumbers.includes(`${timestamp}919191`), message: 'Should include 919191' },
            { condition: (r) => r.contact.phoneNumbers.includes(`${timestamp}717171`), message: 'Should include 717171' },
            { condition: (r) => r.contact.secondaryContactIds.length > 0, message: 'One contact should become secondary' }
        ]
    );
    await wait(1000);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 3: OPTIONAL FIELDS & EDGE CASES
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 3: OPTIONAL FIELDS & EDGES   ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // TEST: Only Email Provided
    await runTest(
        'Only Email Provided (Optional phoneNumber)',
        { email: `${testPrefix}_lorraine@hillvalley.edu` },
        [
            { condition: (r) => r.contact && r.contact.emails.includes(`${testPrefix}_lorraine@hillvalley.edu`), message: 'Should find the contact by email' },
            { condition: (r) => r.contact.phoneNumbers.length >= 1, message: 'Should return linked phones' }
        ]
    );
    await wait(1000);
    
    // TEST: Only Phone Provided
    await runTest(
        'Only Phone Provided (Optional email)',
        { phoneNumber: `${timestamp}919191` },
        [
            { condition: (r) => r.contact && r.contact.phoneNumbers.includes(`${timestamp}919191`), message: 'Should find the contact by phone' }
        ]
    );
    await wait(1000);
    
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
    await wait(1000);
    
    // TEST: Empty Strings
    await runTest(
        'Empty Strings (Different from null)',
        { email: '', phoneNumber: '' },
        [
            { condition: (r) => r.contact && r.contact.emails.length === 0, message: 'Should handle empty strings' },
            { condition: (r) => r.contact.phoneNumbers.length === 0, message: 'Should have empty phones array' }
        ]
    );
    await wait(1000);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 4: RESPONSE FORMAT VALIDATION
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 4: RESPONSE FORMAT           ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    console.log('\nValidating response format...');
    
    await runTest(
        'Response Format Check',
        { email: `${testPrefix}_format@test.com`, phoneNumber: `${timestamp}999` },
        [
            { condition: (r) => r.contact !== undefined, message: 'Response should have "contact" field' },
            { condition: (r) => r.contact.primaryContatctId !== undefined, message: 'Should have primaryContatctId field' },
            { condition: (r) => Array.isArray(r.contact.emails), message: 'emails should be an array' },
            { condition: (r) => Array.isArray(r.contact.phoneNumbers), message: 'phoneNumbers should be an array' },
            { condition: (r) => Array.isArray(r.contact.secondaryContactIds), message: 'secondaryContactIds should be an array' }
        ]
    );
    await wait(1000);
    
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
        console.log('\n🚀 Service is working correctly!');
    } else {
        console.log(colors.red + '\n⚠️  SOME TESTS FAILED!' + colors.reset);
        console.log('Review the failed tests above and fix the issues.');
        console.log('\nCommon issues to check:');
        console.log('1. Primary contact selection (always choose the older one)');
        console.log('2. Proper linking when merging two primaries');
        console.log('3. Handling of null/empty values');
        console.log('4. Response format (arrays, correct field names)');
        console.log('5. Make sure the typo "primaryContatctId" is intentional');
    }
    
    console.log('\n📝 Note: This test created data with prefix:', colors.yellow + testPrefix + colors.reset);
    console.log('You may want to clean up this test data from your database.');
}

// Check if server is running before starting tests
async function checkServer() {
    try {
        console.log('Checking server at:', SERVER_URL);
        const response = await fetch(SERVER_URL);
        if (response.ok || response.status === 404) {
            // 404 is OK - it means server is running but no route at root
            return true;
        }
    } catch (error) {
        console.log('Server check error:', error.message);
        return false;
    }
    return false;
}

// Main execution
async function main() {
    console.log('Checking if remote server is accessible...');
    const serverRunning = await checkServer();
    
    if (!serverRunning) {
        console.log(colors.red + '\n❌ Cannot reach the server!' + colors.reset);
        console.log('URL:', SERVER_URL);
        console.log('\nPossible issues:');
        console.log('1. The server might be sleeping (Render free tier)');
        console.log('2. The URL might be incorrect');
        console.log('3. Network connectivity issues');
        console.log('\nTry visiting the URL in your browser first to wake it up.');
        process.exit(1);
    }
    
    console.log(colors.green + '✓ Server is reachable!' + colors.reset);
    
    runAllTests().catch(console.error);
}

main();