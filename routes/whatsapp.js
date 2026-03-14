const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const qrcode = require('qrcode');

module.exports = (io) => {
  const router = express.Router();

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
        authStrategy: new RemoteAuth({
          store: new MongoStore({ mongoose }),
          backupSyncIntervalMs: 300000
        }),
        puppeteer: {
          executablePath: '/usr/bin/chromium',
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
          headless: true,
          protocolTimeout: 120000
        }
      });

      client.on('qr', async (qr) => {
        const qrImage = await qrcode.toDataURL(qr);
        global.waStatus = 'qr';
        io.emit('qr', qrImage);
      });

      client.on('ready', async () => {
        global.waClient = client;
        global.waStatus = 'connected';
        io.emit('wa_status', { status: 'connected', message: 'WhatsApp bağlandı! ✅' });
      });

      client.on('auth_failure', () => {
        global.waStatus = 'disconnected';
        global.waClient = null;
        io.emit('wa_status', { status: 'disconnected', message: 'Hata, tekrar deneyin' });
      });

      client.on('disconnected', () => {
        global.waStatus = 'disconnected';
        global.waClient = null;
        io.emit('wa_status', { status: 'disconnected', message: 'Bağlantı kesildi' });
      });

      client.initialize().catch(err => {
        global.waStatus = 'disconnected';
        global.waClient = null;
        io.emit('wa_status', { status: 'disconnected', message: 'Bağlantı başlatılamadı' });
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
      await new Promise(r => setTimeout(r, 3000));
      const chats = await global.waClient.getChats();
      const groups = chats
        .filter(c => c.isGroup)
        .map(g => ({ id: g.id._serialized, name: g.name, participants: g.participants?.length || 0 }));
      res.json(groups);
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
          await global.waClient.sendMessage(groupIds[i], message);
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
        await global.waClient.destroy();
        global.waClient = null;
        global.waStatus = 'disconnected';
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};