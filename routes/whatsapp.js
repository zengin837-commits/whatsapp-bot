const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

module.exports = (io) => {
  const router = express.Router();

  // Varsayılan durumlar
  global.waClient = global.waClient || null;
  global.waStatus = global.waStatus || 'disconnected';
  global.waGroups = global.waGroups || [];

  const loadGroups = async (client, attempt = 1) => {
    try {
      console.log(`Gruplar yukleniyor... (deneme ${attempt})`);

      const chats = await client.getChats();
      const groups = chats.filter(c => c.isGroup);

      global.waGroups = groups.map(g => ({
        id: g.id._serialized,
        name: g.name || 'Grup',
        participants: g.participants ? g.participants.length : 0
      }));

      console.log("Gruplar yuklendi:", global.waGroups.length);

      io.emit('groups_loaded', global.waGroups);

    } catch (e) {
      console.log("Grup yukleme hatasi:", e.message);

      if (attempt < 5) {
        setTimeout(() => loadGroups(client, attempt + 1), 20000);
      }
    }
  };

  // WHATSAPP BAGLAN
  router.post('/connect', async (req, res) => {
    try {

      if (global.waClient && global.waStatus === 'connected') {
        return res.json({ status: global.waStatus });
      }

      if (global.waClient) {
        try { await global.waClient.destroy(); } catch (e) {}
        global.waClient = null;
      }

      const client = new Client({
        authStrategy: new LocalAuth(),

        puppeteer: {
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',

          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage'
          ],

          headless: true,
          protocolTimeout: 300000
        }
      });

      client.on('qr', async (qr) => {

        console.log("QR kod olustu");

        const qrImage = await qrcode.toDataURL(qr);

        global.waStatus = "qr";

        io.emit('qr', qrImage);

      });

      client.on('ready', async () => {

        console.log("WhatsApp baglandi");

        global.waClient = client;
        global.waStatus = "connected";

        io.emit('wa_status', {
          status: 'connected',
          message: 'WhatsApp baglandi'
        });

        setTimeout(() => {
          loadGroups(client);
        }, 10000);

      });

      client.on('auth_failure', () => {

        console.log("Auth hatasi");

        global.waStatus = "disconnected";
        global.waClient = null;

        io.emit('wa_status', {
          status: 'disconnected',
          message: 'Kimlik dogrulama hatasi'
        });

      });

      client.on('disconnected', () => {

        console.log("WhatsApp baglantisi kesildi");

        global.waStatus = "disconnected";
        global.waClient = null;
        global.waGroups = [];

        io.emit('wa_status', {
          status: 'disconnected',
          message: 'Baglanti kesildi'
        });

      });

      await client.initialize();

      global.waStatus = "connecting";

      res.json({ status: "connecting" });

    } catch (err) {

      console.log("Baglanti hatasi:", err.message);

      res.status(500).json({
        error: err.message
      });

    }
  });

  // STATUS
  router.get('/status', (req, res) => {

    res.json({
      status: global.waStatus || "disconnected"
    });

  });

  // GRUP LISTESI
  router.get('/groups', async (req, res) => {

    try {

      if (!global.waClient || global.waStatus !== 'connected') {

        return res.status(400).json({
          error: "WhatsApp bagli degil"
        });

      }

      res.json(global.waGroups);

    } catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  });

  // MESAJ GONDER
  router.post('/send', async (req, res) => {

    try {

      if (!global.waClient || global.waStatus !== 'connected') {

        return res.status(400).json({
          error: "WhatsApp bagli degil"
        });

      }

      const { message, groupIds } = req.body;

      if (!message || !groupIds || groupIds.length === 0) {

        return res.status(400).json({
          error: "Mesaj ve grup gerekli"
        });

      }

      let sent = 0;
      let failed = 0;

      io.emit('sending_start', {
        total: groupIds.length
      });

      for (let i = 0; i < groupIds.length; i++) {

        try {

          await global.waClient.sendMessage(groupIds[i], message);

          sent++;

          io.emit('sending_progress', {
            sent,
            failed,
            total: groupIds.length,
            current: i + 1
          });

          // RANDOM DELAY
          const delay = 4000 + Math.random() * 4000;

          await new Promise(r => setTimeout(r, delay));

        } catch (e) {

          failed++;

          console.log("Mesaj gonderme hatasi:", e.message);

        }

      }

      io.emit('sending_done', {
        sent,
        failed,
        total: groupIds.length
      });

      res.json({
        success: true,
        sent,
        failed
      });

    } catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  });

  // BAGLANTIYI KES
  router.post('/disconnect', async (req, res) => {

    try {

      if (global.waClient) {

        await global.waClient.destroy();

        global.waClient = null;
        global.waStatus = "disconnected";
        global.waGroups = [];

      }

      res.json({
        success: true
      });

    } catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  });

  return router;

};