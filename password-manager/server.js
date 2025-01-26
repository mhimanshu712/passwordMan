require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const CryptoJS = require('crypto-js');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = process.env.PORT || 3000;

let db;
let dbFile = 'bull.db';

// Initialize database
async function initDb() {
    try {
        const SQL = await initSqlJs();
        
        // Load existing database if it exists
        if (fs.existsSync(dbFile)) {
            const filebuffer = fs.readFileSync(dbFile);
            db = new SQL.Database(filebuffer);
        } else {
            db = new SQL.Database();
            // Create tables
            db.run(`
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL
                );

                CREATE TABLE stored_passwords (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    site TEXT NOT NULL,
                    username TEXT NOT NULL,
                    encrypted_password TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    UNIQUE(user_id, site)
                );
            `);
            saveDb();
        }
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
        process.exit(1);
    }
}

// Save database to file
function saveDb() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbFile, buffer);
}

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = verified;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, masterPassword } = req.body;
        
        // Check if user exists
        const existingUser = db.exec(`SELECT * FROM users WHERE username = ?`, [username]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(masterPassword, 10);
        db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashedPassword]);
        saveDb();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, masterPassword } = req.body;
        
        const result = db.exec('SELECT * FROM users WHERE username = ?', [username]);
        if (result.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        const user = {
            id: result[0].values[0][0],
            username: result[0].values[0][1],
            password_hash: result[0].values[0][2]
        };

        const valid = await bcrypt.compare(masterPassword, user.password_hash);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        const token = jwt.sign({ username, userId: user.id }, process.env.JWT_SECRET || 'your-secret-key');
        res.cookie('token', token, { httpOnly: true });
        res.json({ message: 'Logged in successfully' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/passwords', authenticateToken, async (req, res) => {
    try {
        const { site, username, password } = req.body;
        const result = db.exec('SELECT password_hash FROM users WHERE username = ?', [req.user.username]);
        const userHash = result[0].values[0][0];
        
        const encryptedPassword = CryptoJS.AES.encrypt(password, userHash).toString();

        db.run(
            'INSERT OR REPLACE INTO stored_passwords (user_id, site, username, encrypted_password) VALUES (?, ?, ?, ?)',
            [req.user.userId, site, username, encryptedPassword]
        );
        saveDb();

        res.json({ message: 'Password saved successfully' });
    } catch (error) {
        console.error('Save password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/passwords', authenticateToken, async (req, res) => {
    try {
        const result = db.exec(`
            SELECT sp.site, sp.username, sp.encrypted_password, u.password_hash
            FROM stored_passwords sp
            JOIN users u ON u.id = sp.user_id
            WHERE sp.user_id = ?
        `, [req.user.userId]);

        if (result.length === 0) {
            return res.json([]);
        }

        const decryptedPasswords = result[0].values.map(row => ({
            site: row[0],
            username: row[1],
            password: CryptoJS.AES.decrypt(row[2], row[3]).toString(CryptoJS.enc.Utf8)
        }));
        
        res.json(decryptedPasswords);
    } catch (error) {
        console.error('Get passwords error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/passwords/:site', authenticateToken, async (req, res) => {
    try {
        const { site } = req.params;
        db.run('DELETE FROM stored_passwords WHERE user_id = ? AND site = ?', [req.user.userId, site]);
        saveDb();
        
        res.json({ message: 'Password deleted successfully' });
    } catch (error) {
        console.error('Delete password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database before starting server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

// Cleanup function for graceful shutdown
function cleanup() {
    console.log('Saving database before shutdown...');
    saveDb();
    process.exit();
}

// Handle cleanup on process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
