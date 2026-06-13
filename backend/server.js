
console.log("🔥 NEW SERVER FILE RUNNING");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
require("dotenv").config();

const { poolPromise, sql } = require("./db"); //database connection ko import kiya
const db_mysql = require("./db_mysql"); // Added MySQL connection for SQL interface

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

// ADMIN AUTH MIDDLEWARE
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: "Forbidden: Invalid token" });
        req.admin = user;
        next();
    });
};

app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, "public");
const frontendPath = path.join(__dirname, "..", "frontend");

// Serve the actual bank login frontend first, then fall back to legacy backend public files
app.use(express.static(frontendPath));
app.use(express.static(publicPath));

app.get(["/", "/login"], (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

// AUTO-SETUP ADMIN TABLE (Defensive)
async function ensureAdminTable() {
    try {
        const pool = await poolPromise;
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AdminUsers')
            BEGIN
                CREATE TABLE AdminUsers (
                    Admin_ID INT PRIMARY KEY IDENTITY,
                    Email NVARCHAR(100) UNIQUE,
                    Password NVARCHAR(100),
                    Name NVARCHAR(100)
                );
                INSERT INTO AdminUsers (Email, Password, Name) 
                VALUES ('admin@nexabank.com', 'Admin@123', 'System Administrator');
            END
        `);
        console.log("🛡️ Admin Auth Table Verified");
    } catch (err) {
        console.error("⚠️ Admin Auto-Setup Warning:", err.message);
    }
}
ensureAdminTable();
async function ensureHelpTable() {
    try {
        const pool = await poolPromise;
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HelpRequests')
            BEGIN
                CREATE TABLE HelpRequests (
                    Request_ID INT PRIMARY KEY IDENTITY,
                    Customer_ID INT,
                    Name NVARCHAR(100),
                    Subject NVARCHAR(200),
                    Message NVARCHAR(MAX),
                    Status NVARCHAR(50) DEFAULT 'Pending',
                    Category NVARCHAR(100),
                    Resolution_Note NVARCHAR(MAX),
                    Resolved_By NVARCHAR(100),
                    Resolved_At DATETIME,
                    Created_At DATETIME DEFAULT GETDATE()
                );
            END
        `);
        console.log("🆘 Help Requests Table Verified");
    } catch (err) {
        console.error("⚠️ Help Auto-Setup Warning:", err.message);
    }
}
ensureHelpTable();

// GET CUSTOMERS
app.get("/customers", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query("SELECT * FROM Customer");
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching customers");
    }
});

// LOGIN
app.post("/login", async (req, res) => {
    const { account_no, pin } = req.body;

    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input("account_no", sql.Int, account_no)
            .input("pin", sql.VarChar, pin)
            .query(`
    SELECT 
        a.Account_No,
        a.Balance,
        a.Account_Type,
        a.Open_Date,
        c.Customer_ID,
        c.Name,
        c.Email,
        c.Phone,
        c.Address,
        c.CIBIL_Score,
        b.Branch_Name,
        b.IFSC_Code
    FROM Accounts a
    JOIN Customer c ON a.Customer_ID = c.Customer_ID
    LEFT JOIN Branch b ON a.Branch_ID = b.Branch_ID
    WHERE a.Account_No = @account_no AND c.PIN = @pin
`);

        if (result.recordset.length === 0) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        let userRecord = result.recordset[0];
        let penaltyApplied = false;
        let penaltyAmount = 500;

        // LOW BALANCE PENALTY SYSTEM
        if (userRecord.Balance < 5000) {
            // Check if penalized today
            const checkPenalty = await pool.request()
                .input("account_no", sql.Int, account_no)
                .query(`
                    SELECT COUNT(*) as cnt 
                    FROM Transactions 
                    WHERE Account_No = @account_no 
                      AND Mode = 'Penalty' 
                      AND CAST(Transaction_Date as Date) = CAST(GETDATE() as Date)
                `);
            
            if (checkPenalty.recordset[0].cnt === 0) {
                // Deduct Penalty
                await pool.request()
                    .input("amount", sql.Decimal(12,2), penaltyAmount)
                    .input("account_no", sql.Int, account_no)
                    .query(`UPDATE Accounts SET Balance = Balance - @amount WHERE Account_No = @account_no`);
                
                // Record Transaction
                await pool.request()
                    .input("account_no", sql.Int, account_no)
                    .input("customer_id", sql.Int, userRecord.Customer_ID)
                    .input("amount", sql.Decimal(12,2), penaltyAmount)
                    .input("branch_id", sql.Int, userRecord.Branch_ID || 1)
                    .input("mode", sql.VarChar, 'Penalty')
                    .query(`
                        INSERT INTO Transactions (Account_No, Customer_ID, Amount, Transaction_Type, Branch_ID, Mode, Status, Transaction_Date)
                        VALUES (@account_no, @customer_id, @amount, 'Withdrawal', @branch_id, @mode, 'Success', GETDATE())
                    `);

                userRecord.Balance -= penaltyAmount;
                penaltyApplied = true;
            }
        }

        const token = jwt.sign(
            { id: userRecord.Customer_ID, account_no: userRecord.Account_No },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token: token,
            data: userRecord,
            penaltyInfo: penaltyApplied ? { amount: penaltyAmount, reason: 'Low balance penalty (below ₹5,000)' } : null
        });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Login error" });
    }
});


