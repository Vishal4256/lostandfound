const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: '' }, // initials fallback used in UI
}, { timestamps: true });

// Compare plain password with stored hash
userSchema.methods.comparePassword = function(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never send passwordHash in JSON responses
userSchema.set('toJSON', {
  transform(_, obj) {
    delete obj.passwordHash;
    return obj;
  }
});

module.exports = mongoose.model('User', userSchema);
