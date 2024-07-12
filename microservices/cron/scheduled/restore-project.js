const { Project } = require('../Helper/ProjectHelper')
const { RestoreProject } = require('../Helper/RestoreProjectJobHelper')
const { Backup } = require('../Helper/BackupJobHelper');
const { loggerInfo, loggerError } = require('../config/logger')

const fetchBackupProjects = async () => {
    let toRestoreProjects = [];
    try {
        loggerInfo('Start validating project...')
        const projects = await Project.find({});

        if(projects.length) {
            toRestoreProjects = await Promise.all(projects.map(async ({_id}) => {
                const data = await Backup.collection.findOne({projectId: String(_id)}, {sort: { backupDate: -1 }});
                const isRestoreExist = data !== null ? await RestoreProject.countDocuments({filepath: data.filepath}) : 1;

                if (isRestoreExist == 0) {
                    return {
                        projectId: data.projectId,
                        filepath: data.filepath,
                        restoreDate: new Date(),
                        isRestored: false
                    }
                }
            }))
        }
    } catch (error) {
        loggerError({ error });
    }
    //filter undefined values before returning
    return toRestoreProjects.filter(x => x)
}

async function asyncRunRestoreProject() {
    try {
        const backupProjects = await fetchBackupProjects();
        if(backupProjects.length){
            return RestoreProject.insertMany(backupProjects);
        }
    } catch(error) {
        loggerError(`Error saving to col_RestoreProjects:: `, { error });
    }
}

module.exports = asyncRunRestoreProject;