Bitespeed Identity Reconciliation
Identity reconciliation service for linking customer contacts.
API
Live URL: https://bitespeed-identity-reconciliation-ld1y.onrender.com/identify
Method: POST
Request:
json{
  "email": "test@example.com",
  "phoneNumber": "1234567890"
}
Response:
json{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["test@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}
Setup

Clone repo
Run npm install
Create .env with your database URL
Run npm run dev

How it works

Links contacts with same email OR phone
Oldest contact becomes primary
Others become secondary
Prevents duplicates

Testing
node tests/test.js
Stack
Node.js, TypeScript, Express, PostgreSQL

By Karthick G
