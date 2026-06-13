const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: { encrypt: true, trustServerCertificate: true }
};

async function fixEmployeeIds() {
    try {
        console.log("🔧 Starting Employee_ID Fix Engine...");
        await sql.connect(config);

        // STEP 1: Update all NULL Employee_IDs by matching Branch_ID
        // For each transaction, assign the Employee whose Branch_ID matches.
        // If multiple employees per branch, pick the one with the lowest Emp_ID (primary teller).
        const result = await sql.query(`
            UPDATE T
            SET T.Employee_ID = E.Emp_ID
            FROM Transactions T
            INNER JOIN (
                SELECT Branch_ID, MIN(Emp_ID) AS Emp_ID
                FROM Employee
                GROUP BY Branch_ID
            ) E ON T.Branch_ID = E.Branch_ID
            WHERE T.Employee_ID IS NULL
        `);

        console.log(`✅ Fixed ${result.rowsAffected[0]} transactions with Employee_ID.`);

        // STEP 2: Check if any NULL still remain (transactions whose branch has no employee)
        const remaining = await sql.query("SELECT COUNT(*) as cnt FROM Transactions WHERE Employee_ID IS NULL");
        const leftover = remaining.recordset[0].cnt;

        if (leftover > 0) {
            console.log(`⚠️  ${leftover} transactions still have NULL Employee_ID (their branch has no employees). Assigning fallback Employee_ID = 1...`);
            await sql.query(`
                UPDATE Transactions 
                SET Employee_ID = 1
                WHERE Employee_ID IS NULL
            `);
            console.log("✅ Fallback assignment complete.");
        } else {
            console.log("🎯 All transactions now have a valid Employee_ID. No nulls remaining.");
        }

        // STEP 3: Final verification
        const verify = await sql.query(`
            SELECT COUNT(*) as total_txns, 
                   SUM(CASE WHEN Employee_ID IS NULL THEN 1 ELSE 0 END) as null_remaining
            FROM Transactions
        `);
        const v = verify.recordset[0];
        console.log(`\n📊 Final Report:`);
        console.log(`   Total Transactions : ${v.total_txns}`);
        console.log(`   NULL Employee_IDs  : ${v.null_remaining}`);
        console.log("\n✨ Employee_ID fix complete!");

    } catch (e) {
        console.error("❌ Error:", e.message);
    } finally {
        await sql.close();
    }
}

fixEmployeeIds();
