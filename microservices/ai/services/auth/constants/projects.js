const ProjectCategory = {
  SOFTWARE: 'software',
  MARKETING: 'marketing',
  BUSINESS: 'business',
};

const ProjectCategoryArray = [
  ProjectCategory.SOFTWARE,
  ProjectCategory.MARKETING,
  ProjectCategory.BUSINESS,
]

const DefaultProjectColumns = [
  {
    key: 'backlog',
    title: 'Backlog',
    position: 0,
  },
  {
    key: 'selectedfordevelopment',
    title: 'Selected for development',
    position: 1,
  },
  {
    key: 'inprogress',
    title: 'In progress',
    position: 2,
  },
  {
    key: 'done',
    title: 'Done',
    position: 3,
  },
];

const UserRole = {
  ADMINISTRATOR: 'administrator',
  GUEST: 'guest',
  OWNER: 'owner',
  VIEW_ASSIGNED_FILES: 'view_assigned_files',
};

const ProjectUserRoles = [
  UserRole.ADMINISTRATOR,
  UserRole.GUEST,
  UserRole.OWNER,
  UserRole.VIEW_ASSIGNED_FILES,
]

const FieldTypes = {
  SHORT_TEXT: 'short_text',
  PARAGRAPH: "paragraph",
  DATE: "date",
  LABEL: "label",
  DROPDOWN: "dropdown",
  CHECKBOX: "checkbox",
  ISSUE_IMAGE: "issue_image",
}

const FieldTypesArray = [
  FieldTypes.SHORT_TEXT,
  FieldTypes.PARAGRAPH,
  FieldTypes.DATE,
  FieldTypes.LABEL,
  FieldTypes.DROPDOWN,
  FieldTypes.CHECKBOX,
  FieldTypes.ISSUE_IMAGE
]

const DefaultTimeZone = "Europe/Berlin"

const DefaultTableColumns = [
  {
    dataKey: 'title',
    label: 'title',
    default: true
  },
  {
    dataKey: 'status',
    label: 'column',
    default: true
  },
  {
    dataKey: 'priority',
    label: 'priority',
    default: true
  },
  {
    dataKey: 'assignees',
    label: 'assignees',
    default: true
  }
];

module.exports = {
  ProjectUserRoles,
  DefaultProjectColumns,
  ProjectCategoryArray,
  UserRole,
  FieldTypes,
  FieldTypesArray,
  DefaultTimeZone,
  DefaultTableColumns
}
