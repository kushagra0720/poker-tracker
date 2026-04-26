const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;
const USE_KV = Boolean(process.env.KV_REST_API_URL);

let kv;
if (USE_KV) {
  kv = require('@vercel/kv').kv;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readDB() {
  if (USE_KV) {
    const [games, players] = await Promise.all([kv.get('games'), kv.get('players')]);
    return { games: games || [], players: players || [] };
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ games: [], players: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { games: [], players: [] };
  }
}

async function writeDB(data) {
  if (USE_KV) {
    await Promise.all([
      kv.set('games', data.games),
      kv.set('players', data.players || [])
    ]);
    return;
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/games', async (req, res) => {
  const db = await readDB();
  res.json(db.games);
});

app.post('/api/games', async (req, res) => {
  const db = await readDB();
  const game = {
    id: Date.now().toString(),
    name: req.body.name,
    date: req.body.date,
    players: req.body.players || []
  };
  db.games.unshift(game);
  await writeDB(db);
  res.status(201).json(game);
});

app.put('/api/games/:id', async (req, res) => {
  const db = await readDB();
  const idx = db.games.findIndex(g => String(g.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.games[idx] = {
    id: req.params.id,
    name: req.body.name,
    date: req.body.date,
    players: req.body.players || []
  };
  await writeDB(db);
  res.json(db.games[idx]);
});

app.delete('/api/games/:id', async (req, res) => {
  const db = await readDB();
  const idx = db.games.findIndex(g => String(g.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.games.splice(idx, 1);
  await writeDB(db);
  res.json({ ok: true });
});

app.get('/api/players', async (req, res) => {
  const db = await readDB();
  res.json(db.players || []);
});

app.post('/api/players', async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const db = await readDB();
  if (!db.players) db.players = [];
  if (!db.players.includes(name)) {
    db.players.push(name);
    db.players.sort();
    await writeDB(db);
  }
  res.json(db.players);
});

app.delete('/api/players/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const db = await readDB();
  db.players = (db.players || []).filter(p => p !== name);
  await writeDB(db);
  res.json(db.players);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Local dev only — Vercel uses the exported app, not app.listen()
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Poker tracker running at http://localhost:${PORT}`);
  });
}

module.exports = app;
