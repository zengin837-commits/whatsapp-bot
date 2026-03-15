const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");

module.exports = (io) => {
  const router = express.Router();

  // Global durumlar
  global.waClient = global.waClient || null;
  global.waStatus = global.waStatus || "disconnected";

  // WhatsApp Client oluştur
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
          "--disable-background-networking",
        ],
      },
    });

    client.on("qr", async (qr) => {
      const qrImage = await qrcode.toDataURL(qr);
      global.waStatus = "qr";
      io.emit("qr", qrImage);
      console.log("QR kod oluşturuldu");
    });

    client.on("ready", () => {
      global.waClient = client;
      global.waStatus = "connected";
      io.emit("wa_status", { status: "connected", message: "WhatsApp bağlandı" });
      console.log("WhatsApp hazır");
    });

    client.on("disconnected", () => {
      global.waClient = null;
      global.waStatus = "disconnected";
      io.emit("wa_status", { status: "disconnected", message: "Bağlantı kesildi" });
      console.log("WhatsApp bağlantısı kesildi");
    });

    client.on("auth_failure", () => {
      global.waClient = null;
      global.waStatus = "disconnected";
      console.log("WhatsApp auth hatası");
    });

    return client;
  };

  // BAĞLAN
  router.post("/connect", async (req, res) => {
    try {
      if (global.waClient && global.waStatus === "connected") {
        return res.json({ status: "connected" });
      }
      if (global.waClient) {
        try { await global.waClient.destroy(); } catch {}
      }
      const client = createClient();
      global.waClient = client;
      global.waStatus = "connecting";
      await client.initialize();
      res.json({ status: "connecting" });
    } catch (err) {
      console.log("Connect hatası:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DURUM
  router.get("/status", (req, res) => {
    res.json({ status: global.waStatus || "disconnected" });
  });

  // GRUPLARI ÇEK
  router.get("/groups", async (req, res) => {
    try {
      if (!global.waClient || global.waStatus !== "connected") {
        return res.status(400).json({ error: "WhatsApp bağlı değil" });
      }

      // 30 saniye bekleyip chatleri çek (Railway timeout için)
      await new Promise((r) => setTimeout(r, 30000));

      const chats = await global.waClient.getChats();
      const groups = chats
        .filter((c) => c.isGroup)
        .map((g) => ({
          id: g.id._serialized,
          name: g.name || "Grup",
          participants: g.participants ? g.participants.length : 0,
        }));

      res.json(groups);
    } catch (err) {
      console.log("Grup çekme hatası:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // MESAJ GÖNDER
  router.post("/send", async (req, res) => {
    try {
      if (!global.waClient || global.waStatus !== "connected") {
        return res.status(400).json({ error: "WhatsApp bağlı değil" });
      }

      const { message, groupIds } = req.body;
      if (!message || !groupIds || groupIds.length === 0) {
        return res.status(400).json({ error: "Mesaj ve grup gerekli" });
      }

      let sent = 0, failed = 0;
      io.emit("sending_start", { total: groupIds.length });

      for (let i = 0; i < groupIds.length; i++) {
        try {
          await global.waClient.sendMessage(groupIds[i], message);
          sent++;
          io.emit("sending_progress", { sent, failed, total: groupIds.length, current: i + 1 });

          // 5-10 saniye random delay spam riskini azaltır
          const delay = 5000 + Math.random() * 5000;
          await new Promise((r) => setTimeout(r, delay));
        } catch {
          failed++;
        }
      }

      io.emit("sending_done", { sent, failed, total: groupIds.length });
      res.json({ success: true, sent, failed });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // BAĞLANTIYI KES
  router.post("/disconnect", async (req, res) => {
    try {
      if (global.waClient) {
        await global.waClient.destroy();
        global.waClient = null;
        global.waStatus = "disconnected";
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
