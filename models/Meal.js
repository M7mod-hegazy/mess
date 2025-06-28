const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  ingredientType: { type: String, enum: ['normal', 'other'], default: 'normal' }
}, { _id: false });

const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contribution: { type: Number, default: 0 }
}, { _id: false });

const mealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  type: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'other'], required: true },
  ingredients: [ingredientSchema],
  participants: [participantSchema],
  periodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Period', required: true },
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  normalTotalCost: { type: Number, default: 0 },
  otherTotalCost: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 }
}, { timestamps: true });

// Pre-save hook to calculate costs
mealSchema.pre('save', function(next) {
  const meal = this;
  meal.normalTotalCost = (meal.ingredients || []).filter(i => i.ingredientType === 'normal').reduce((sum, i) => sum + i.price, 0);
  meal.otherTotalCost = (meal.ingredients || []).filter(i => i.ingredientType === 'other').reduce((sum, i) => sum + i.price, 0);
  meal.totalCost = meal.normalTotalCost + meal.otherTotalCost;
  next();
});

module.exports = mongoose.model('Meal', mealSchema); 