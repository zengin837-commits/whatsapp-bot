
const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
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

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
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
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          global.waStatus = 'disconnected';
          global.waClient = null;
          global.waGroups = [];
          io.emit('wa_status', { status: 'disconnected', message: 'Bağlantı kesildi' });
          if (shouldReconnect) {
            setTimeout(() => {}, 3000);
          }
        }

        if (connection === 'open') {
          global.waClient = sock;
          global.waStatus = 'connected';
          global.waGroups = [];
          io.emit('wa_status', { status: 'connected', message: 'WhatsApp bağlandı! ✅' });

          setTimeout(async () => {
            try {
              const groups = await sock.groupFetchAllParticipating();
              global.waGroups = Object.values(groups).map(g => ({
                id: g.id,
                name: g.subject,
                participants: g.participants?.length || 0
              }));
              io.emit('groups_loaded', global.waGroups);
            } catch(e) {
              console.log('Grup yükleme hatası:', e.message);
            }
          }, 5000);
        }
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

  router.get('/groups', (req, res) => {
    try {
      if (!global.waClient || global.waStatus !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp bağlı değil' });
      }
      res.json(global.waGroups || []);
    } catch (err) {
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
