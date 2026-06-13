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

const firstNames = [
    'Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Ishaan', 'Kabir', 'Myra', 'Kiara', 'Saanvi', 
    'Aaryan', 'Advait', 'Anaya', 'Arjun', 'Ira', 'Ishani', 'Kavya', 'Krish', 'Mishka', 'Navya', 
    'Pranav', 'Rudra', 'Sai', 'Shaurya', 'Tanvi', 'Vanya', 'Zoya', 'Aditi', 'Akash', 'Amara', 
    'Ayaan', 'Bhavya', 'Chaitanya', 'Dev', 'Esha', 'Gaurav', 'Hritika', 'Indranil', 'Janhvi', 'Karan', 
    'Lakshmi', 'Manav', 'Nandini', 'Om', 'Pallavi', 'Rohan', 'Sneha', 'Tushar', 'Urvi', 'Yash'
];

const lastNames = [
    'Sharma', 'Verma', 'Gupta', 'Malhotra', 'Kapoor', 'Iyer', 'Reddy', 'Deshmukh', 'Kulkarni', 'Bose', 
    'Chatterjee', 'Mukherjee', 'Mehta', 'Nayar', 'Joshi', 'Patil', 'Sawant', 'Singh', 'Chauhan', 'Rao', 
    'Pillai', 'Saxena', 'Thapar', 'Bhatia', 'Gupta', 'Banerjee', 'Das', 'Pandey', 'Mishra', 'Trivedi'
];

const cities = [
    'Mumbai', 'Pune', 'Delhi', 'Nashik', 'Chennai', 'Bangalore', 'Hyderabad', 'Kolkata', 'Jaipur', 'Ahmedabad', 
    'Surat', 'Nagpur', 'Lucknow', 'Indore', 'Bhopal', 'Patna', 'Goa', 'Chandigarh', 'Amritsar', 'Kanpur', 
    'Varanasi', 'Noida', 'Gurgaon', 'Faridabad', 'Coimbatore', 'Madurai', 'Vizag', 'Trichy', 'Mysore', 'Udaipur', 
    'Jodhpur', 'Ranchi', 'Raipur', 'Dehradun', 'Shimla', 'Srinagar', 'Agra', 'Meerut', 'Gwalior', 'Jabalpur'
];

// Map cities to Branch_IDs (approximate based on my previous query)
const cityToBranch = {
    'Mumbai': 1, 'Pune': 2, 'Delhi': 3, 'Nashik': 4, 'Chennai': 5, 'Bangalore': 6, 'Hyderabad': 7, 
    'Kolkata': 8, 'Jaipur': 9, 'Ahmedabad': 10, 'Surat': 11, 'Nagpur': 12, 'Lucknow': 13, 'Indore': 14, 
    'Bhopal': 15, 'Patna': 16, 'Goa': 17, 'Chandigarh': 18, 'Amritsar': 19, 'Kanpur': 20, 
    'Varanasi': 21, 'Noida': 22, 'Gurgaon': 23, 'Faridabad': 24, 'Coimbatore': 25, 'Madurai': 26, 
    'Vizag': 27, 'Trichy': 28, 'Mysore': 29, 'Udaipur': 30, 'Jodhpur': 31, 'Ranchi': 32, 
    'Raipur': 33, 'Dehradun': 34, 'Shimla': 35, 'Srinagar': 36, 'Agra': 37, 'Meerut': 38, 
    'Gwalior': 39, 'Jabalpur': 40
};

function getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function bulkSeed() {
    try {
        console.log("🚀 Initializing NexaBank Sovereign Bulk Seeding Engine...");
        await sql.connect(config);
        
        const count = 350;
        console.log(`📡 Target Acquisition: ${count} New Customer Entities.`);

        for (let i = 1; i <= count; i++) {
            const firstName = getRandom(firstNames);
            const lastName = getRandom(lastNames);
            const fullName = `${firstName} ${lastName}`;
            const city = getRandom(cities);
            const branchId = cityToBranch[city] || 1;
            
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@nexabank.com`;
            const phone = `9${Math.floor(Math.random() * 900000000 + 100000000)}`;
            const pin = `${Math.floor(Math.random() * 9000 + 1000)}`;
            const cibil = Math.floor(Math.random() * (850 - 650 + 1)) + 650;
            const balance = Math.floor(Math.random() * (1500000 - 5000 + 1)) + 5000;
            const type = Math.random() > 0.3 ? 'Savings' : 'Current';
            const year = 1970 + Math.floor(Math.random() * 40);
            const month = Math.floor(Math.random() * 12) + 1;
            const day = Math.floor(Math.random() * 28) + 1;
            const dob = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
            
            // Generate arbitrary Aadhar
            const aadhar = `${Math.floor(1000 + Math.random() * 9000)}${Math.floor(1000 + Math.random() * 9000)}${Math.floor(1000 + Math.random() * 9000)}`;

            // 1. Insert Customer
            const custRes = await sql.query`
                INSERT INTO Customer (Name, Email, Phone, DOB, Address, PIN, CIBIL_Score, Aadhar_No)
                OUTPUT INSERTED.Customer_ID
                VALUES (${fullName}, ${email}, ${phone}, ${dob}, ${city}, ${pin}, ${cibil}, ${aadhar})
            `;
            const customerId = custRes.recordset[0].Customer_ID;

            // 2. Insert Account
            await sql.query`
                INSERT INTO Accounts (Customer_ID, Account_Type, Balance, Open_Date, Branch_ID, Account_Status)
                VALUES (${customerId}, ${type}, ${balance}, GETDATE(), ${branchId}, 'Active')
            `;

            if (i % 50 === 0) {
                console.log(`📦 Pulse: ${i}/${count} records synced to Sovereign DB...`);
            }
        }
        
        console.log("\n✨ BULK SEEDING COMPLETE! 350 new high-fidelity records added to NexaBank.");
    } catch (err) {
        console.error("❌ Fatal Error in Seeding Engine:", err.message);
    } finally {
        await sql.close();
    }
}

bulkSeed();
