const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

module.exports = (io) => {

  const router = express.Router();

  global.waClient = global.waClient || null;
  global.waStatus = global.waStatus || "disconnected";

  // CLIENT OLUŞTUR
  const createClient = () => {

    const client = new Client({

      authStrategy: new LocalAuth(),

      puppeteer: {

        executablePath:
          process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",

        headless: true,

        protocolTimeout: 600000,

        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-networking"
        ]
      }
    });

    client.on("qr", async (qr) => {

      console.log("QR kod oluşturuldu");

      const qrImage = await qrcode.toDataURL(qr);

      global.waStatus = "qr";

      io.emit("qr", qrImage);

    });

    client.on("ready", () => {

      console.log("WhatsApp bağlandı");

      global.waClient = client;
      global.waStatus = "connected";

      io.emit("wa_status", {
        status: "connected",
        message: "WhatsApp bağlandı"
      });

    });

    client.on("disconnected", () => {

      console.log("WhatsApp bağlantısı kesildi");

      global.waClient = null;
      global.waStatus = "disconnected";

      io.emit("wa_status", {
        status: "disconnected",
        message: "Bağlantı kesildi"
      });

    });

    client.on("auth_failure", () => {

      console.log("Auth hatası");

      global.waClient = null;
      global.waStatus = "disconnected";

    });

    return client;
  };

  // WHATSAPP CONNECT
  router.post("/connect", async (req, res) => {

    try {

      if (global.waClient && global.waStatus === "connected") {
        return res.json({ status: "connected" });
      }

      if (global.waClient) {
        try { await global.waClient.destroy(); } catch (e) {}
      }

      const client = createClient();

      global.waClient = client;
      global.waStatus = "connecting";

      await client.initialize();

      res.json({ status: "connecting" });

    } catch (err) {

      console.log("Bağlantı hatası:", err.message);

      res.status(500).json({
        error: err.message
      });

    }

  });

  // STATUS
  router.get("/status", (req, res) => {

    res.json({
      status: global.waStatus || "disconnected"
    });

  });

  // GRUPLARI ÇEK (LIVE)
  router.get("/groups", async (req, res) => {

    try {

      if (!global.waClient || global.waStatus !== "connected") {

        return res.status(400).json({
          error: "WhatsApp bağlı değil"
        });

      }

      console.log("Gruplar çekiliyor...");

      const chats = await global.waClient.getChats();

      const groups = chats
        .filter(chat => chat.isGroup)
        .map(g => ({
          id: g.id._serialized,
          name: g.name || "Grup"
        }));

      res.json(groups);

    } catch (err) {

      console.log("Grup çekme hatası:", err.message);

      res.status(500).json({
        error: err.message
      });

    }

  });

  // MESAJ GÖNDER
  router.post("/send", async (req, res) => {

    try {

      if (!global.waClient || global.waStatus !== "connected") {

        return res.status(400).json({
          error: "WhatsApp bağlı değil"
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

      io.emit("sending_start", {
        total: groupIds.length
      });

      for (let i = 0; i < groupIds.length; i++) {

        try {

          await global.waClient.sendMessage(groupIds[i], message);

          sent++;

          io.emit("sending_progress", {
            sent,
            failed,
            total: groupIds.length,
            current: i + 1
          });

          const delay = 5000 + Math.random() * 5000;

          await new Promise(r => setTimeout(r, delay));

        } catch (err) {

          failed++;

        }

      }

      io.emit("sending_done", {
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

  // DISCONNECT
  router.post("/disconnect", async (req, res) => {

    try {

      if (global.waClient) {

        await global.waClient.destroy();

        global.waClient = null;
        global.waStatus = "disconnected";

      }

      res.json({ success: true });

    } catch (err) {

      res.status(500).json({
        error: err.message
      });

    }

  });

  return router;

};
