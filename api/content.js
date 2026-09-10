// /api/content.js
// Riceve una richiesta autenticata dal modulo dell'app, scarica il file JSON
// corrispondente da GitHub, aggiunge o modifica l'elemento richiesto, e lo
// ricarica su GitHub. Vercel, essendo collegato al repository, ripubblica
// automaticamente l'app con i dati aggiornati.
//
// NOTA IMPORTANTE: questa funzione supporta SOLO "aggiungi" e "modifica".
// Non esiste (volutamente) alcuna azione di eliminazione, per sicurezza.
//
// Variabili d'ambiente richieste su Vercel:
//   GITHUB_TOKEN   -> Personal Access Token con permesso di scrittura SOLO su questo repository
//   GITHUB_OWNER   -> es. "nomeutente"
//   GITHUB_REPO    -> es. "nel-sigillo-app"
//   GITHUB_BRANCH  -> es. "main"
//   SESSION_SECRET -> la stessa usata in /api/login.js

const jwt = require('jsonwebtoken');

// Registro dei file gestibili: aggiungere qui una sezione futura richiede solo una riga
const FILE_PER_SEZIONE = {
	canti: 'canti.json',
	messaggi: 'messaggi.json',
	preghiere: 'preghiere.json'
};

function generaId(sezione, item) {
	if (sezione === 'canti') return item.titolo;
	if (sezione === 'messaggi') {
		const slugData = (item.data || 'senza-data').replace(/[^0-9-]/g, '');
		return `${slugData}-${Date.now()}`;
	}
	return `${(item.titolo || 'senza-titolo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
}

async function githubRequest(path, options = {}) {
	const base = process.env.GITHUB_API_BASE || 'https://api.github.com';
	const url = `${base}/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${path}`;
	const response = await fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
			Accept: 'application/vnd.github+json',
			'Content-Type': 'application/json',
			...(options.headers || {})
		}
	});
	if (!response.ok) {
		const testo = await response.text();
		throw new Error(`Errore GitHub (${response.status}): ${testo}`);
	}
	return response.json();
}

module.exports = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ errore: 'Metodo non consentito' });
	}

	// --- Verifica autenticazione ---
	const authHeader = req.headers.authorization || '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!token) {
		return res.status(401).json({ errore: 'Accesso richiesto: effettua il login' });
	}
	let payload;
	try {
		payload = jwt.verify(token, process.env.SESSION_SECRET);
	} catch (e) {
		return res.status(401).json({ errore: 'Sessione scaduta o non valida, effettua di nuovo il login' });
	}

	try {
		const { sezione, azione, item } = req.body || {};

		if (!FILE_PER_SEZIONE[sezione]) {
			return res.status(400).json({ errore: 'Sezione non riconosciuta: ' + sezione });
		}
		if (azione !== 'aggiungi' && azione !== 'modifica') {
			return res.status(400).json({ errore: 'Azione non consentita. Sono permesse solo "aggiungi" e "modifica".' });
		}
		if (!item || typeof item !== 'object') {
			return res.status(400).json({ errore: 'Dati elemento mancanti' });
		}

		const percorsoFile = FILE_PER_SEZIONE[sezione];

		// 1. Scarica il file attuale da GitHub (contenuto + sha, necessario per aggiornarlo)
		const fileAttuale = await githubRequest(`${percorsoFile}?ref=${process.env.GITHUB_BRANCH}`);
		const contenutoAttuale = Buffer.from(fileAttuale.content, 'base64').toString('utf-8');
		const lista = JSON.parse(contenutoAttuale);

		let messaggioCommit;

		if (azione === 'aggiungi') {
			const nuovoItem = { ...item, id: generaId(sezione, item) };
			lista.unshift(nuovoItem);
			messaggioCommit = `Aggiunto elemento in ${sezione} da ${payload.nome}`;
		} else {
			const indice = lista.findIndex((x) => x.id === item.id);
			if (indice === -1) {
				return res.status(404).json({ errore: 'Elemento da modificare non trovato (id: ' + item.id + ')' });
			}
			lista[indice] = { ...lista[indice], ...item };
			messaggioCommit = `Modificato elemento in ${sezione} da ${payload.nome}`;
		}

		// 2. Ricarica il file aggiornato su GitHub (crea un commit)
		const nuovoContenutoBase64 = Buffer.from(JSON.stringify(lista, null, 2), 'utf-8').toString('base64');
		await githubRequest(percorsoFile, {
			method: 'PUT',
			body: JSON.stringify({
				message: messaggioCommit,
				content: nuovoContenutoBase64,
				sha: fileAttuale.sha,
				branch: process.env.GITHUB_BRANCH
			})
		});

		return res.status(200).json({
			ok: true,
			messaggio: 'Salvato correttamente. La modifica sarà visibile online tra circa un minuto.'
		});
	} catch (err) {
		console.error('Errore content:', err);
		return res.status(500).json({ errore: 'Errore nel salvataggio: ' + err.message });
	}
};
