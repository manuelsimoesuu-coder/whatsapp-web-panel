const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();

// Aumentamos los límites para fotos pesadas
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const PASSWORD_FACIL = "1234"; 

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-session' // Esta es la carpeta que vinculamos al Volumen en Railway
    }),
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

// Ruta para enviar mensajes de texto con validación segura
app.post('/send', async (req, res) => {
    const { pass, phone, message } = req.body;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        // Limpiamos el número y preparamos el formato
        let cleanPhone = phone.trim().replace(/[^0-9]/g, '');
        let chatId = cleanPhone.includes('@c.us') || cleanPhone.includes('@g.us') 
            ? cleanPhone 
            : `${cleanPhone}@c.us`;

        // Validamos si el número existe en WhatsApp
        const numberId = await client.getNumberId(chatId);
        if (!numberId) {
            return res.status(400).json({ success: false, error: "El número no está registrado en WhatsApp o no se ha sincronizado." });
        }

        await client.sendMessage(numberId._serialized, message);
        res.json({ success: true });
    } catch (error) {
        console.error("Error al enviar:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ruta para enviar fotos
app.post('/send-media', async (req, res) => {
    const { pass, phone, message, mediaBase64, mimetype, filename } = req.body;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        let cleanPhone = phone.trim().replace(/[^0-9]/g, '');
        let chatId = cleanPhone.includes('@c.us') || cleanPhone.includes('@g.us') ? cleanPhone : `${cleanPhone}@c.us`;
        
        const numberId = await client.getNumberId(chatId);
        if (!numberId) {
            return res.status(400).json({ success: false, error: "Número no registrado en WhatsApp." });
        }

        const media = new MessageMedia(mimetype, mediaBase64, filename);
        await client.sendMessage(numberId._serialized, media, { caption: message });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al enviar media:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ruta: Obtener todos los grupos
app.get('/groups', async (req, res) => {
    const { pass } = req.query;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        const chats = await client.getChats();
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
