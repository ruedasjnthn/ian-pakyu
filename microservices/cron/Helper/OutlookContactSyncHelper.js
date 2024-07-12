const mongoose = require("mongoose");
const { OutlookSyncStatusTypesArray } = require("../constants/outlook");
const { Schema } = mongoose;

const contactSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  name: {
    first_name: {
      type: String,
      required: true,
    },
    last_name: {
      type: String,
      required: true,
    },
    middle_initial: {
      type: String,
    },
    nick_name: {
      type: String,
    },
    middle_name: {
      type: String,
    },
    title: {
      type: String,
    },
    suffix: {
      type: String,
    },
    yowi_first_name: {
      type: String,
    },
    yowi_last_name: {
      type: String,
    },
  },
  contact_information: {
    email: {
      type: String,
    },
    chat: {
      type: String,
    },
    home_number: {
      type: String,
    },
    mobile_number: {
      type: String,
    },
    business_number: {
      type: String,
    },
    organization_main: {
      type: String,
    },
    pager: {
      type: String,
    },
    other: {
      type: String,
    },
    home_fax: {
      type: String,
    },
    business_fax: {
      type: String,
    },
    other_fax: {
      type: String,
    },
    assistant_phone: {
      type: String,
    },
    callback_phone: {
      type: String,
    },
    radio_phone: {
      type: String,
    },
    telex: {
      type: String,
    },
    tty: {
      type: String,
    },
  },
  home_address: {
    home_address_street: {
      type: String,
    },
    home_address_city: {
      type: String,
    },
    home_address_state: {
      type: String,
    },
    home_address_zip: {
      type: String,
    },
    home_address_country: {
      type: String,
    }
  },
  business_address: {
    business_address_street: {
      type: String,
    },
    business_address_city: {
      type: String,
    },
    business_address_state: {
      type: String,
    },
    business_address_zip: {
      type: String,
    },
    business_address_country: {
      type: String,
    }
  },
  other_address: {
    other_address_street: {
      type: String,
    },
    other_address_city: {
      type: String,
    },
    other_address_state: {
      type: String,
    },
    other_address_zip: {
      type: String,
    },
    other_address_country: {
      type: String,
    }
  },
  work: {
    company: {
      type: String,
    },
    work_job_title: {
      type: String,
    },
    yowi_company: {
      type: String,
    }
  },
  other: {
    personal_webpage: {
      type: String,
    },
    significant_other: {
      type: String,
    },
    birth_day: {
      type: String,
    },
    Anniversary: {
      type: String,
    }
  },
  notes: {
    notes: {
      type: String,
    },
  },
  createdAt: {
    type: Date
  },
  updatedAt: {
    type: Date
  },
  deletedAt: {
    type: Date,
  },
  trash: Number,
  parentFolderId: {
    type: String,
  },
  lastModifiedDateTime: {
    type: Date
  },
  fromOutlook: {
    type: Boolean,
  },
  outlookId: {
    type: String,
  },
});

const outlookContactSyncSchema = new Schema({
  projectId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: OutlookSyncStatusTypesArray,
  },
  contacts: {
    type: [contactSchema],
    default: []
  },
  outlookContactIdsDeleted: {
    type: [String],
    default: []
  },
  outlookContactsUpdated: {
    type: [contactSchema],
    default: []
  },
  userId: {
    type: Schema.Types.ObjectId
  },
  nextLink: {
    type: String
  },
  deltaLink: {
    type: String
  },
  newDeltaLink: {
    type: String
  },
  isFirstSync: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date
  },
  initStartAt: {
    type: Date
  },
  initEndAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  syncStartAt: {
    type: Date
  },
  syncEndAt: {
    type: Date
  },
  started: {
    type: Boolean,
    default: false
  },
  finished: {
    type: Boolean,
    default: false
  },
  errMessage: {
    type: String
  }
});


const OutlookContactSync = mongoose.model("OutlookContactSync", outlookContactSyncSchema, "col_OutlookContactSyncs");

module.exports = { OutlookContactSync };