// CREATE ACCOUNT
app.post("/account/create", async (req, res) => {
    console.log("🔥 Deposit API called", req.body);
    const { name, email, phone, dob, address, pin, account_type, initial_deposit } = req.body;

    try {
        const pool = await poolPromise;

        // 1. Insert Customer
        const customer = await pool.request()
            .input("Name", sql.VarChar, name)
            .input("Email", sql.VarChar, email)
            .input("Phone", sql.VarChar, phone)
            .input("DOB", sql.Date, dob)
            .input("Address", sql.VarChar, address)
            .input("PIN", sql.VarChar, pin)
            .query(`
                INSERT INTO Customer (Name, Email, Phone, DOB, Address, PIN)
                OUTPUT INSERTED.Customer_ID
                VALUES (@Name, @Email, @Phone, @DOB, @Address, @PIN)
            `);

        const customerId = customer.recordset[0].Customer_ID;

        // 2. Assign Branch randomly from all available branches
const branches = await pool.request().query(`
    SELECT Branch_ID FROM Branch
`);

if (branches.recordset.length === 0) {
    return res.json({ success: false, message: "No branches available" });
}

// Randomly select a branch
const randomBranch = branches.recordset[Math.floor(Math.random() * branches.recordset.length)];
const branchId = randomBranch.Branch_ID;

        // 3. Create Account
        const account = await pool.request()
            .input("Customer_ID", sql.Int, customerId)
            .input("Account_Type", sql.VarChar, account_type)
            .input("Balance", sql.Decimal(12,2), initial_deposit)
            .input("Branch_ID", sql.Int, branchId)
            .query(`
                INSERT INTO Accounts (Customer_ID, Account_Type, Balance, Open_Date, Branch_ID)
                OUTPUT INSERTED.Account_No
                VALUES (@Customer_ID, @Account_Type, @Balance, GETDATE(), @Branch_ID)
            `);

        res.json({
            success: true,
            data: { account_no: account.recordset[0].Account_No }
        });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Account creation failed" });
    }
});
// UPDATE PROFILE
app.put("/account/update", async (req, res) => {
    const { account_no, name, email, phone, address } = req.body;

    try {
        const pool = await poolPromise;

        await pool.request()
            .input("account_no", sql.Int, account_no)
            .input("name", sql.VarChar, name)
            .input("email", sql.VarChar, email)
            .input("phone", sql.VarChar, phone)
            .input("address", sql.VarChar, address)
            .query(`
                UPDATE Customer
                SET Name = @name,
                    Email = @email,
                    Phone = @phone,
                    Address = @address
                WHERE Customer_ID = (
                    SELECT Customer_ID FROM Accounts WHERE Account_No = @account_no
                )
            `);

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Update failed" });
    }
});

