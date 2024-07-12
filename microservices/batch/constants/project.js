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
module.exports = {
  UserRole,
  ProjectUserRoles
}
