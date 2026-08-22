const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const PASSWORD_FACIL = "1234"; 

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './whatsapp-session'
    }),
    puppeteer: {
        headless: true,
        protocolTimeout: 60000,
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

// Ruta para enviar mensajes de texto de forma directa y segura
app.post('/send', async (req, res) => {
    const { pass, phone, message } = req.body;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        let cleanPhone = phone.trim().replace(/[^0-9]/g, '');
        
        // Si es un grupo, ya viene con @g.us, si es número le ponemos @c.us de manera directa
        let chatId = cleanPhone.includes('@g.us') || cleanPhone.includes('@c.us')
            ? cleanPhone
            : `${cleanPhone}@c.us`;

        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (error) {
        console.error("Error al enviar:", error);
        res.status(500).json({ success: false, error: "No se pudo enviar. Asegúrate de que el número tenga WhatsApp." });
    }
});

// Ruta para enviar fotos de forma directa
app.post('/send-media', async (req, res) => {
    const { pass, phone, message, mediaBase64, mimetype, filename } = req.body;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        let cleanPhone = phone.trim().replace(/[^0-9]/g, '');
        let chatId = cleanPhone.includes('@g.us') || cleanPhone.includes('@c.us')
            ? cleanPhone
            : `${cleanPhone}@c.us`;
        
        const media = new MessageMedia(mimetype, mediaBase64, filename);
        await client.sendMessage(chatId, media, { caption: message });
        res.json({ success: true });
    } catch (error) {
        console.error("Error al enviar media:", error);
        res.status(500).json({ success: false, error: "No se pudo enviar la imagen." });
    }
});

// Ruta: Obtener todos los grupos con reintento seguro
app.get('/groups', async (req, res) => {
    const { pass } = req.query;

    if (pass !== PASSWORD_FACIL) {
        return res.status(401).json({ success: false, error: "Contraseña incorrecta" });
    }

    try {
        let chats = [];
        for (let intento = 1; intento <= 3; intento++) {
            try {
                chats = await client.getChats();
                if (chats && chats.length > 0) break;
            } catch (err) {
                if (intento === 3) throw err;
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        const groups = (chats || [])
            .filter(chat => chat.isGroup)
            .map(group => ({
                name: group.name,
                id: group.id._serialized
            }));
        
        res.json({ success: true, total: groups.length, groups });
    } catch (error) {
        console.error("Error obteniendo grupos:", error);
        res.status(500).json({ success: false, error: "WhatsApp se está sincronizando, intenta de nuevo en unos segundos." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
