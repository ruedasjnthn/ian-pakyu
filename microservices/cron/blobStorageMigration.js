const { clientGqlMutate } = require('./Helper/gqlClientHelper')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('./config/logger');
const { Project } = require('./Helper/ProjectHelper');
const { getPresignedUrl, getFileUrl, getBlobStorageSettings, deleteFileObject } = require('./Helper/MinioHelper');
const { default: fetch } = require('node-fetch');
var FormData = require('form-data');
const { File } = require('./Helper/FileHelper');


async function CopyDataToCustomBlobStorage() {

    let pendingFiles = await Project.aggregate([
        {
            $match: {
                isCustomBlobStorageEnabled: true,
            },
        },
        {
            $lookup: {
                from: "col_UploadedFiles",
                localField: "_id",
                foreignField: "projectId",
                as: "files",
                pipeline: [
                    {
                        $match: {
                            migratedToCustomBlobStorageStatus: {
                                $exists: false,
                            },
                            isFolder: {
                                $ne: true,
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$files",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $replaceRoot: {
                newRoot: "$files",
            },
        },
    ]);

    for (var fileFound of pendingFiles) {

        try {

            const fileName = fileFound.blobPath;

            const projectFound = await Project.findById(fileFound.projectId);

            let blogStorageSettings = null;
            if (projectFound && projectFound.blobStorageSettings)
                blogStorageSettings = projectFound.blobStorageSettings


            if (fileName) {
                let fileNameParts = fileName.split('/');
                let fileNameInBucket = fileNameParts[fileNameParts.length - 1];
                let uploadUrl;
                uploadUrl = await getFileUrl(fileNameInBucket);

                const extFileName = fileFound._id + '_'
                //fetch from url
                const fileResp = await fetch(uploadUrl)
                // transform to arrayBuffer
                const fileBinaryBuffer = Buffer.from(await fileResp.arrayBuffer());

                //get presigned url and data [this can be different on your end]
                const presignedResponse = await getPresignedUrl(extFileName, blogStorageSettings)

                // build the formData 
                let formData = new FormData();

                formData.append("file", fileBinaryBuffer);

                const s3resp = await fetch(presignedResponse, {
                    method: "put",
                    body: formData,
                });
                console.log(s3resp);
                
                const blobPath = "/" + getBlobStorageSettings(blogStorageSettings).BucketName + "/" + extFileName;

                await File.findOneAndUpdate(
                    { _id: fileFound._id },
                    {
                        migratedToCustomBlobStorageStatus: "moved",
                        blobPath: blobPath
                    }
                );

            }


        } catch (error) {
            console.log(error)
        }
    }
}

async function RemoveMigratedFiles() {
    let pendingFiles = await Project.aggregate([
        {
            $match: {
                isCustomBlobStorageEnabled: true,
            },
        },
        {
            $lookup: {
                from: "col_UploadedFiles",
                localField: "_id",
                foreignField: "projectId",
                as: "files",
                pipeline: [
                    {
                        $match: {
                            migratedToCustomBlobStorageStatus: {
                                $exists: false,
                            },
                            isFolder: {
                                $ne: true,
                            },
                        },
                    },
                ],
            },
        },
        {
            $match: {
                files: {
                    $eq: [],
                },
            },
        },
        {
            $lookup: {
                from: "col_UploadedFiles",
                localField: "_id",
                foreignField: "projectId",
                as: "files",
                pipeline: [
                    {
                        $match: {
                            migratedToCustomBlobStorageStatus:
                                "moved",
                            isFolder: {
                                $ne: true,
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: {
                path: "$files",
                preserveNullAndEmptyArrays: false,
            },
        },
        {
            $replaceRoot: {
                newRoot: "$files",
            },
        },
    ]);

    for (const fileItem of pendingFiles) {
        let storageResponse;

        const fileName = fileItem.blobPath;
        if (fileName) {
            const fileNameParts = fileName.split('/');
            const fileNameInBucket = fileNameParts[fileNameParts.length - 1];
            storageResponse = await deleteFileObject(fileNameInBucket);

            await File.findOneAndUpdate(
                { _id: fileItem._id },
                {
                    migratedToCustomBlobStorageStatus: "migrated"
                }
            );
        }
    }
}

module.exports = {
    CopyDataToCustomBlobStorage,
    RemoveMigratedFiles
};