const BASE_URL = 'http://localhost:3000/identify';

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
    console.log('Input:', input);
    
    try {
        const result = await makeRequest(input);
        console.log('Response:', JSON.stringify(result, null, 2));
        
        // Run validation checks
        let passed = true;
        for (const check of expectedChecks) {
            if (!check.condition(result)) {
                console.log(colors.red + `✗ Failed: ${check.message}` + colors.reset);
                passed = false;
            }
        }
        
        if (passed) {
            console.log(colors.green + `✓ Test passed!` + colors.reset);
            passedTests++;
        } else {
            failedTests++;
        }
        
        return result;
    } catch (error) {
        console.log(colors.red + `✗ Error: ${error.message}` + colors.reset);
        failedTests++;
        return null;
    }
}

async function runAllTests() {
    console.log(colors.cyan + '\n🧪 COMPLETE BITESPEED TEST SUITE - ALL SEGMENTS\n' + colors.reset);
    
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
            { condition: (r) => r.contact.primaryContatctId === 1, message: 'Primary ID should be 1' },
            { condition: (r) => r.contact.emails.length === 1, message: 'Should have 1 email' },
            { condition: (r) => r.contact.phoneNumbers.length === 1, message: 'Should have 1 phone' },
            { condition: (r) => r.contact.secondaryContactIds.length === 0, message: 'Should have no secondaries' }
        ]
    );
    await wait(300);
    
    // TEST 2: Same Phone, Different Email (Create Secondary)
    await runTest(
        'Same Phone, Different Email → Create Secondary',
        { email: 'mcfly@hillvalley.edu', phoneNumber: '123456' },
        [
            { condition: (r) => r.contact.primaryContatctId === 1, message: 'Primary ID should remain 1' },
            { condition: (r) => r.contact.emails.length === 2, message: 'Should have 2 emails' },
            { condition: (r) => r.contact.secondaryContactIds.includes(2), message: 'Should have secondary ID 2' }
        ]
    );
    await wait(300);
    
    // TEST 3: Same Email, Different Phone
    await runTest(
        'Same Email, Different Phone → Create Secondary',
        { email: 'lorraine@hillvalley.edu', phoneNumber: '987654' },
        [
            { condition: (r) => r.contact.primaryContatctId === 1, message: 'Primary ID should remain 1' },
            { condition: (r) => r.contact.phoneNumbers.length === 2, message: 'Should have 2 phones' },
            { condition: (r) => r.contact.secondaryContactIds.length === 2, message: 'Should have 2 secondaries' }
        ]
    );
    await wait(300);
    
    // TEST 4: Exact Match (Should Return Existing)
    await runTest(
        'Exact Match → No New Contact Created',
        { email: 'mcfly@hillvalley.edu', phoneNumber: '123456' },
        [
            { condition: (r) => r.contact.secondaryContactIds.length === 2, message: 'Should still have 2 secondaries (no new contact)' }
        ]
    );
    await wait(300);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 2: MERGE SCENARIOS
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 2: MERGE SCENARIOS           ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Setup for merge test
    await runTest(
        'Create Primary Contact (George)',
        { email: 'george@hillvalley.edu', phoneNumber: '919191' },
        [
            { condition: (r) => r.contact.primaryContatctId === 4, message: 'Primary ID should be 4' }
        ]
    );
    await wait(300);
    
    await runTest(
        'Create Primary Contact (Biff)',
        { email: 'biffsucks@hillvalley.edu', phoneNumber: '717171' },
        [
            { condition: (r) => r.contact.primaryContatctId === 5, message: 'Primary ID should be 5' }
        ]
    );
    await wait(300);
    
    // CRITICAL TEST: Primary → Secondary Conversion
    await runTest(
        '🔥 CRITICAL: Primary→Secondary Merge (Doc Example)',
        { email: 'george@hillvalley.edu', phoneNumber: '717171' },
        [
            { condition: (r) => r.contact.primaryContatctId === 4, message: '❗ PRIMARY MUST BE 4 (older), NOT 5!' },
            { condition: (r) => r.contact.emails.includes('george@hillvalley.edu'), message: 'Should include george email' },
            { condition: (r) => r.contact.emails.includes('biffsucks@hillvalley.edu'), message: 'Should include biffsucks email' },
            { condition: (r) => r.contact.phoneNumbers.includes('919191'), message: 'Should include 919191' },
            { condition: (r) => r.contact.phoneNumbers.includes('717171'), message: 'Should include 717171' },
            { condition: (r) => r.contact.secondaryContactIds.includes(5), message: 'Contact 5 should become secondary' }
        ]
    );
    await wait(300);
    
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
            { condition: (r) => r.contact.primaryContatctId === 1, message: 'Should find contact 1' },
            { condition: (r) => r.contact.phoneNumbers.length === 2, message: 'Should return all linked phones' }
        ]
    );
    await wait(300);
    
    // TEST: Only Phone Provided
    await runTest(
        'Only Phone Provided (Optional email)',
        { phoneNumber: '919191' },
        [
            { condition: (r) => r.contact.primaryContatctId === 4, message: 'Should find merged contact 4' }
        ]
    );
    await wait(300);
    
    // TEST: Both Fields Null
    await runTest(
        'Both Fields Null',
        { email: null, phoneNumber: null },
        [
            { condition: (r) => r.contact.emails.length === 0, message: 'Should have empty emails' },
            { condition: (r) => r.contact.phoneNumbers.length === 0, message: 'Should have empty phones' }
        ]
    );
    await wait(300);
    
    // TEST: Empty Strings
    await runTest(
        'Empty Strings (Different from null)',
        { email: '', phoneNumber: '' },
        [
            { condition: (r) => r.contact.emails.length === 0, message: 'Should handle empty strings' }
        ]
    );
    await wait(300);
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 4: RESPONSE FORMAT VALIDATION
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 4: RESPONSE FORMAT           ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    console.log('\nValidating primary contact appears first in arrays...');
    
    // Setup for ordering test
    await makeRequest({ email: 'primary@order.com', phoneNumber: '5555' });
    await makeRequest({ email: 'secondary1@order.com', phoneNumber: '5555' });
    await makeRequest({ email: 'secondary2@order.com', phoneNumber: '5555' });
    
    await runTest(
        'Response Ordering - Primary First',
        { phoneNumber: '5555' },
        [
            { condition: (r) => r.contact.emails[0] === 'primary@order.com', message: 'First email must be from primary contact' },
            { condition: (r) => r.contact.phoneNumbers[0] === '5555', message: 'First phone must be from primary contact' }
        ]
    );
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 5: COMPLEX MERGE SCENARIOS
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 5: COMPLEX MERGES            ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Chain Merge Test
    console.log('\nSetting up chain merge scenario...');
    await makeRequest({ email: 'a@chain.com', phoneNumber: '111' });
    await makeRequest({ email: 'b@chain.com', phoneNumber: '111' });
    await makeRequest({ email: 'c@chain.com', phoneNumber: '333' });
    
    await runTest(
        'Chain Merge - Secondary\'s Primary Gets Merged',
        { email: 'a@chain.com', phoneNumber: '333' },
        [
            { condition: (r) => r.contact.emails.length === 3, message: 'Should have all 3 emails after chain merge' }
        ]
    );
    await wait(300);
    
    // Three-way merge
    console.log('\nSetting up three-way merge...');
    await makeRequest({ email: 'x@three.com', phoneNumber: '777' });
    await makeRequest({ email: 'y@three.com', phoneNumber: '888' });
    await makeRequest({ email: 'z@three.com', phoneNumber: '999' });
    await makeRequest({ email: 'x@three.com', phoneNumber: '888' });
    
    await runTest(
        'Three-way Merge - All Primaries Linked',
        { email: 'y@three.com', phoneNumber: '999' },
        [
            { condition: (r) => r.contact.emails.length === 3, message: 'Should merge all 3 primaries' },
            { condition: (r) => r.contact.phoneNumbers.length === 3, message: 'Should have all 3 phones' }
        ]
    );
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 6: STRESS TESTS
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 6: STRESS TESTS              ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    console.log('\nTesting large chain...');
    await makeRequest({ email: 'chain@stress.com', phoneNumber: '10000' });
    
    for (let i = 1; i <= 10; i++) {
        await makeRequest({ email: `chain${i}@stress.com`, phoneNumber: '10000' });
    }
    
    await runTest(
        'Large Chain - 11 Contacts Linked',
        { phoneNumber: '10000' },
        [
            { condition: (r) => r.contact.emails.length === 11, message: 'Should have 11 emails' },
            { condition: (r) => r.contact.secondaryContactIds.length === 10, message: 'Should have 10 secondaries' }
        ]
    );
    
    // ═══════════════════════════════════════════════════════════════
    // SEGMENT 7: BITESPEED DOCUMENT EXAMPLES
    // ═══════════════════════════════════════════════════════════════
    console.log(colors.magenta + '\n╔═══════════════════════════════════════╗');
    console.log('║  SEGMENT 7: DOCUMENT EXAMPLES         ║');
    console.log('╚═══════════════════════════════════════╝' + colors.reset);
    
    // Clear and recreate exact examples from document
    console.log('\nRecreating exact examples from Bitespeed document...');
    
    // Example 1 from document
    await makeRequest({ email: 'doc.brown@future.com', phoneNumber: '88888' });
    
    await runTest(
        'Document Example - Secondary Creation',
        { email: 'emmett@time.com', phoneNumber: '88888' },
        [
            { condition: (r) => r.contact.emails.includes('doc.brown@future.com'), message: 'Should include first email' },
            { condition: (r) => r.contact.emails.includes('emmett@time.com'), message: 'Should include second email' },
            { condition: (r) => r.contact.secondaryContactIds.length > 0, message: 'Should create secondary' }
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
    } else {
        console.log(colors.red + '\n⚠️  SOME TESTS FAILED!' + colors.reset);
        console.log('Review the failed tests above and fix the issues.');
    }
    
    console.log('\n📋 To view final database state:');
    console.log(colors.yellow + 'node tests/check-db.js' + colors.reset);
}

// Run everything
console.log('Starting comprehensive test suite...');
console.log('Make sure your server is running on http://localhost:3000');
console.log('─────────────────────────────────────────\n');

runAllTests().catch(console.error);