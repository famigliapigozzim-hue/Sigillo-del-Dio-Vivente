// /api/login.js
// Verifica nome + password contro la lista EDITORS (variabile d'ambiente su Vercel)
// e rilascia un token di sessione firmato, valido 12 ore.
//
// Variabili d'ambiente richieste su Vercel:
//   EDITORS        -> JSON tipo: [{"nome":"Maria Grazia","passwordHash":"$2a$10$..."}]
//   SESSION_SECRET -> stringa segreta lunga e casuale, usata per firmare i token

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
	if (req.method !== 'POST') {
		return res.status(405).json({ errore: 'Metodo non consentito' });
	}

	try {
		const { nome, password } = req.body || {};
		if (!nome || !password) {
			return res.status(400).json({ errore: 'Nome e password sono obbligatori' });
		}

		let editors;
		try {
			editors = JSON.parse(process.env.EDITORS || '[]');
		} catch (e) {
			console.error('EDITORS non è un JSON valido:', e);
			return res.status(500).json({ errore: 'Configurazione del server non valida' });
		}

		const editor = editors.find((ed) => ed.nome.toLowerCase() === String(nome).toLowerCase());
		if (!editor) {
			// Risposta generica: non riveliamo se il problema è il nome o la password
			return res.status(401).json({ errore: 'Nome o password non corretti' });
		}

		const passwordCorretta = await bcrypt.compare(password, editor.passwordHash);
		if (!passwordCorretta) {
			return res.status(401).json({ errore: 'Nome o password non corretti' });
		}

		if (!process.env.SESSION_SECRET) {
			console.error('SESSION_SECRET non configurato');
			return res.status(500).json({ errore: 'Configurazione del server non valida' });
		}

		const token = jwt.sign(
			{ nome: editor.nome },
			process.env.SESSION_SECRET,
			{ expiresIn: '12h' }
		);

		return res.status(200).json({ token, nome: editor.nome });
	} catch (err) {
		console.error('Errore login:', err);
		return res.status(500).json({ errore: 'Errore interno del server' });
	}
};
