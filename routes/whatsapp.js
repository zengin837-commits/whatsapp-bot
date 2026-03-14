const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');

module.exports = (io) => {
  const router = express.Router();

  router.post('/connect', async (req, res) => {
    try {
      if (global.waClient && global.waStatus === 'connected') {
        return res.json({ status: global.waStatus });
      }

      const { state, saveCreds } = await useMultiFileAuthState('/tmp/auth_info');
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['WhatsApp Panel', 'Chrome', '1.0.0'],
      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          const qrImage = await qrcode.toDataURL(qr);
          global.waStatus = 'qr';
          io.emit('qr', qrImage);
        }

        if (connection === 'close') {
          global.waStatus = 'disconnected';
          global.waClient = null;
          global.waGroups = [];
          io.emit('wa_status', { status: 'disconnected', message: 'Bağlantı kesildi' });
        }

        if (connection === 'open') {
          global.waClient = sock;
          global.waStatus = 'connected';
          global.waGroups = [];
          io.emit('wa_status', { status: 'connected', message: 'WhatsApp bağlandı! ✅' });
          console.log('WhatsApp bağlandı, gruplar bekleniyor...');
        }
      });

      sock.ev.on('groups.update', (updates) => {
        console.log('Grup güncellemesi:', updates.length);
      });

      sock.ev.on('group-participants.update', (update) => {
        console.log('Grup katılımcı güncellemesi');
      });

      global.waStatus = 'connecting';
      res.json({ status: 'connecting' });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', (req, res) => {
    res.json({ status: global.waStatus || 'disconnected' });
  });

  router.get('/groups', async (req, res) => {
    try {
      if (!global.waClient || global.waStatus !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp bağlı değil' });
      }
      console.log('Gruplar çekiliyor...');
      const groups = await global.waClient.groupFetchAllParticipating();
      console.log('Ham grup sayısı:', Object.keys(groups).length);
      const groupList = Object.entries(groups).map(([id, g]) => ({
        id: id,
        name: g.subject,
        participants: g.participants?.length || 0
      }));
      console.log('Gruplar:', groupList.length);
      res.json(groupList);
    } catch (err) {
      console.log('Grup hatası:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/send', async (req, res) => {
    try {
      if (!global.waClient || global.waStatus !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp bağlı değil' });
      }
      const { message, groupIds } = req.body;
      if (!message || !groupIds || groupIds.length === 0) {
        return res.status(400).json({ error: 'Mesaj ve grup gerekli' });
      }
      let sent = 0, failed = 0;
      io.emit('sending_start', { total: groupIds.length });
      for (let i = 0; i < groupIds.length; i++) {
        try {
          await global.waClient.sendMessage(groupIds[i], { text: message });
          sent++;
          io.emit('sending_progress', { sent, failed, total: groupIds.length, current: i + 1 });
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          failed++;
        }
      }
      io.emit('sending_done', { sent, failed, total: groupIds.length });
      res.json({ success: true, sent, failed });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/disconnect', async (req, res) => {
    try {
      if (global.waClient) {
        await global.waClient.logout();
        global.waClient = null;
        global.waStatus = 'disconnected';
        global.waGroups = [];
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
