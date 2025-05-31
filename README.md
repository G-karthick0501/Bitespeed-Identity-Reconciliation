
# Bitespeed Identity Reconciliation

Backend service for linking customer identities across multiple purchases.

## Live API

https://bitespeed-identity-reconciliation-ld1y.onrender.com/identify

## Description

This service helps track customers who use different emails or phone numbers for different purchases. It links these identities by finding shared contact information.

## API Usage

### Endpoint
POST /identify

### Request
```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

### Response
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": []
  }
}
```

## Installation

1. Clone the repository
```
git clone https://github.com/G-karthick0501/Bitespeed-Identity-Reconciliation.git
```

2. Install dependencies
```
npm install
```

3. Set up environment variables
```
DATABASE_URL=postgresql://user:pass@localhost:5432/bitespeed
PORT=3000
```

4. Run the server
```
npm run dev
```

## How It Works

- New contact: Creates primary contact
- Partial match: Creates secondary contact  
- Full match: Returns existing contact
- Merge: Older contact stays primary

## Testing

Run tests with:
```
node tests/test.js
```

## Technologies

- Node.js
- TypeScript
- Express.js
- PostgreSQL

## Author

Karthick G

---