//Deposit
app.post("/deposit", async (req, res) => {
    console.log("🔥 Deposit API called", req.body);

    // Add mode to your destructured req.body at the top of the route:
const { account_no, amount, mode } = req.body;

    try {
        const pool = await poolPromise;

        // ✅ STEP 1: Get Customer_ID & Branch_ID
        const acc = await pool.request()
            .input("account_no", sql.Int, parseInt(account_no))
            .query(`
                SELECT Customer_ID, Branch_ID 
                FROM Accounts 
                WHERE Account_No = @account_no
            `);

        console.log("ACC RESULT:", acc.recordset);

        if (acc.recordset.length === 0) {
            return res.json({ success: false, message: "Account not found" });
        }

        const customerId = acc.recordset[0].Customer_ID;
        const branchId = acc.recordset[0].Branch_ID;

        // ✅ STEP 2: Update Balance
        await pool.request()
            .input("amount", sql.Decimal(12,2), amount)
            .input("account_no", sql.Int, parseInt(account_no))
            .query(`
                UPDATE Accounts
                SET Balance = Balance + @amount
                WHERE Account_No = @account_no
            `);

        // ✅ STEP 3: Insert Transaction (CORRECT)
        await pool.request()
    .input("account_no", sql.Int, parseInt(account_no))
    .input("customer_id", sql.Int, customerId)
    .input("amount", sql.Decimal(12,2), amount)
    .input("branch_id", sql.Int, branchId)
    .input("mode", sql.VarChar, mode || 'Cash') // Bind the mode variable
    .query(`
        INSERT INTO Transactions 
        (Account_No, Customer_ID, Amount, Transaction_Type, Branch_ID, Mode, Status, Transaction_Date)
        VALUES 
        (@account_no, @customer_id, @amount, 'Deposit', @branch_id, @mode, 'Success', GETDATE())
    `);

        console.log("✅ Transaction inserted");

        // ✅ STEP 4: Get Updated Balance
        const result = await pool.request()
            .input("account_no", sql.Int, parseInt(account_no))
            .query(`
                SELECT Balance FROM Accounts WHERE Account_No = @account_no
            `);

        // Trigger real-time sync broadcast
        await broadcastUserState(customerId, account_no);

        res.json({
            success: true,
            data: { new_balance: result.recordset[0].Balance }
        });

    } catch (err) {
    console.error("❌ Deposit Error:", err);
    res.json({ success: false, message: "Deposit failed" });
}
});

// Withdraw
app.post("/withdraw", async (req, res) => {
    console.log("💸 Withdraw API called", req.body);

    const { account_no, amount, mode } = req.body;

    try {
        const pool = await poolPromise;

        // ✅ STEP 1: Get Account Details & Check Balance
        const acc = await pool.request()
            .input("account_no", sql.Int, parseInt(account_no))
            .query(`
                SELECT Customer_ID, Branch_ID, Balance 
                FROM Accounts 
                WHERE Account_No = @account_no
            `);

        if (acc.recordset.length === 0) {
            return res.json({ success: false, message: "Account not found" });
        }

        const { Customer_ID, Branch_ID, Balance } = acc.recordset[0];

        // ✅ STEP 2: Business Logic - Check for sufficient funds!
        if (Balance < amount) {
            return res.json({ success: false, message: "Insufficient balance for this withdrawal." });
        }

        // ✅ STEP 3: Deduct Balance
        await pool.request()
            .input("amount", sql.Decimal(12,2), amount)
            .input("account_no", sql.Int, parseInt(account_no))
            .query(`
                UPDATE Accounts
                SET Balance = Balance - @amount
                WHERE Account_No = @account_no
            `);

        // Update Step 4 in your /withdraw route:
        await pool.request()
            .input("account_no", sql.Int, parseInt(account_no))
            .input("customer_id", sql.Int, Customer_ID)
            .input("amount", sql.Decimal(12,2), amount)
            .input("branch_id", sql.Int, Branch_ID)
            .input("mode", sql.VarChar, mode || 'ATM') 
            .query(`
                INSERT INTO Transactions 
                (Account_No, Customer_ID, Amount, Transaction_Type, Branch_ID, Mode, Status, Transaction_Date, Employee_ID)
                VALUES 
                (@account_no, @customer_id, @amount, 'Withdraw', @branch_id, @mode, 'Success', GETDATE(), NULL) 
            `);
            // Note: Added Employee_ID and NULL to the lists above

        console.log("✅ Withdrawal Transaction inserted");

        // ✅ STEP 5: Get Updated Balance
        const result = await pool.request()
            .input("account_no", sql.Int, parseInt(account_no))
            .query(`
                SELECT Balance FROM Accounts WHERE Account_No = @account_no
            `);

        // Trigger real-time sync broadcast
        await broadcastUserState(Customer_ID, account_no);

        res.json({
            success: true,
            data: { new_balance: result.recordset[0].Balance }
        });

    } catch (err) {
        console.error("❌ Withdraw Error:", err);
        res.json({ success: false, message: "Withdrawal failed" });
    }
});

