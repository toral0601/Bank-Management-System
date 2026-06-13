# 🏦 NexaBank — Bank Management System

A full-stack banking web application with **HTML/CSS/JS frontend**, **Node.js + Express backend**, and **MySQL database**.


# Screenshots 
<img width="1864" height="1076" alt="image" src="https://github.com/user-attachments/assets/6f2e0a53-c1b5-41a6-9ba5-8d8e39a38642" />
<img width="1896" height="1071" alt="image" src="https://github.com/user-attachments/assets/e4bbcfb2-bbf3-47b7-9d65-c5a02800fe78" />
<img width="1894" height="1101" alt="image" src="https://github.com/user-attachments/assets/5de95993-b811-41a6-8cd1-7c30be217e5f" />
<img width="1910" height="934" alt="image" src="https://github.com/user-attachments/assets/7e60bf3b-b8af-4110-bc89-dffbbacaf88b" />
<img width="1917" height="922" alt="image" src="https://github.com/user-attachments/assets/13856735-dca2-49b1-97b0-fa29305ff4c3" />
<img width="1911" height="1087" alt="image" src="https://github.com/user-attachments/assets/5c9cf447-c087-444d-9a6e-a2e4b6b2ec0f" />
<img width="1355" height="1010" alt="image" src="https://github.com/user-attachments/assets/21e33e37-720d-4cfe-b1df-73fce257d322" />
<img width="1889" height="1103" alt="image" src="https://github.com/user-attachments/assets/b862c878-d1b7-4afe-8712-54dc56d7b450" />
<img width="1919" height="1037" alt="image" src="https://github.com/user-attachments/assets/45497614-daa6-4e18-9df1-0af000337d3b" />
<img width="1913" height="977" alt="image" src="https://github.com/user-attachments/assets/37828e94-32b6-421e-8c53-0d025353400e" />
<img width="1529" height="780" alt="image" src="https://github.com/user-attachments/assets/5053ef00-f0b8-4c2f-bc5f-cb9898e17259" />
<img width="1917" height="1078" alt="image" src="https://github.com/user-attachments/assets/7e3ae6b3-ac06-4faf-993f-63e3575c50f7" />
<img width="1874" height="990" alt="image" src="https://github.com/user-attachments/assets/0077c9dd-d47f-4ffb-bfb4-f4b82875d803" />
<img width="1905" height="1066" alt="image" src="https://github.com/user-attachments/assets/8ec85f94-ccb7-4f78-bb5a-c7d382e8c062" />
<img width="1885" height="1077" alt="image" src="https://github.com/user-attachments/assets/9cbdb5dc-e43a-4ce3-b30e-62819bd865ff" />
<img width="1889" height="722" alt="image" src="https://github.com/user-attachments/assets/0942dc19-5006-4bc6-8f9f-b67c83c47eb2" />
<img width="1824" height="996" alt="image" src="https://github.com/user-attachments/assets/38d98217-6b0f-480a-a866-e05550ddd0c1" />


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
