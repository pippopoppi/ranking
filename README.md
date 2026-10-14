# Pippo Poppi Games — classifica mondiale

Un unico Cloudflare Worker (piano gratuito) con una chiave KV per gioco. Lo usano i giochi
che hanno una classifica mondiale: ogni partita finita manda `{ name, score, ... }` e il
server tiene una riga per soprannome, sostituendola solo quando il punteggio migliora.

```text
GET  https://ranking.pippopoppi.workers.dev/<gioco>?top=10     top 10 e totale righe
GET  https://ranking.pippopoppi.workers.dev/<gioco>?name=LOLLO  posizione di un soprannome
POST https://ranking.pippopoppi.workers.dev/<gioco>             { name, score, ...campi extra }
```

Giochi registrati (in `GAMES` dentro `worker.js`): `croc-vs-pigeon`, `math-survival`.
Ogni gioco dichiara i campi extra salvati e un controllo di plausibilità che rifiuta i
punteggi impossibili. Il server conserva le prime 500 righe per gioco. Nessun account,
nessuna email: solo il soprannome scelto dal giocatore.

## Deploy

```bash
npx wrangler@3 kv namespace create BOARD   # una volta sola: incolla l'id in wrangler.toml
tools/deploy.sh                            # legge le credenziali da ~/.config/pippopoppi/cloudflare.env
```

## Licenza

MIT — Pippo Poppi Games.
