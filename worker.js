/* Pippo Poppi Games — shared world ranking.
 * One Cloudflare Worker, one KV namespace, one board per game.
 *
 *   GET  /<game>?top=10        -> { top: [ { name, score, ... , at } ... ], total }
 *   GET  /<game>?name=LOLLO    -> { rank, row }           (rank 0 = not ranked)
 *   POST /<game>  { name, score, ...extra }
 *                              -> { rank, improved, best, top }
 *
 * One row per nickname (case-insensitive). A score only replaces the stored row
 * when it is better, so reusing a name keeps the record. Each game declares
 * which extra fields it stores and a sanity check that rejects impossible scores.
 */
const KEEP = 500;      // rows stored per game
const MAX_TOP = 50;    // rows a GET may ask for
const NAME_RE = /[^\p{L}\p{N}\p{Emoji_Presentation} _.\-!?*]/gu;

const int = v => (Number.isFinite(+v) ? Math.floor(+v) : -1);

// Per-game rules. `fields` are extra integer fields kept on the row; `valid(row)`
// returns false for scores the game cannot produce; `cmp` orders rows (best first).
const GAMES = {
  'croc-vs-pigeon': {
    fields: ['time', 'eaten'],
    valid: r => r.time >= 0 && r.time <= 7200 && r.eaten >= 0 && r.score <= r.time * 6000 + 6000 && r.eaten <= r.time * 6 + 6,
    cmp: (a, b) => b.score - a.score || b.time - a.time || (a.at || 0) - (b.at || 0),
  },
  'math-survival': {
    fields: ['time'],                       // seconds the run lasted
    // Score is the number of solved problems; nobody solves more than ~3 per second.
    valid: r => r.time >= 0 && r.time <= 3 * 3600 && r.score <= 3000 && r.score <= r.time * 3 + 5,
    cmp: (a, b) => b.score - a.score || a.time - b.time || (a.at || 0) - (b.at || 0),
  },
  'void-vanguard': {
    fields: ['level', 'kills', 'time'],   // score is per level; time = seconds the level lasted
    // Kills are worth tens of points each, bosses 500, the level bonus a few hundred.
    valid: r => r.level >= 1 && r.level <= 500 && r.time >= 0 && r.time <= 1800 && r.kills >= 0 && r.kills <= r.time * 6 + 10 && r.score <= r.time * 600 + 3000,
    cmp: (a, b) => b.score - a.score || b.level - a.level || (a.at || 0) - (b.at || 0),
  },
};

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'no-store',
};
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers });
const cleanName = v => String(v || '').replace(NAME_RE, '').replace(/\s+/g, ' ').trim().slice(0, 12).toUpperCase();

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const url = new URL(req.url);
    const game = url.pathname.replace(/^\/+|\/+$/g, '');
    const rules = GAMES[game];
    if (!rules) return json({ error: 'unknown game', games: Object.keys(GAMES) }, 404);
    const key = 'board:' + game;
    const board = JSON.parse((await env.BOARD.get(key)) || '[]');

    if (req.method === 'GET') {
      const name = cleanName(url.searchParams.get('name'));
      if (name) {
        const i = board.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
        return json({ rank: i + 1, row: i < 0 ? null : board[i] });
      }
      const top = Math.max(1, Math.min(MAX_TOP, int(url.searchParams.get('top')) || 10));
      return json({ top: board.slice(0, top), total: board.length });
    }

    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    let b;
    try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
    const row = { name: cleanName(b.name), score: int(b.score), at: Date.now() };
    for (const f of rules.fields) row[f] = int(b[f]);
    if (!row.name || row.score < 0 || !rules.valid(row)) return json({ error: 'invalid score' }, 400);

    const lower = row.name.toLowerCase();
    const i = board.findIndex(r => r.name.toLowerCase() === lower);
    let improved = false;
    if (i < 0) { board.push(row); improved = true; }
    else if (rules.cmp(row, board[i]) < 0) { board[i] = row; improved = true; }
    board.sort(rules.cmp);
    if (board.length > KEEP) board.length = KEEP;
    if (improved) await env.BOARD.put(key, JSON.stringify(board));
    const rank = board.findIndex(r => r.name.toLowerCase() === lower) + 1;
    return json({ rank, improved, best: rank ? board[rank - 1].score : row.score, top: board.slice(0, 10) });
  },
};