// ==========================================
// LOANS API (Add to server.js)
// ==========================================

// Apply for Loan
app.post("/loans/apply", async (req, res) => {
    const { account_no, customer_id, loan_type, loan_amount, tenure } = req.body;
    
    let interest_rate = 10.5; 
    if (loan_type === 'Home') interest_rate = 8.5;
    if (loan_type === 'Car') interest_rate = 9.2;
    if (loan_type === 'Education') interest_rate = 7.5;

    try {
        const pool = await poolPromise;

        // 1. Insert Loan
        await pool.request()
            .input("customer_id", sql.Int, customer_id)
            .input("type", sql.VarChar, loan_type)
            .input("amount", sql.Decimal(15,2), loan_amount)
            .input("rate", sql.Decimal(5,2), interest_rate)
            .input("tenure", sql.Int, tenure)
            .query(`
                INSERT INTO Loan (Customer_ID, Loan_Type, Loan_Amount, Interest_Rate, Tenure, Start_Date, Status)
                VALUES (@customer_id, @type, @amount, @rate, @tenure, GETDATE(), 'Active')
            `);

        // 2. Deposit Loan amount to Account
        await pool.request()
            .input("amount", sql.Decimal(15,2), loan_amount)
            .input("account_no", sql.Int, account_no)
            .query(`UPDATE Accounts SET Balance = Balance + @amount WHERE Account_No = @account_no`);

        // 3. Record Transaction
        await pool.request()
            .input("account_no", sql.Int, account_no)
            .input("customer_id", sql.Int, customer_id)
            .input("amount", sql.Decimal(15,2), loan_amount)
            .query(`
                INSERT INTO Transactions (Account_No, Customer_ID, Amount, Transaction_Type, Mode, Status, Transaction_Date)
                VALUES (@account_no, @customer_id, @amount, 'Deposit', 'Loan Transfer', 'Success', GETDATE())
            `);

        // 4. Return new balance
        const balReq = await pool.request().input("account_no", sql.Int, account_no).query(`SELECT Balance FROM Accounts WHERE Account_No = @account_no`);
        
        // Trigger real-time sync broadcast
        await broadcastUserState(customer_id, account_no);

        res.json({ success: true, data: { new_balance: balReq.recordset[0].Balance } });

    } catch (err) {
        console.error("❌ Loan Apply Error:", err);
        res.json({ success: false, message: "Loan application failed" });
    }
});

// Get User Loans
app.get("/loans/:customer_id", async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("customer_id", sql.Int, req.params.customer_id)
            .query(`SELECT * FROM Loan WHERE Customer_ID = @customer_id ORDER BY Start_Date DESC`);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ Fetch Loans Error:", err);
        res.json({ success: false });
    }
});

app.get("/transactions/:acno", async (req, res) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input("account_no", sql.Int, parseInt(req.params.acno))
            .query(`
                SELECT * FROM Transactions
                WHERE Account_No = @account_no
                ORDER BY Transaction_ID DESC
            `);

        res.json({
            success: true,
            data: result.recordset
        });

    } catch (err) {
        console.error("❌ Transaction Fetch Error:", err);
        res.json({ success: false });
    }
});


