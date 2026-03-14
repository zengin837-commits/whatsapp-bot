const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  groups: [{ id: String, name: String }],
  status: { type: String, enum: ['pending', 'sending', 'sent', 'failed'], default: 'pending' },
  sentCount: { type: Number, default: 0 },
  failCount: { type: Number, default: 0 },
  isScheduled: { type: Boolean, default: false },
  scheduledAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
