const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

// --- 1. USER REGISTER ---
app.post('/api/register', async (req, res) => {
    const { fname, lname, email, phone, loc, pass } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(pass, 10);
        const wallet = '0x' + Math.random().toString(16).substr(2, 8);

        const sql = `INSERT INTO users (first_name, last_name, email, phone, location, password, wallet_address) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(sql, [fname, lname, email, phone, loc, hashedPassword, wallet], (err, result) => {
            if (err) return res.status(400).json({ error: 'Email already registered or DB error' });
            res.json({ message: 'User registered successfully!', wallet });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- 2. USER LOGIN ---
app.post('/api/login', (req, res) => {
    const { email, pass } = req.body;
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.query(sql, [email], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ error: 'User not found' });

        const user = results[0];
        const isMatch = await bcrypt.compare(pass, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

        res.json({
            id: user.id,
            fname: user.first_name,
            lname: user.last_name,
            email: user.email,
            loc: user.location,
            wallet: user.wallet_address
        });
    });
});

// --- 3. GET ACTIVE LISTINGS ---
app.get('/api/listings', (req, res) => {
    const query = `
        SELECT
            listings.id,
            listings.user_id,
            listings.source,
            listings.kwh,
            listings.price_per_kwh AS price,
            listings.status,
            CONCAT(users.first_name, ' ', users.last_name) AS name,
            users.location AS loc
        FROM listings
        JOIN users ON listings.user_id = users.id
        WHERE listings.status = 'active'
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error("Database query error:", err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// --- 4. CREATE LISTING ---
app.post('/api/listings', (req, res) => {
    const { userId, source, kwh, price } = req.body;
    const sql = `INSERT INTO listings (user_id, source, kwh, price_per_kwh) VALUES (?, ?, ?, ?)`;
    db.query(sql, [userId, source, kwh, price], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Listing created', listingId: result.insertId });
    });
});

// --- 5. BUY ENERGY ---
app.post('/api/buy', (req, res) => {
    const { listingId, buyerId, kwhBought } = req.body;
    
    db.query(`SELECT * FROM listings WHERE id = ?`, [listingId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Listing not found' });
        
        const listing = results[0];
        if (listing.kwh < kwhBought) return res.status(400).json({ error: 'Not enough energy available' });

        const updatedKwh = listing.kwh - kwhBought;
        const status = updatedKwh === 0 ? 'sold' : 'active';
        const totalAmt = kwhBought * listing.price_per_kwh;
        const txHash = '0x' + Math.random().toString(16).substr(2, 10);

        db.query(`UPDATE listings SET kwh = ?, status = ? WHERE id = ?`, [updatedKwh, status, listingId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            const txSql = `INSERT INTO transactions (tx_hash, seller_id, buyer_id, kwh, total_amount) VALUES (?, ?, ?, ?, ?)`;
            db.query(txSql, [txHash, listing.user_id, buyerId, kwhBought, totalAmt], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Purchase successful', txHash });
            });
        });
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));