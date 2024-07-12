const mongoose = require('mongoose');
const { Schema } = mongoose;

const subscriptionSchema = new Schema({
  userId: {
    type: mongoose.Types.ObjectId,
  },
  subscriptionId: {
    type: String,
  },
  projectId: {
    type: mongoose.Types.ObjectId,
  },
  expirationDateTime: {
    type: Date,
  },
  resource: {
    type: String,
  },
  subsUpdatedAt: {
    type: Date
  }
});

const Subscription = mongoose.model(
  'Subscription',
  subscriptionSchema,
  'col_Subscriptions',
);

module.exports = { Subscription };