// ==========================================
// ADMIN DASHBOARD API
// ==========================================

// Get all tables in the current SQL Server database
app.get("/admin/tables", authenticateAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error("❌ Admin Fetch Tables Error:", err);
        res.json({ success: false, message: "Error fetching tables" });
    }
});

// Run a query (used for fetching a specific table dynamically)
app.post("/admin/query", authenticateAdmin, async (req, res) => {
    try {
        const { tableName } = req.body;
        
        if (!tableName) return res.json({ success: false, message: "Table name required" });

        const pool = await poolPromise;
        const safeTable = tableName.replace(/[[\]]/g, ''); 

        // Use TOP 50 as requested for optimized dynamic loading
        let result = await pool.request().query(`SELECT TOP 50 * FROM [${safeTable}]`);
        
        res.json({ success: true, data: result.recordsets || result.recordset });
    } catch (err) {
        console.error("❌ Admin Table Query Error:", err);
        res.json({ success: false, message: "Error executing query: " + err.message });
    }
});

// ==========================================
// INVESTMENT PORTAL API (MS SQL DB)
// ==========================================

app.get("/api/investments", async (req, res) => {
    const { customer_id } = req.query;
    
    try {
        const pool = await poolPromise;
        let query = `
            SELECT 
                Investment_ID, Customer_ID, Investment_Type as Investment_type, Amount, 
                FORMAT(Investment_Date, 'yyyy-MM-dd') as Date, 
                Returns, Status 
            FROM Investment
        `;
        
        if (customer_id) {
            const result = await pool.request()
                .input("customer_id", sql.Int, parseInt(customer_id))
                .query(query + ` WHERE Customer_ID = @customer_id ORDER BY Investment_Date DESC`);
            return res.json({ success: true, data: result.recordset });
        } else {
            const result = await pool.request().query(query + ` ORDER BY Investment_Date DESC`);
            return res.json({ success: true, data: result.recordset });
        }
    } catch (err) {
        console.error("❌ Fetch Investments Error:", err);
        res.json({ success: false, message: "Server error fetching investments." });
    }
});

app.post("/api/investments", async (req, res) => {
    const { Investment_type, Amount, Customer_ID } = req.body;
    
    if (!Investment_type || !Amount || !Customer_ID) {
        return res.json({ success: false, message: "Type, Amount, and Customer ID are required." });
    }

    try {
        const pool = await poolPromise;
        const amountNum = parseFloat(Amount);

        // 1. Check Account Balance
        const accInfo = await pool.request()
            .input("customer_id", sql.Int, parseInt(Customer_ID))
            .query(`SELECT Account_No, Balance, Branch_ID FROM Accounts WHERE Customer_ID = @customer_id`);

        if (accInfo.recordset.length === 0) {
            return res.json({ success: false, message: "No bank account found for this customer." });
        }

        const { Account_No, Balance, Branch_ID } = accInfo.recordset[0];

        if (Balance < amountNum) {
            return res.status(400).json({ 
                success: false, 
                message: `Investment cannot proceed: Insufficient balance. Current balance is ₹${parseFloat(Balance).toLocaleString('en-IN')}, but you tried to invest ₹${amountNum.toLocaleString('en-IN')}.` 
            });
        }

        // 2. Process Investment
        // Deduct Balance
        await pool.request()
            .input("amount", sql.Decimal(12,2), amountNum)
            .input("account_no", sql.Int, Account_No)
            .query(`UPDATE Accounts SET Balance = Balance - @amount WHERE Account_No = @account_no`);

        // Record Investment
        const returns = amountNum * 0.08; 
        const result = await pool.request()
            .input("customer_id", sql.Int, parseInt(Customer_ID))
            .input("inv_type", sql.VarChar, Investment_type)
            .input("amount", sql.Decimal(12,2), amountNum)
            .input("returns", sql.Decimal(12,2), returns)
            .input("status", sql.VarChar, 'Active')
            .query(`
                INSERT INTO Investment (Customer_ID, Investment_Type, Amount, Investment_Date, Returns, Status)
                OUTPUT 
                    INSERTED.Investment_ID, INSERTED.Customer_ID, 
                    INSERTED.Investment_Type as Investment_type, INSERTED.Amount, 
                    FORMAT(INSERTED.Investment_Date, 'yyyy-MM-dd') as Date, 
                    INSERTED.Returns, INSERTED.Status
                VALUES (@customer_id, @inv_type, @amount, GETDATE(), @returns, @status)
            `);

        // Record Transaction
        await pool.request()
            .input("account_no", sql.Int, Account_No)
            .input("customer_id", sql.Int, parseInt(Customer_ID))
            .input("amount", sql.Decimal(12,2), amountNum)
            .input("branch_id", sql.Int, Branch_ID || 1)
            .query(`
                INSERT INTO Transactions (Account_No, Customer_ID, Amount, Transaction_Type, Branch_ID, Mode, Status, Transaction_Date)
                VALUES (@account_no, @customer_id, @amount, 'Withdraw', @branch_id, 'Investment', 'Success', GETDATE())
            `);

        // Trigger real-time sync broadcast
        await broadcastUserState(Customer_ID, Account_No);

        res.json({ 
            success: true, 
            data: result.recordset[0], 
            new_balance: Balance - amountNum,
            message: "Investment secured and funds deducted successfully!" 
        });

    } catch (err) {
        console.error("❌ Investment Processing Error:", err);
        res.json({ success: false, message: "Server error: Failed to process investment." });
    }
});


