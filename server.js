const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;
const USE_KV = Boolean(process.env.KV_REST_API_URL);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readDB() {
  if (USE_KV) {
    const { kv } = require('@vercel/kv');
    const games = await kv.get('games');
    return { games: games || [] };
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ games: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { games: [] };
  }
}

async function writeDB(data) {
  if (USE_KV) {
    const { kv } = require('@vercel/kv');
    await kv.set('games', data.games);
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
  const idx = db.games.findIndex(g => g.id === req.params.id);
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
  const idx = db.games.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.games.splice(idx, 1);
  await writeDB(db);
  res.json({ ok: true });
});

// Local dev only — Vercel uses the exported app, not app.listen()
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Poker tracker running at http://localhost:${PORT}`);
  });
}

module.exports = app;
