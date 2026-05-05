# AgricbyLovely API Documentation

Base URL: `http://localhost:8001/api`

All protected routes require this header:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

All responses follow this shape:
```json
{ "success": true, "message": "...", "data": {} }
{ "success": false, "message": "..." }
```

---

## Auth Routes — /api/auth

### Register
`POST /api/auth/register`

Request body:
```json
{
  "email": "farmer@example.com",
  "password": "password123",
  "firstName": "Adewale",
  "lastName": "Ogun",
  "farmName": "Lovely Farms",
  "phone": "08012345678",
  "state": "Ogun",
  "soilType": "LOAMY",
  "farmSizeHa": 4.5,
  "latitude": 6.8923,
  "longitude": 3.4672
}
```
Response: farmer object + accessToken + refreshToken

---

### Login
`POST /api/auth/login`

Request body:
```json
{
  "email": "farmer@example.com",
  "password": "password123"
}
```
Response: farmer object + accessToken + refreshToken

---

### Refresh Token
`POST /api/auth/refresh`

Request body:
```json
{ "refreshToken": "YOUR_REFRESH_TOKEN" }
```
Response: new accessToken

---

### Logout
`POST /api/auth/logout` — Protected

Response: success message

---

## Farmer Routes — /api/farmers/me (all protected)

### Get Profile
`GET /api/farmers/me`

Response: full farmer profile with field and crop counts

---

### Update Profile
`PUT /api/farmers/me`

Request body (all fields optional):
```json
{
  "firstName": "Adewale",
  "farmName": "New Farm Name",
  "state": "Lagos",
  "soilType": "SANDY",
  "farmSizeHa": 6.0
}
```

---

### Change Password
`PUT /api/farmers/me/password`

Request body:
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

---

### Delete Account
`DELETE /api/farmers/me`

Permanently deletes account and all associated data.

---

## Health Check

### Server Health
`GET /api/health`

Response:
```json
{
  "success": true,
  "message": "AgricbyLovely API is running",
  "database": "connected"
}
```

---

## Soil Types (valid values)
`CLAY` `SANDY` `LOAMY` `SILTY` `PEATY` `CHALKY`

## Coming soon
- `GET /api/crops` — browse crop encyclopedia
- `GET /api/weather` — farmer's local forecast
- `GET /api/calendar` — planting calendar
- `GET /api/notifications` — alerts
- `GET /api/reports/summary` — dashboard data