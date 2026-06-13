const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

const customers = [
    { name: 'Ishaan Sharma', email: 'ishaan.s@nexa.com', phone: '9812345678', dob: '1992-05-12', address: 'Delhi', pin: '4455', cibil: 785, branch_id: 3, type: 'Savings', balance: 450000 },
    { name: 'Ananya Iyer', email: 'ananya.i@nexa.com', phone: '9823456781', dob: '1995-10-22', address: 'Chennai', pin: '1122', cibil: 740, branch_id: 5, type: 'Current', balance: 125000 },
    { name: 'Advait Deshmukh', email: 'advait.d@nexa.com', phone: '9834567812', dob: '1988-03-15', address: 'Mumbai', pin: '9988', cibil: 810, branch_id: 1, type: 'Savings', balance: 890000 },
    { name: 'Kavya Reddy', email: 'kavya.r@nexa.com', phone: '9845678123', dob: '1994-12-01', address: 'Hyderabad', pin: '7766', cibil: 720, branch_id: 7, type: 'Current', balance: 65000 },
    { name: 'Kabir Malhotra', email: 'kabir.m@nexa.com', phone: '9856781234', dob: '1990-07-18', address: 'Jaipur', pin: '5544', cibil: 765, branch_id: 9, type: 'Savings', balance: 320000 },
    { name: 'Diya Bose', email: 'diya.b@nexa.com', phone: '9867812345', dob: '1997-02-28', address: 'Kolkata', pin: '3322', cibil: 790, branch_id: 8, type: 'Current', balance: 154000 },
    { name: 'Aryan Kulkarni', email: 'aryan.k@nexa.com', phone: '9878123456', dob: '1993-09-05', address: 'Pune', pin: '1144', cibil: 755, branch_id: 2, type: 'Savings', balance: 275000 },
    { name: 'Zara Khan', email: 'zara.k@nexa.com', phone: '9889123457', dob: '1996-06-20', address: 'Bangalore', pin: '8877', cibil: 735, branch_id: 6, type: 'Savings', balance: 410000 },
    { name: 'Reyansh Chauhan', email: 'reyansh.c@nexa.com', phone: '9890123458', dob: '1991-11-10', address: 'Ahmedabad', pin: '6655', cibil: 805, branch_id: 10, type: 'Current', balance: 95000 },
    { name: 'Shanaya Kapoor', email: 'shanaya.k@nexa.com', phone: '9811123459', dob: '1998-08-14', address: 'Chandigarh', pin: '4433', cibil: 770, branch_id: 18, type: 'Savings', balance: 210000 },
    { name: 'Vivaan Mehra', email: 'vivaan.m@nexa.com', phone: '9822123460', dob: '1989-04-25', address: 'Lucknow', pin: '2211', cibil: 745, branch_id: 13, type: 'Current', balance: 88000 },
    { name: 'Saanvi Gupta', email: 'saanvi.g@nexa.com', phone: '9833123461', dob: '1995-12-30', address: 'Indore', pin: '0099', cibil: 820, branch_id: 14, type: 'Savings', balance: 560000 },
    { name: 'Rudra Singh', email: 'rudra.s@nexa.com', phone: '9844123462', dob: '1992-01-15', address: 'Patna', pin: '8899', cibil: 715, branch_id: 16, type: 'Current', balance: 42000 },
    { name: 'Myra Varma', email: 'myra.v@nexa.com', phone: '9855123463', dob: '1994-05-08', address: 'Bhopal', pin: '6677', cibil: 760, branch_id: 15, type: 'Savings', balance: 335000 },
    { name: 'Atharv Joshi', email: 'atharv.j@nexa.com', phone: '9866123464', dob: '1990-10-12', address: 'Goa', pin: '4455', cibil: 795, branch_id: 17, type: 'Current', balance: 198000 },
    { name: 'Kiara Saxena', email: 'kiara.s@nexa.com', phone: '9877123465', dob: '1997-07-04', address: 'Gurgaon', pin: '2233', cibil: 750, branch_id: 23, type: 'Savings', balance: 620000 },
    { name: 'Ayaan Mukherjee', email: 'ayaan.m@nexa.com', phone: '9888123466', dob: '1993-02-22', address: 'Varanasi', pin: '0011', cibil: 730, branch_id: 21, type: 'Current', balance: 74000 },
    { name: 'Navya Pandey', email: 'navya.p@nexa.com', phone: '9899123467', dob: '1996-09-11', address: 'Noida', pin: '8800', cibil: 815, branch_id: 22, type: 'Savings', balance: 485000 },
    { name: 'Shaurya Thapar', email: 'shaurya.t@nexa.com', phone: '9811223344', dob: '1991-03-31', address: 'Shimla', pin: '6600', cibil: 768, branch_id: 35, type: 'Current', balance: 112000 },
    { name: 'Inaya Bhatia', email: 'inaya.b@nexa.com', phone: '9822334455', dob: '1998-11-05', address: 'Udaipur', pin: '4400', cibil: 782, branch_id: 30, type: 'Savings', balance: 295000 }
];

async function seedData() {
    try {
        console.log("🚀 Starting NexaBank Data Seeding...");
        await sql.connect(config);
        
        for (const c of customers) {
            // 1. Insert Customer
            const customerResult = await sql.query`
                INSERT INTO Customer (Name, Email, Phone, DOB, Address, PIN, CIBIL_Score)
                OUTPUT INSERTED.Customer_ID
                VALUES (${c.name}, ${c.email}, ${c.phone}, ${c.dob}, ${c.address}, ${c.pin}, ${c.cibil})
            `;
            
            const customerId = customerResult.recordset[0].Customer_ID;
            
            // 2. Insert Account
            await sql.query`
                INSERT INTO Accounts (Customer_ID, Account_Type, Balance, Open_Date, Branch_ID, Account_Status)
                VALUES (${customerId}, ${c.type}, ${c.balance}, GETDATE(), ${c.branch_id}, 'Active')
            `;
            
            console.log(`✅ Seeded: ${c.name} (Customer_ID: ${customerId})`);
        }
        
        console.log("\n✨ Data Seeding Complete! 20 new customers and accounts added.");
    } catch (err) {
        console.error("❌ Seeding Error:", err.message);
    } finally {
        await sql.close();
    }
}

seedData();
