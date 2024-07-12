const { Project } = require('../Helper/ProjectHelper')
const { File } = require('../Helper/FileHelper')
const { loggerInfo, loggerError } = require('../config/logger')

async function saveTotalSizePerProject() {
    try {
        const uploadedFiles = await File.aggregate([
            {
                $group: {
                    _id: '$_id',
                    projectId: { $first: "$projectId" },
                    totalSize: { $sum: "$size" },
                    fileCount: { $sum: 1 }
                }
            }
        ]);

        loggerInfo({ uploadedFiles })

        for (const uploadedFile of uploadedFiles) {
            await Project.updateOne({ _id: uploadedFile.projectId }, { $set: { filesTotalSize: uploadedFile.totalSize } })
        }

    } catch (error) {
        loggerError(`Error getting total from col_UploadedFiles:: `, { error });
    }
}

module.exports = {
    saveTotalSizePerProject,
};