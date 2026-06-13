-- ============================================================
-- BANK MANAGEMENT SYSTEM — MySQL Schema & Seed Data
-- ============================================================

CREATE DATABASE IF NOT EXISTS bank_db;
USE bank_db;

-- ------------------------------------------------------------
-- BRANCH
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Branch (
    Branch_ID   INT PRIMARY KEY AUTO_INCREMENT,
    Branch_Name VARCHAR(100),
    IFSC_Code   VARCHAR(20),
    Location    VARCHAR(100)
);

-- ------------------------------------------------------------
-- CUSTOMER
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Customer (
    Customer_ID INT PRIMARY KEY AUTO_INCREMENT,
    Name        VARCHAR(100) NOT NULL,
    DOB         DATE,
    Address     VARCHAR(200),
    Phone       VARCHAR(15),
    Email       VARCHAR(100) UNIQUE,
    Aadhar_No   VARCHAR(20),
    CIBIL_Score INT DEFAULT 700,
    PIN         VARCHAR(6) NOT NULL DEFAULT '1234'   -- 4–6 digit PIN (stored as text; hash in production!)
);

-- ------------------------------------------------------------
-- EMPLOYEE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Employee (
    Emp_ID    INT PRIMARY KEY AUTO_INCREMENT,
    Name      VARCHAR(100),
    Role      VARCHAR(50),
    Phone_No  VARCHAR(15),
    Salary    DECIMAL(10,2),
    Hire_Date DATE,
    Branch_ID INT,
    FOREIGN KEY (Branch_ID) REFERENCES Branch(Branch_ID)
);

-- ------------------------------------------------------------
-- ACCOUNTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Accounts (
    Account_No     INT PRIMARY KEY AUTO_INCREMENT,
    Customer_ID    INT NOT NULL,
    Account_Type   ENUM('Savings','Current','FD','RD') DEFAULT 'Savings',
    Balance        DECIMAL(12,2) DEFAULT 0.00,
    Open_Date      DATE,
    Account_Status ENUM('Active','Closed','Frozen') DEFAULT 'Active',
    Branch_ID      INT,
    FOREIGN KEY (Customer_ID) REFERENCES Customer(Customer_ID),
    FOREIGN KEY (Branch_ID)   REFERENCES Branch(Branch_ID),
    CHECK (Balance >= 0)
);

-- ------------------------------------------------------------
-- TRANSACTION
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Transactions (
    Transaction_ID   INT PRIMARY KEY AUTO_INCREMENT,
    Account_No       INT NOT NULL,
    Customer_ID      INT NOT NULL,
    Amount           DECIMAL(12,2) NOT NULL,
    Transaction_Type ENUM('Deposit','Withdraw','Transfer','EMI') NOT NULL,
    Mode             VARCHAR(20) DEFAULT 'Online',
    Status           ENUM('Success','Failed','Pending') DEFAULT 'Success',
    Transaction_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Emp_ID           INT,
    Branch_ID        INT,
    FOREIGN KEY (Account_No)  REFERENCES Accounts(Account_No),
    FOREIGN KEY (Customer_ID) REFERENCES Customer(Customer_ID),
    FOREIGN KEY (Branch_ID)   REFERENCES Branch(Branch_ID)
);

-- ------------------------------------------------------------
-- LOAN
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Loan (
    Loan_ID       INT PRIMARY KEY AUTO_INCREMENT,
    Customer_ID   INT NOT NULL,
    Loan_Type     VARCHAR(50),
    Loan_Amount   DECIMAL(12,2),
    Interest_Rate FLOAT,
    Tenure        INT,
    Start_Date    DATE,
    Status        VARCHAR(20) DEFAULT 'Active',
    FOREIGN KEY (Customer_ID) REFERENCES Customer(Customer_ID)
);

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO Branch (Branch_Name, IFSC_Code, Location) VALUES
('Mumbai Main',   'HDFC0001', 'Mumbai'),
('Pune Central',  'HDFC0002', 'Pune'),
('Delhi HQ',      'HDFC0003', 'Delhi'),
('Nashik Branch', 'HDFC0004', 'Nashik');

