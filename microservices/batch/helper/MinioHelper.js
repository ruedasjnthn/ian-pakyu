require("dotenv").config();
var Minio = require('minio');
const { loggerInfo } = require("../config/logger");

var minioClient = new Minio.Client({
    endPoint: process.env.StorageUrl,
    port: 9000,
    useSSL: true,
    accessKey: process.env.Username,
    secretKey: process.env.Password
});

function getPresignedUrl(fileName) {
    return new Promise(resolve => {
        // expires in a day.
        return minioClient.presignedPutObject(process.env.BucketName, fileName, 24 * 60 * 60, function (err, presignedUrl) {
            if (err) return loggerInfo(err)
            resolve(presignedUrl);
        })
    });
}

module.exports = {
    getPresignedUrl
}

