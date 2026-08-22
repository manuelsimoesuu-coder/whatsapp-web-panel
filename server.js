const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PASSWORD_FACIL = "1234"; 

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('--- ESCANEA ESTE CÓDIGO QR EN LA CONSOLA ---');
    qrcode.generate(qr, { small: true });
    console.log('Si no puedes escanear el de arriba, copia este texto: ', qr);
});

client.on('ready', () => {
    console.log('¡WhatsApp conectado y listo para operar!');
});

client.initialize();

// Ruta para enviar mensajes
app.post('/send', async (req, res) => {
    const { pass, phone, message } = req.body;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        let chatId = phone.includes('@c.us') || phone.includes('@g.us') ? phone : `${phone}@c.us`;
        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// NUEVA RUTA: Obtener todos los grupos
app.get('/groups', async (req, res) => {
    const { pass } = req.query;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        const chats = await client.getChats();
        // Filtramos para obtener solo los grupos y extraemos su nombre e ID
        const groups = chats
            .filter(chat => chat.isGroup)
            .map(group => ({
                name: group.name,
                id: group.id._serialized
            }));
        
        res.json({ success: true, total: groups.length, groups });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
