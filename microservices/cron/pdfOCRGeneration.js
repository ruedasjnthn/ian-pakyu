const { clientGqlMutate } = require('./Helper/gqlClientHelper')
const { gql } = require("@apollo/client");
const { loggerInfo, loggerError } = require('./config/logger');
const { Project } = require('./Helper/ProjectHelper');

async function ProceessPendingOCRFiles() {
    try {
        const pendingPDfFiles = await Project.aggregate([
            {
                $match: {
                    autoEnabledOCR: true,
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
                                uploadFinished: true,
                                type: "application/pdf",
                            },
                        },
                    ],
                },
            },
            {
                $lookup: {
                    from: "col_PdfAnnotations",
                    localField: "_id",
                    foreignField: "fileId",
                    as: "pfAnnotations",
                },
            },
            {
                $unwind: {
                    path: "$files",
                },
            },
            {
                $replaceRoot: {
                    newRoot: "$files",
                },
            },
            {
                $lookup: {
                    from: "col_PdfAnnotations",
                    localField: "_id",
                    foreignField: "fileId",
                    as: "pfAnnotations",
                },
            },
            {
                $match: {
                    "pfAnnotations.0": {
                        $exists: false,
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                },
            },
        ]);
// old query
        // [
        //     {
        //         '$lookup': {
        //             'from': 'col_PdfAnnotations',
        //             'localField': '_id',
        //             'foreignField': 'fileId',
        //             'as': 'pfAnnotations'
        //         }
        //     }, {
        //         '$match': {
        //             'pfAnnotations.0': {
        //                 '$exists': false
        //             },
        //             'type': 'application/pdf'
        //         }
        //     }, {
        //         '$lookup': {
        //             'from': 'col_Projects',
        //             'localField': 'projectId',
        //             'foreignField': '_id',
        //             'as': 'projectInfo'
        //         }
        //     }, {
        //         '$unwind': {
        //             'path': '$projectInfo'
        //         }
        //     }, {
        //         '$match': {
        //             'projectInfo.autoEnabledOCR': true,
        //             'uploadFinished': true
        //         }
        //     }, {
        //         '$project': {
        //             'pfAnnotations': 0,
        //             'projectInfo': 0
        //         }
        //     }
        // ]
        
        
        loggerInfo(pendingPDfFiles);

        for (const pdfFile of pendingPDfFiles) {
            const mutationObject = {
                mutation: gql`
                        mutation GeneratePdfOcr($fileId: String!) {
                            generatePdfOcr(fileId: $fileId) {
                                annotations
                                fileId
                                ocrJson
                            }
                        }
                   `,
                variables: {
                    "fileId": pdfFile._id,
                },
            }

            const { data } = await clientGqlMutate(mutationObject)
        }

    } catch (error) {
        loggerError(`Error in ProceessPendingOCRFiles :: `, { error });
    }
}

module.exports = {
    ProceessPendingOCRFiles,
};