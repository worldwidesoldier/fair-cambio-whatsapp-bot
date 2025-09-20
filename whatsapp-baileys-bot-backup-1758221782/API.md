# Fair Câmbio Dashboard API Documentation

## Overview

The Fair Câmbio Dashboard provides a comprehensive REST API for managing WhatsApp bot operations, currency rates, branches, statistics, and administrative functions.

**Base URL:** `http://localhost:3000/api`

## Authentication

All API endpoints (except login and health check) require authentication using JWT tokens.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## API Endpoints

### Authentication

#### POST /auth/login
Login to the dashboard.

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "1",
    "username": "admin",
    "name": "Administrador",
    "role": "admin",
    "permissions": ["all"]
  },
  "message": "Login realizado com sucesso"
}
```

#### POST /auth/logout
Logout from the dashboard.

#### POST /auth/refresh
Refresh the JWT token.

#### GET /auth/profile
Get current user profile.

#### PUT /auth/profile
Update current user profile.

### Dashboard Overview

#### GET /dashboard/overview
Get dashboard overview statistics.

**Response:**
```json
{
  "conversationsToday": 25,
  "activeUsers": 150,
  "branchesOnline": 3,
  "totalBranches": 5,
  "lastRateUpdate": "2025-01-15T10:30:00.000Z",
  "recentActivity": [...]
}
```

#### GET /dashboard/status
Get system status information.

#### GET /health
Health check endpoint (no authentication required).

### Currency Rates Management

#### GET /rates
Get all currency rates.

**Response:**
```json
{
  "currencies": {
    "USD": {
      "name": "Dólar Americano",
      "emoji": "🇺🇸",
      "buy": 5.1500,
      "sell": 5.3500
    },
    "EUR": {
      "name": "Euro",
      "emoji": "🇪🇺",
      "buy": 5.6200,
      "sell": 5.8200
    }
  },
  "lastUpdate": "2025-01-15T10:30:00.000Z"
}
```

#### POST /rates/update
Update a specific currency rate.

**Permissions:** admin, manager

**Request:**
```json
{
  "currency": "USD",
  "type": "buy",
  "value": 5.2000
}
```

#### POST /rates/bulk-update
Update multiple currency rates at once.

**Permissions:** admin

**Request:**
```json
{
  "updates": [
    {
      "currency": "USD",
      "type": "buy",
      "value": 5.2000
    },
    {
      "currency": "USD",
      "type": "sell",
      "value": 5.4000
    }
  ]
}
```

#### GET /rates/history
Get currency rate update history.

**Query Parameters:**
- `limit` (number): Number of records to return (default: 50)

#### GET /rates/statistics
Get currency rate statistics.

### Branches Management

#### GET /branches
Get all branches.

#### GET /branches/:id
Get specific branch by ID.

#### POST /branches
Create a new branch.

**Permissions:** admin

**Request:**
```json
{
  "name": "Fair Câmbio - Nova Filial",
  "phone": "559185009999",
  "address": "Av. Nova, 123 - Centro, Manaus/AM",
  "hours": {
    "weekdays": "09:00 às 18:00",
    "saturday": "09:00 às 14:00",
    "sunday": "Fechado"
  },
  "maps": "https://maps.google.com/?q=-3.1319,-60.0231",
  "active": true
}
```

#### PUT /branches/:id
Update a branch.

**Permissions:** admin

#### DELETE /branches/:id
Delete a branch.

**Permissions:** admin

#### POST /branches/:id/toggle
Toggle branch active status.

**Permissions:** admin

### Statistics

#### GET /stats/conversations
Get conversation statistics.

**Query Parameters:**
- `period` (string): Time period (1d, 7d, 30d, 90d) - default: 7d

#### GET /stats/users
Get user statistics.

#### GET /stats/analytics
Get comprehensive analytics.

**Query Parameters:**
- `period` (string): Time period - default: 30d

#### GET /stats/reports
Generate reports.

**Query Parameters:**
- `type` (string): Report type (daily, weekly, monthly) - default: weekly

### Broadcast System

#### POST /broadcast/send
Send broadcast message.

**Permissions:** admin, manager

**Request:**
```json
{
  "message": "Olá! Esta é uma mensagem de teste.",
  "target": {
    "type": "active",
    "days": 7
  },
  "priority": "normal"
}
```

**Target Types:**
- `all`: All users
- `active`: Active users (specify days)
- `recent`: Recent users (last 24h)
- `custom`: Custom phone number list
- `branches`: Specific branches

#### GET /broadcast/history
Get broadcast history.

#### GET /broadcast/templates
Get broadcast templates.

#### POST /broadcast/templates
Create broadcast template.

**Permissions:** admin

### User Management

#### GET /admin/users
Get all users.

**Permissions:** admin

#### POST /admin/users
Create new user.

**Permissions:** admin

**Request:**
```json
{
  "username": "manager1",
  "name": "Manager",
  "email": "manager@faircambio.com",
  "password": "password123",
  "role": "manager",
  "permissions": ["read", "rates", "broadcast"]
}
```

#### PUT /admin/users/:id
Update user.

**Permissions:** admin

#### DELETE /admin/users/:id
Delete user.

**Permissions:** admin

#### POST /admin/users/:id/toggle
Toggle user active status.

**Permissions:** admin

### Backup and Restore

#### GET /backup/create
Create backup.

**Permissions:** admin

**Query Parameters:**
- `type` (string): Backup type (full, config, data, logs) - default: full
- `description` (string): Optional backup description

#### POST /backup/restore
Restore from backup.

**Permissions:** admin

**Request:**
```json
{
  "backupId": "backup-full-2025-01-15T10-30-00-000Z",
  "options": {
    "skipCurrentBackup": false,
    "skipLogs": false,
    "skipSessions": false
  }
}
```

#### GET /backup/list
List all backups.

**Permissions:** admin

#### DELETE /backup/:id
Delete backup.

**Permissions:** admin

## WebSocket Events

The dashboard uses Socket.IO for real-time updates. Connect to the dashboard WebSocket with authentication:

```javascript
const socket = io({
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Subscribing to Updates

```javascript
socket.emit('subscribe-rates');
socket.emit('subscribe-stats');
socket.emit('subscribe-branches');
```

### Event Types

#### rates
Currency rate updates.
```json
{
  "currency": "USD",
  "type": "buy",
  "value": 5.2000,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### stats
Statistics updates.

#### branches
Branch status updates.

#### notification
System notifications.
```json
{
  "type": "success",
  "title": "Sucesso",
  "message": "Operação realizada com sucesso"
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/endpoint"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited to 100 requests per 15 minutes per IP address.

## CORS

The API supports CORS for the configured dashboard origin (default: http://localhost:3000).

## Security Features

- JWT authentication
- Password hashing with bcrypt
- Request rate limiting
- CORS protection
- Helmet.js security headers
- Input validation and sanitization

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

// Login
const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
  username: 'admin',
  password: 'password'
});

const token = loginResponse.data.token;

// Get rates
const ratesResponse = await axios.get('http://localhost:3000/api/rates', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

console.log(ratesResponse.data);
```

### Python

```python
import requests

# Login
login_response = requests.post('http://localhost:3000/api/auth/login', json={
    'username': 'admin',
    'password': 'password'
})

token = login_response.json()['token']

# Get rates
rates_response = requests.get('http://localhost:3000/api/rates', headers={
    'Authorization': f'Bearer {token}'
})

print(rates_response.json())
```

### cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' | jq -r '.token')

# Get rates
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/rates
```