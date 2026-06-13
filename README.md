# 🏦 NexaBank — Bank Management System

A full-stack banking web application with **HTML/CSS/JS frontend**, **Node.js + Express backend**, and **MySQL database**.

---

## 📁 Project Structure

```
bank-app/
├── frontend/
│   └── index.html          ← Single-page banking UI
├── backend/
│   ├── server.js           ← Express REST API
│   ├── db.js               ← MySQL connection pool
│   ├── package.json
│   └── .env                ← DB credentials (edit this!)
└── database/
    └── schema.sql          ← Tables + seed data
```

---

## ✅ Prerequisites

| Tool    | Version  | Install |
|---------|----------|---------|
| Node.js | v18+     | https://nodejs.org |
| MySQL   | v8+      | https://dev.mysql.com/downloads/ |

---

## 🚀 Step-by-Step Setup

### Step 1 — Set up the Database

1. Open **MySQL Workbench** or terminal.
2. Run the schema file:
   ```sql
   source /path/to/bank-app/database/schema.sql;
   ```
   Or copy-paste the contents into MySQL Workbench and execute.

3. This creates `bank_db` with all tables and 6 sample customers + accounts.

### Step 2 — Configure Backend

1. Open `backend/.env` and fill in your MySQL credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=YOUR_MYSQL_PASSWORD_HERE
   DB_NAME=bank_db
   DB_PORT=3306
   PORT=5000
   ```

### Step 3 — Install & Start the Backend

```bash
cd bank-app/backend
npm install
npm start
```

You should see:
```
✅  MySQL connected successfully
🏦  Bank API running on http://localhost:5000
```

### Step 4 — Open the Frontend

Simply open `frontend/index.html` in your browser:
- Double-click the file, OR
- Right-click → Open With → Chrome / Firefox / Edge

> ⚠️ The frontend talks to `http://localhost:5000` — keep the backend terminal running.

---

## 🔑 Demo Login Credentials

| Account No | PIN  | Customer     | Balance   |
|-----------|------|--------------|-----------|
| 1         | 1234 | Aarav Shah   | ₹1,25,000 |
| 2         | 2345 | Priya Nair   | ₹88,000   |
| 3         | 3456 | Rohit Gupta  | ₹2,00,000 |
| 4         | 4567 | Sneha Joshi  | ₹5,00,000 |
| 5         | 5678 | Vikram Rao   | ₹45,000   |
| 6         | 6789 | Meera Pillai | ₹30,000   |

---

## 🔌 REST API Reference

| Method | Endpoint                       | Description              |
|--------|-------------------------------|--------------------------|
| POST   | `/api/login`                  | Login with account + PIN |
| GET    | `/api/account/:account_no`    | Get account details      |
| POST   | `/api/account/create`         | Open new account         |
| PUT    | `/api/account/update`         | Update profile           |
| POST   | `/api/deposit`                | Deposit money            |
| POST   | `/api/withdraw`               | Withdraw money           |
| GET    | `/api/transactions/:acno`     | Transaction history      |
| GET    | `/api/loans/:customer_id`     | View loans               |
| GET    | `/api/branches`               | List all branches        |
| GET    | `/api/health`                 | Server health check      |

### Example API calls (curl):

```bash
# Login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"account_no": 1, "pin": "1234"}'

# Deposit
curl -X POST http://localhost:5000/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"account_no": 1, "amount": 5000, "mode": "UPI"}'

# Withdraw
curl -X POST http://localhost:5000/api/withdraw \
  -H "Content-Type: application/json" \
  -d '{"account_no": 1, "amount": 1000, "mode": "ATM"}'
```

---

## 🧩 Features

- ✅ Login with Account Number + PIN
- ✅ Dashboard with live balance & account details
- ✅ Deposit money (updates DB instantly)
- ✅ Withdraw money (with balance validation)
- ✅ Full transaction history table
- ✅ Update profile (name, email, phone, address)
- ✅ View loans
- ✅ Open new account (self-registration)
- ✅ Toast notifications for all actions
- ✅ No page reloads — all via fetch/AJAX
- ✅ Prepared statements (SQL injection safe)
- ✅ Transaction rollback on errors

---

## 🛠 Troubleshooting

| Problem | Solution |
|---------|----------|
| `MySQL connection failed` | Check `.env` credentials |
| `CORS error` in browser | Make sure backend is on port 5000 |
| `Cannot reach server` | Run `npm start` in `backend/` folder |
| `ER_DUP_ENTRY` | Email already exists — use a different one |
| Blank page | Open browser console (F12) for errors |

---

## 🔒 Production Notes

- Replace plain-text PINs with `bcrypt` hashing
- Add JWT tokens for session management
- Use HTTPS in production
- Add rate limiting (e.g., `express-rate-limit`)
