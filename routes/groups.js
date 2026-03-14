const express = require('express');
const router = express.Router();

// WhatsApp'tan grupları getir (proxy)
router.get('/', async (req, res) => {
  try {
    if (!global.waClient || global.waStatus !== 'connected') {
      return res.status(400).json({ error: 'WhatsApp bağlı değil' });
    }
    const chats = await global.waClient.getChats();
    const groups = chats
      .filter(c => c.isGroup)
      .map(g => ({ id: g.id._serialized, name: g.name, participants: g.participants?.length || 0 }));
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
