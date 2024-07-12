const mongoose = require("mongoose");
const { Schema } = mongoose;

const historySchema = new Schema({
    _id: String,
    relation: String,
    relationId: String,
    action: String,
    projectId: String,
    user_id: String
}, {
    autoCreate: false
});

const History = mongoose.model("TransactionLogs", historySchema, "col_TransactionLogs");

async function log(entry) {
    const _oid = new mongoose.mongo.ObjectId();
    
    let data = {
        _id: _oid,
        relation: entry._relation,
        relationId: entry._relation_id,
        action: entry._action + "_" + entry._relation,
        projectId: entry._projectId,
        user_id: entry._user
    }
    await History.create(data);
}

module.exports = {
    log
}