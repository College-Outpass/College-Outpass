const express = require('express');
const cors = require('cors');
const { pool, initDb } = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

initDb();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret12345';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ code: 'auth/user-not-found' });

        const user = users[0];
        const pwdMatch = await bcrypt.compare(password, user.password_hash);
        if (!pwdMatch) return res.status(401).json({ code: 'auth/wrong-password' });

        const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ user: { uid: user.uid, email: user.email, role: user.role }, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal error' });
    }
});

app.post('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

app.get('/api/admins/:uid', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query('SELECT role FROM users WHERE uid = ? AND role = "admin"', [req.params.uid]);
        if (users.length > 0) res.json({ exists: true, data: { ...users[0] } });
        else res.json({ exists: false });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/outpasses', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        const id = 'out_' + Date.now();
        await pool.query(
            `INSERT INTO outpasses (id, passNumber, studentId, studentName, category, section, fatherName, whatsappNumber, requestedBy, issuedBy, status, outDate, inDate, reason, issuedDate, issuedTime, studentPhoto, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, data.passNumber, data.studentId, data.studentName, data.category, data.section, data.fatherName, data.whatsappNumber, data.requestedBy, data.issuedBy, data.status, data.outDate, data.inDate, data.reason, data.issuedDate, data.issuedTime, data.studentPhoto, data.createdBy]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/outpasses', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM outpasses ORDER BY timestamp DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/sickSlips', authenticateToken, async (req, res) => {
    try {
        const data = req.body;
        const id = 'sick_' + Date.now();
        await pool.query(
            `INSERT INTO sick_slips (id, sickSlipNumber, studentId, studentName, date, time, reason, status, issuedBy, issuedDate, issuedTime, createdBy) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [id, data.sickSlipNumber, data.studentId, data.studentName, data.date, data.time, data.reason, data.status, data.issuedBy, data.issuedDate, data.issuedTime, data.createdBy]
        );
        res.json({ id });
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.get('/api/sickSlips', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM sick_slips ORDER BY timestamp DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/settings/increment', authenticateToken, async (req, res) => {
    const { collection, doc } = req.body;
    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        let [rows] = await connection.query('SELECT count_value FROM settings WHERE setting_key = ? FOR UPDATE', [doc]);
        let currentCount = 1;
        if (rows.length > 0) currentCount = rows[0].count_value;
        else await connection.query('INSERT INTO settings (setting_key, count_value) VALUES (?, 1)', [doc]);

        await connection.query('UPDATE settings SET count_value = ? WHERE setting_key = ?', [currentCount + 1, doc]);
        await connection.commit();
        connection.release();
        res.json({ currentCount });
    } catch (error) {
        res.status(500).json({ error: 'Transaction failed' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => { console.log("TiDB backend API running on port " + PORT); });
