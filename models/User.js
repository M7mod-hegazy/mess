const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true }
}, { _id: true });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true, trim: true },
  displayName: { type: String, trim: true },
  photoURL: { type: String },
  googleId: { type: String, unique: true, sparse: true },
  managedParticipants: [participantSchema],
  role: { type: String, default: 'leader' },
  // Add other fields as needed (e.g., email, role)
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);