INSERT INTO Employee (Name, Role, Phone_No, Salary, Hire_Date, Branch_ID) VALUES
('Rahul Sharma',  'Manager',  '9999900001', 75000, '2018-04-01', 1),
('Priya Mehta',   'Cashier',  '9999900002', 35000, '2020-06-15', 2),
('Arjun Verma',   'Teller',   '9999900003', 30000, '2021-01-10', 3),
('Sneha Patil',   'Manager',  '9999900004', 72000, '2019-09-01', 4);

-- Customers (PIN stored plain-text for demo; use bcrypt in production)
INSERT INTO Customer (Name, DOB, Address, Phone, Email, Aadhar_No, CIBIL_Score, PIN) VALUES
('Aarav Shah',    '1992-03-14', 'Mumbai',     '9800000001', 'aarav@email.com',    '100011112222', 780, '1234'),
('Priya Nair',    '1990-07-22', 'Pune',       '9800000002', 'priya@email.com',    '200022223333', 750, '2345'),
('Rohit Gupta',   '1988-11-05', 'Delhi',      '9800000003', 'rohit@email.com',    '300033334444', 720, '3456'),
('Sneha Joshi',   '1995-01-30', 'Nashik',     '9800000004', 'sneha@email.com',    '400044445555', 800, '4567'),
('Vikram Rao',    '1993-08-18', 'Bangalore',  '9800000005', 'vikram@email.com',   '500055556666', 690, '5678'),
('Meera Pillai',  '1997-04-12', 'Chennai',    '9800000006', 'meera@email.com',    '600066667777', 760, '6789');

-- Accounts
INSERT INTO Accounts (Customer_ID, Account_Type, Balance, Open_Date, Account_Status, Branch_ID) VALUES
(1, 'Savings',  125000.00, '2022-01-15', 'Active', 1),
(2, 'Current',   88000.00, '2022-03-10', 'Active', 2),
(3, 'Savings',  200000.00, '2021-07-20', 'Active', 3),
(4, 'FD',       500000.00, '2023-01-01', 'Active', 4),
(5, 'Savings',   45000.00, '2023-06-01', 'Active', 1),
(6, 'RD',        30000.00, '2023-09-01', 'Active', 2),
(1, 'Current',   60000.00, '2023-11-01', 'Active', 1);

-- Transactions
INSERT INTO Transactions (Account_No, Customer_ID, Amount, Transaction_Type, Mode, Status, Branch_ID) VALUES
(1, 1, 50000, 'Deposit',  'NEFT',  'Success', 1),
(1, 1, 10000, 'Withdraw', 'ATM',   'Success', 1),
(1, 1,  5000, 'Transfer', 'UPI',   'Success', 1),
(2, 2, 20000, 'Deposit',  'Cash',  'Success', 2),
(2, 2,  8000, 'Withdraw', 'ATM',   'Success', 2),
(3, 3, 30000, 'Deposit',  'NEFT',  'Success', 3),
(5, 5, 15000, 'Deposit',  'UPI',   'Success', 1),
(5, 5,  3000, 'Withdraw', 'ATM',   'Failed',  1),
(6, 6,  5000, 'Deposit',  'Cash',  'Success', 2),
(1, 1,  2000, 'EMI',      'Auto',  'Success', 1);

-- Loans
INSERT INTO Loan (Customer_ID, Loan_Type, Loan_Amount, Interest_Rate, Tenure, Start_Date, Status) VALUES
(1, 'Home Loan',     1500000, 8.5, 240, '2022-01-15', 'Active'),
(2, 'Car Loan',       500000, 9.0,  60, '2022-06-01', 'Active'),
(3, 'Personal Loan',  200000, 11.5, 36, '2023-01-01', 'Active'),
(5, 'Education Loan', 800000, 7.5, 120, '2023-07-01', 'Active');
