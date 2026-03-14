

const { Client } = require('whatsapp-web.js');

// Client nesnesini oluştur
const client = new Client();

// Client hazır olduğunda çalışacak kod
client.on('ready', async () => {
    console.log('WhatsApp hazır! Gruplara mesaj gönderiliyor...');

    try {
        const chats = await client.getChats();
        const groups = chats.filter(chat => chat.isGroup);

        for (let g of groups) {
            await client.sendMessage(g.id._serialized, "MERHABA, BU BİR TEST MESAJIDIR!");
            console.log(`Mesaj gönderildi: ${g.name}`);
        }

        console.log("Tüm gruplara mesaj gönderildi.");
    } catch (err) {
        console.error("Hata oluştu:", err.message);
    }
});

// Client’ı başlat
client.initialize();

// --- GRUPLARA TEK SEFER MESAJ GÖNDERME ---
client.on('ready', async () => {
    console.log('WhatsApp hazır! Gruplara mesaj gönderiliyor...');

    try {
        // Tüm sohbetleri al
        const chats = await client.getChats();

        // Sadece grup sohbetlerini filtrele
        const groups = chats.filter(chat => chat.isGroup);

        // Her gruba mesaj gönder
        for (let g of groups) {
            await client.sendMessage(g.id._serialized, "MERHABA, BU BİR TEST MESAJIDIR!");
            console.log(`Mesaj gönderildi: ${g.name}`);
        }

        console.log("Tüm gruplara mesaj gönderildi.");
    } catch (err) {
        console.error("Hata oluştu:", err.message);
    }
});
// --- BİTİŞ ---
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-panel')
  .then(() => console.log('✅ MongoDB bağlandı'))
  .catch(err => console.log('❌ MongoDB hatası:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/whatsapp', require('./routes/whatsapp')(io));

// Ana sayfa
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WhatsApp client global
global.waClient = null;
global.waStatus = 'disconnected';

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
});

module.exports = { io };
