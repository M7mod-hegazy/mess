const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true }
}, { _id: true });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true, trim: true },
  managedParticipants: [participantSchema],
  // Add other fields as needed (e.g., email, role)
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);