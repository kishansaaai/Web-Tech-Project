// models/Search.js
import mongoose from 'mongoose';

const SearchSchema = new mongoose.Schema({
  city: { type: String, required: true },
  country: String,
  latitude: Number,
  longitude: Number,
  unit: { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  favorited: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Search || mongoose.model('Search', SearchSchema);



