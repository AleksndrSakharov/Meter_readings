const express = require('express');
const path = require('path');
const fs = require('fs');
const { readFile, writeFile, mkdir, access } = require('fs/promises');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'readings.json');
const SCHEMA_FILE = path.join(__dirname, 'schema.json');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

async function ensureStorage() {
    await mkdir(DATA_DIR, { recursive: true });
    try {
        await access(DB_FILE, fs.constants.F_OK);
    } catch (err) {
        await writeFile(DB_FILE, '[]', 'utf8');
    }
}

async function readJson(filePath, fallback = null) {
    try {
        const raw = await readFile(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        if (fallback !== null) return fallback;
        throw err;
    }
}

async function writeJson(filePath, payload) {
    const serialized = JSON.stringify(payload, null, 2);
    await writeFile(filePath, serialized, 'utf8');
}

function respondError(res, status, message) {
    res.status(status).json({ status: 'error', message });
}

app.get('/api/schema', async (_req, res) => {
    try {
        const schema = await readJson(SCHEMA_FILE);
        res.json(schema);
    } catch (err) {
        respondError(res, 500, 'Не удалось прочитать файл схемы');
    }
});

app.post('/api/records', async (req, res) => {
    const username = (req.headers['x-username'] || '').trim();
    if (!username) return respondError(res, 400, 'Требуется идентификатор пользователя');

    const payload = { ...req.body };
    payload['квартира'] = username;
    payload.meta = { capturedAt: new Date().toISOString(), user: username };

    try {
        const db = await readJson(DB_FILE, []);
        db.push(payload);
        await writeJson(DB_FILE, db);
        res.json({ status: 'ok', message: 'Показания сохранены' });
    } catch (err) {
        respondError(res, 500, 'Не удалось сохранить данные');
    }
});

app.get('/api/records', async (req, res) => {
    const username = (req.headers['x-username'] || '').trim();
    if (!username) return res.json([]);

    try {
        const db = await readJson(DB_FILE, []);
        const ownRecords = db.filter(entry => entry['квартира'] === username);
        res.json(ownRecords);
    } catch (err) {
        respondError(res, 500, 'Не удалось прочитать базу');
    }
});

ensureStorage().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
});