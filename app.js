import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm";

const chess = new Chess();
const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#status");
const confirmBtn = document.querySelector("#confirm");
const cancelBtn = document.querySelector("#cancel");
const restartBtn = document.querySelector("#restart");
const movesEl = document.querySelector("#moves");
const commentEl = document.querySelector("#comment");
const levelEl = document.querySelector("#level");
const engineEl = document.querySelector("#engine");
let stockfishWorker = null;
let stockfishResolve = null;

function getStockfish() {
  if (stockfishWorker) return stockfishWorker;
  stockfishWorker = new Worker("/stockfish/stockfish-19-lite-single.js");
  stockfishWorker.onmessage = (event) => {
    const line = String(event.data || "");
    if (line.startsWith("bestmove ") && stockfishResolve) {
      const resolve = stockfishResolve; stockfishResolve = null;
      const uci = line.split(/\s+/)[1];
      resolve(uci && uci !== "(none)" ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined } : null);
    }
  };
  stockfishWorker.postMessage("uci");
  stockfishWorker.postMessage("isready");
  return stockfishWorker;
}

function findStockfishMove(fen) {
  return new Promise((resolve, reject) => {
    try {
      const worker = getStockfish();
      if (stockfishResolve) { reject(new Error("Stockfish sta già calcolando.")); return; }
      stockfishResolve = resolve;
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage("go depth 12");
      setTimeout(() => {
        if (stockfishResolve === resolve) { stockfishResolve = null; reject(new Error("Stockfish sta impiegando troppo tempo. Riprova.")); }
      }, 30000);
    } catch { reject(new Error("Impossibile avviare Stockfish in questo browser.")); }
  });
}

engineEl.addEventListener("change", () => {
  document.querySelector(".level-label").hidden = engineEl.value !== "openai";
  levelEl.hidden = engineEl.value !== "openai";
  commentEl.textContent = engineEl.value === "stockfish" ? "Stockfish 19 · motore scacchistico" : "OpenAI · modello linguistico";
});
document.querySelector(".level-label").hidden = true;
levelEl.hidden = true;

const symbols = {
  w: { k:"♔", q:"♕", r:"♖", b:"♗", n:"♘", p:"♙" },
  b: { k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟" }
};
let selected = null;
let pending = null;
let thinking = false;
let lastMove = null;

function squareName(file, rank) { return "abcdefgh"[file] + rank; }
function status(text) { statusEl.textContent = text; }
function render() {
  boardEl.innerHTML = "";
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const rank = 8 - r;
      const name = squareName(f, rank);
      const piece = board[r][f];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `square ${(r + f) % 2 === 0 ? "light" : "dark"}`;
      btn.dataset.square = name;
      btn.setAttribute("aria-label", `${name}${piece ? ", " + piece.color + " " + piece.type : ""}`);
      if (selected === name) btn.classList.add("selected");
      const legalTargets = selected ? chess.moves({ square: selected, verbose: true }) : [];
      if (legalTargets.some(m => m.to === name)) {
        btn.classList.add("target");
        if (piece) btn.classList.add("capture");
      }
      if (lastMove && lastMove.includes(name)) btn.style.filter = "brightness(1.08)";
      if (f === 0) {
        const c = document.createElement("span"); c.className = "coord"; c.textContent = rank; btn.append(c);
      }
      if (r === 7) {
        const c = document.createElement("span"); c.className = "coord"; c.style.left = "auto"; c.style.right = "4px"; c.style.top = "auto"; c.style.bottom = "2px"; c.textContent = "abcdefgh"[f]; btn.append(c);
      }
      if (piece) {
        const p = document.createElement("span"); p.className = "piece"; p.textContent = symbols[piece.color][piece.type]; btn.append(p);
      }
      btn.addEventListener("click", () => onSquare(name));
      boardEl.append(btn);
    }
  }
  confirmBtn.disabled = !pending || thinking;
  cancelBtn.disabled = !pending || thinking;
  movesEl.innerHTML = "";
  const hist = chess.history();
  for (let i = 0; i < hist.length; i += 2) {
    const li = document.createElement("li");
    li.textContent = `${Math.floor(i / 2) + 1}. ${hist[i]}${hist[i + 1] ? "   " + hist[i + 1] : ""}`;
    movesEl.append(li);
  }
  if (chess.isCheckmate()) status("Scacco matto. " + (chess.turn() === "w" ? "Vince il Nero." : "Vince il Bianco."));
  else if (chess.isDraw()) status("Patta.");
  else if (thinking) status("L'AI sta scegliendo la sua mossa…");
  else status(chess.turn() === "w" ? "Tocca a te, Bianco." : "Tocca al Nero.");
}
function onSquare(name) {
  if (thinking || chess.isGameOver() || chess.turn() !== "w") return;
  if (pending) return;
  const piece = chess.get(name);
  if (!selected) {
    if (piece?.color === "w") selected = name;
    render();
    return;
  }
  if (piece?.color === "w") {
    selected = name;
    render();
    return;
  }
  const moves = chess.moves({ square: selected, verbose: true }).filter(m => m.to === name);
  if (!moves.length) { selected = null; render(); return; }
  if (moves.some(m => m.promotion)) {
    const choice = (prompt("Promozione: scrivi q (donna), r (torre), b (alfiere), n (cavallo)", "q") || "q").toLowerCase();
    const promotion = ["q","r","b","n"].includes(choice) ? choice : "q";
    pending = { from: selected, to: name, promotion };
  } else {
    pending = { from: selected, to: name };
  }
  selected = null;
  render();
  status(`Confermi ${pending.from} → ${pending.to}${pending.promotion ? " = " + pending.promotion.toUpperCase() : ""}?`);
}
confirmBtn.addEventListener("click", async () => {
  if (!pending || thinking) return;
  const move = pending;
  try {
    const played = chess.move(move);
    lastMove = [played.from, played.to];
    pending = null;
    selected = null;
    commentEl.textContent = "Mossa inviata. Attendo la risposta dell'AI.";
    render();
    await aiMove();
  } catch {
    pending = null;
    render();
    status("Mossa non valida. Scegli un'altra mossa.");
  }
});
cancelBtn.addEventListener("click", () => { pending = null; render(); status("Mossa annullata."); });
restartBtn.addEventListener("click", () => {
  chess.reset(); selected = null; pending = null; lastMove = null; thinking = false;
  commentEl.textContent = "Fai la prima mossa.";
  render();
});
async function aiMove() {
  if (chess.isGameOver()) { render(); return; }
  thinking = true; render();
  try {
    let moveData;
    if (engineEl.value === "stockfish") {
      moveData = await findStockfishMove(chess.fen());
      if (!moveData) throw new Error("Stockfish non ha trovato una mossa.");
      commentEl.textContent = "Stockfish 19 ha calcolato la sua mossa.";
    } else {
      const response = await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fen: chess.fen(), level: levelEl.value })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Errore nella risposta dell'AI.");
      moveData = { from: data.move.from, to: data.move.to, promotion: data.move.promotion || undefined };
      commentEl.textContent = `${data.move.san}${data.comment ? " — " + data.comment : ""}`;
    }
    const played = chess.move(moveData);
    lastMove = [played.from, played.to];
  } catch (err) {
    commentEl.textContent = err.message + " La tua mossa è rimasta valida. Puoi riprovare o iniziare una nuova partita.";
  } finally {
    thinking = false;
    render();
  }
}
