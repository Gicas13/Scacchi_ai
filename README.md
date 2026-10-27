# Scacchi contro AI — prototipo

Sito iniziale per giocare a scacchi contro un modello OpenAI. La scacchiera verifica le mosse con `chess.js`; il server passa all'AI la posizione e l'elenco delle mosse legali, poi controlla che la risposta sia valida.

## Requisiti
- Node.js 20 o successivo
- Una chiave API OpenAI con accesso al modello scelto

## Avvio
1. Estrai lo ZIP.
2. Apri un terminale nella cartella del progetto.
3. Esegui `npm install`.
4. Copia `.env.example` in `.env`.
5. Inserisci la chiave API in `.env`. Non metterla mai in `public/app.js` o in un repository pubblico.
6. Esegui `npm start`.
7. Apri `http://localhost:3000`.

## Modello
Il file `.env` usa `OPENAI_MODEL=gpt-5.5` come valore iniziale. Se il tuo account non ha accesso a quel modello, cambia il valore con un modello disponibile nel tuo account API.

## Livelli di difficoltà
La pagina offre Facile, Intermedio, Difficile e Impossibile. Sono istruzioni di stile per il modello OpenAI, non livelli ELO misurati.

## Pubblicazione da iPhone
Puoi creare un account GitHub da Safari su github.com. Per caricare il progetto, è più semplice usare un computer; da iPhone si può usare la modalità desktop di Safari, ma modificare più file è meno comodo. Dopo aver caricato il progetto su GitHub, collegalo a un servizio di hosting per Node.js come Render e configura `OPENAI_API_KEY` nelle variabili d'ambiente del servizio, non nel codice.

## Limiti della prima versione
- Non ha account, classifiche, matchmaking o database.
- L'AI sceglie una mossa tra quelle legali, ma non è Stockfish e non ha un ELO garantito. Stockfish non è ancora collegato in questa versione.
- Per pubblicare il sito, serve un hosting per Node.js e una gestione sicura dei costi e degli abusi API.
- La chiave API resta sul server, nel file `.env`.
