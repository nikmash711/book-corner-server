'use strict';

const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  title: { type: String, required: true },
  img: { type: String, required: true },
  available: { type: Boolean, required: true },
  type: { type: String, required: true  },
  checkedOutBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  holdQueue: [{type: mongoose.Schema.Types.ObjectId, ref: 'User'}],
  dueDate: { type: String },
  renewals: { type: Number },
});

//// Customize output for `res.json(data)`, `console.log(data)` etc.
mediaSchema.set('toJSON', {
  virtuals: true,     // include built-in virtual `id`
  transform: (doc, ret) => {
    delete ret._id; // delete `_id`
    delete ret.__v; //delete _v
  }
});

const Media = mongoose.model('Media', mediaSchema); 

module.exports = Media;