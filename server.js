import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { Chess } from "chess.js";
import rateLimit from "express-rate-limit";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));
// Serve Stockfish.js and its matching WASM file from the installed npm package.
app.use("/stockfish", express.static("node_modules/stockfish/bin", {
  setHeaders(res, path) {
    if (path.endsWith(".wasm")) res.setHeader("Content-Type", "application/wasm");
  }
}));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Troppe richieste. Aspetta un minuto e riprova." }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/move", aiLimiter, async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Modalità OpenAI non configurata sul server." });
    }
    const { fen, level = "intermedio" } = req.body ?? {};
    if (typeof fen !== "string" || fen.length > 200) {
      return res.status(400).json({ error: "Posizione scacchistica non valida." });
    }
    const game = new Chess();
    try { game.load(fen); } catch {
      return res.status(400).json({ error: "FEN non valida." });
    }
    if (game.isGameOver()) return res.status(400).json({ error: "La partita è già terminata." });

    const legalMoves = game.moves({ verbose: true }).map(m => ({
      san: m.san, from: m.from, to: m.to, promotion: m.promotion ?? null
    }));
    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-astra",
      instructions: [
        "Sei un giocatore di scacchi. Scegli una sola mossa dalla lista delle mosse legali.",
        'Rispondi esclusivamente con JSON valido: {"san":"...","comment":"breve commento in italiano"}.',
        "Il campo san deve corrispondere esattamente a una mossa della lista. Non inventare mosse.",
        `Stile richiesto: ${String(level).slice(0, 30)}.`
      ].join(" "),
      input: JSON.stringify({ position: fen, legal_moves: legalMoves })
    });
    let parsed;
    try {
      const raw = response.output_text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: "Risposta AI non valida. Riprova." });
    }
    const selected = legalMoves.find(m => m.san === parsed.san);
    if (!selected) return res.status(502).json({ error: "L'AI ha proposto una mossa non legale. Riprova." });
    return res.json({ move: selected, comment: String(parsed.comment || "").slice(0, 240) });
  } catch (error) {
    console.error("Errore /api/move:", error?.message || error);
    return res.status(500).json({ error: "Errore del server. Controlla la configurazione API." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`Sito pronto sulla porta ${port}`));
