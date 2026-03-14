const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gizli-anahtar-123';

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token gerekli' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz token' });
  }
};

// Mesaj geçmişi
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Message.find({ user: req.userId }).sort({ createdAt: -1 }).limit(50);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mesaj kaydet
router.post('/', auth, async (req, res) => {
  try {
    const { content, groups, status, sentCount, failCount } = req.body;
    const message = new Message({ user: req.userId, content, groups, status, sentCount, failCount });
    await message.save();
    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