// LOAN DRAFTS (Omnichannel support)
app.post("/api/loans/draft", async (req, res) => {
    const { customer_id, draft_data } = req.body;
    try {
        const pool = await poolPromise;
        // Upsert logic
        await pool.request()
            .input("customer_id", sql.Int, customer_id)
            .input("draft_json", sql.NVarChar, JSON.stringify(draft_data))
            .query(`
                IF EXISTS (SELECT 1 FROM Loan_Drafts WHERE Customer_ID = @customer_id)
                    UPDATE Loan_Drafts SET Draft_Data = @draft_json, Last_Updated = GETDATE() WHERE Customer_ID = @customer_id
                ELSE
                    INSERT INTO Loan_Drafts (Customer_ID, Draft_Data) VALUES (@customer_id, @draft_json)
            `);
        res.json({ success: true, message: "Draft synced to NexaCloud" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Sync failed" });
    }
});

app.get("/api/loans/draft/:customer_id", async (req, res) => {
    const { customer_id } = req.params;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("customer_id", sql.Int, customer_id)
            .query("SELECT Draft_Data FROM Loan_Drafts WHERE Customer_ID = @customer_id");
        
        if (result.recordset.length > 0) {
            res.json({ success: true, data: JSON.parse(result.recordset[0].Draft_Data) });
        } else {
            res.json({ success: false, message: "No cloud draft found" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error fetching draft" });
    }
});


// ADMIN AUTHENTICATION
app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("email", sql.NVarChar, email)
            .input("password", sql.NVarChar, password)
            .query("SELECT * FROM AdminUsers WHERE Email = @email AND Password = @password");

        if (result.recordset.length > 0) {
            const admin = result.recordset[0];
            const token = jwt.sign({ id: admin.Admin_ID, email: admin.Email }, JWT_SECRET, { expiresIn: '8h' });
            res.json({ success: true, token, admin: { Name: admin.Name, Email: admin.Email } });
        } else {
            res.json({ success: false, message: "Unauthorized Sovereign Access" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Auth Engine Error" });
    }
});

// RAW SQL EXECUTION (High Authority)
app.post("/api/admin/raw-sql", authenticateAdmin, async (req, res) => {
    const { query } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(query);
        res.json({ success: true, data: result.recordset || result.recordsets || "Command executed successfully" });
    } catch (err) {
        console.error("❌ SQL execution Error:", err);
        res.json({ success: false, message: err.message });
    }
});

/**
 * EXPLICIT ADMIN SQL INTERFACE (User Requested)
 * Accepts a 'sqlQuery' string and uses MySQL connection pool.
 */
app.post("/api/admin/execute-sql", authenticateAdmin, (req, res) => {
    const { sqlQuery } = req.body;

    if (!sqlQuery) {
        return res.status(400).json({ success: false, message: "No SQL query provided" });
    }

    db_mysql.query(sqlQuery, (err, results) => {
        if (err) {
            console.error("❌ SQL Error:", err.message);
            return res.status(500).json({ success: false, message: err.message });
        }

        const upperQuery = sqlQuery.trim().toUpperCase();
        const isSelect = upperQuery.startsWith("SELECT") || upperQuery.startsWith("SHOW") || upperQuery.startsWith("DESCRIBE");

        if (isSelect) {
            // If it's a SELECT query, return results as a JSON array
            return res.json({ success: true, data: results });
        } else {
            // For INSERT, UPDATE, DELETE, return affectedRows
            return res.json({
                success: true,
                message: "Query executed successfully",
                affectedRows: results.affectedRows,
                insertId: results.insertId
            });
        }
    });
});

// SYSTEM STATS
app.get("/api/admin/stats", authenticateAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const stats = await pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM Customer) as total_users,
                (SELECT SUM(Balance) FROM Accounts) as total_deposits,
                (SELECT COUNT(*) FROM Loan WHERE Status = 'Active') as active_loans,
                (SELECT COUNT(*) FROM Transactions WHERE CAST(Transaction_Date as Date) = CAST(GETDATE() as Date)) as today_txns
        `);
        res.json({ success: true, data: stats.recordset[0] });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// HELP REQUESTS API
app.post("/api/help/submit", async (req, res) => {
    const { customer_id, name, subject, message } = req.body;
    if (!customer_id || !subject || !message) {
        return res.json({ success: false, message: "Missing required fields" });
    }
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("customer_id", sql.Int, customer_id)
            .input("name", sql.NVarChar, name)
            .input("subject", sql.NVarChar, subject)
            .input("message", sql.NVarChar, message)
            .query(`
                INSERT INTO HelpRequests (Customer_ID, Name, Subject, Message)
                VALUES (@customer_id, @name, @subject, @message)
            `);
        res.json({ success: true, message: "Help request submitted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error submitting help request" });
    }
});

app.get("/api/admin/help-requests", authenticateAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT * FROM HelpRequests 
            WHERE Status = 'Pending' 
            ORDER BY Created_At DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error fetching help requests" });
    }
});

app.put("/api/admin/resolve-help", authenticateAdmin, async (req, res) => {
    const { request_id, note, category, admin_name } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("id", sql.Int, request_id)
            .input("note", sql.NVarChar, note)
            .input("category", sql.NVarChar, category)
            .input("admin", sql.NVarChar, admin_name)
            .query(`
                UPDATE HelpRequests 
                SET Status = 'Resolved', 
                    Resolution_Note = @note, 
                    Category = @category, 
                    Resolved_By = @admin,
                    Resolved_At = GETDATE()
                WHERE Request_ID = @id
            `);
        res.json({ success: true, message: "Request marked as resolved" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error resolving request" });
    }
});

app.get("/api/admin/help-archive", authenticateAdmin, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT * FROM HelpRequests 
            WHERE Status = 'Resolved' 
            ORDER BY Resolved_At DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error fetching help archive" });
    }
});

// NEW POLLING ENDPOINT FOR ACCOUNT BALANCE FALLBACK
app.get("/api/account/balance/:acno", async (req, res) => {
    try {
        const pool = await poolPromise;
        const accountNo = parseInt(req.params.acno);
        
        // Fetch balance
        const accResult = await pool.request()
            .input("account_no", sql.Int, accountNo)
            .query("SELECT Balance, Customer_ID FROM Accounts WHERE Account_No = @account_no");
            
        if (accResult.recordset.length === 0) {
            return res.json({ success: false, message: "Account not found" });
        }
        
        const balance = accResult.recordset[0].Balance;
        const customerId = accResult.recordset[0].Customer_ID;

        // Fetch recent transactions
        const txResult = await pool.request()
            .input("account_no", sql.Int, accountNo)
            .query("SELECT TOP 5 * FROM Transactions WHERE Account_No = @account_no ORDER BY Transaction_ID DESC");
            
        res.json({
            success: true,
            balance: balance,
            recentTransactions: txResult.recordset,
            customerId: customerId
        });
    } catch (err) {
        console.error("❌ Polling Fallback Error:", err);
        res.json({ success: false, message: "Error fetching account balance" });
    }
});

// WEBSOCKET SERVER SETUP
const activeConnections = new Map(); // Customer_ID -> Set<WebSocket>

const wss = new WebSocket.Server({ 
    noServer: true,
    handleProtocols: (protocols) => {
        return 'nexa-auth';
    }
});

// Broadcast helper for account state updates
async function broadcastUserState(customerId, accountNo) {
    try {
        const pool = await poolPromise;
        
        // Fetch balance
        const accResult = await pool.request()
            .input("account_no", sql.Int, parseInt(accountNo))
            .query("SELECT Balance FROM Accounts WHERE Account_No = @account_no");
            
        if (accResult.recordset.length === 0) return;
        const balance = accResult.recordset[0].Balance;

        // Fetch recent transactions (top 5)
        const txResult = await pool.request()
            .input("account_no", sql.Int, parseInt(accountNo))
            .query("SELECT TOP 5 * FROM Transactions WHERE Account_No = @account_no ORDER BY Transaction_ID DESC");

        const payload = JSON.stringify({
            type: "STATE_UPDATE",
            balance: balance,
            recentTransactions: txResult.recordset
        });

        const userSockets = activeConnections.get(parseInt(customerId)) || activeConnections.get(customerId.toString());
        if (userSockets) {
            for (const client of userSockets) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                }
            }
        }
    } catch (err) {
        console.error("❌ Error in broadcastUserState:", err);
    }
}

wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
        ws.isAlive = true;
    });

    const customerId = ws.user.id;
    if (!activeConnections.has(customerId)) {
        activeConnections.set(customerId, new Set());
    }
    activeConnections.get(customerId).add(ws);

    console.log(`🔌 WebSocket connection established for customer ID ${customerId}`);

    ws.on("close", () => {
        const userSockets = activeConnections.get(customerId);
        if (userSockets) {
            userSockets.delete(ws);
            if (userSockets.size === 0) {
                activeConnections.delete(customerId);
            }
        }
        console.log(`🔌 WebSocket connection closed for customer ID ${customerId}`);
    });

    ws.on("error", (err) => {
        console.error(`❌ WebSocket error for customer ID ${customerId}:`, err);
    });
});

// 30-second ping/pong heartbeat to clean up dead sockets
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`🔌 Dead connection found for customer ${ws.user?.id || "unknown"}. Terminating.`);
            if (ws.user && ws.user.id) {
                const userSockets = activeConnections.get(ws.user.id);
                if (userSockets) {
                    userSockets.delete(ws);
                    if (userSockets.size === 0) {
                        activeConnections.delete(ws.user.id);
                    }
                }
            }
            return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on("close", () => {
    clearInterval(interval);
});

// WRAP EXPRESS APP IN HTTP SERVER
const server = http.createServer(app);

// Handle HTTP upgrade request manually for subprotocol validation
server.on("upgrade", (request, socket, head) => {
    const protocolHeader = request.headers["sec-websocket-protocol"];
    if (!protocolHeader) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
    }

    const parts = protocolHeader.split(",").map(p => p.trim());
    const nexaAuthIdx = parts.indexOf("nexa-auth");
    if (nexaAuthIdx === -1 || parts.length < 2) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
    }

    const token = parts[nexaAuthIdx === 0 ? 1 : 0];
    if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
            ws.user = decoded;
            wss.emit("connection", ws, request);
        });
    });
});

// START SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});