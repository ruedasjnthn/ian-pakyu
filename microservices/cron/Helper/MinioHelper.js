require("dotenv").config();
var Minio = require('minio');
const { loggerInfo } = require("../config/logger");
var crypto = require('crypto');


function getBlobStorageSettings(ecryptedBlobSettings) {
    if (ecryptedBlobSettings) {
        var decipher = crypto.createDecipher('aes256', process.env.JwtToken);
        var decrypted = decipher.update(ecryptedBlobSettings, 'hex', 'utf8') + decipher.final('utf8');
        var blobSettings = JSON.parse(decrypted);
        if (blobSettings.storageUrl &&
            blobSettings.userName &&
            blobSettings.secret &&
            blobSettings.bucketName &&
            blobSettings.isEnabled) {
            return {
                StorageUrl: blobSettings.storageUrl,
                UserName: blobSettings.userName,
                Password: blobSettings.secret,
                BucketName: blobSettings.bucketName
            }
        }
    }
    return {
        StorageUrl: process.env.StorageUrl,
        UserName: process.env.Username,
        Password: process.env.Password,
        BucketName: process.env.BucketName
    }
}
function getMinioClient(blobSettings) {
    const settings = getBlobStorageSettings(blobSettings)
    var minioClient = new Minio.Client({
        endPoint: settings.StorageUrl,
        port: 443,
        useSSL: true,
        accessKey: settings.UserName,
        secretKey: settings.Password
    });
    return minioClient;
}

function getPresignedUrl(fileName, blobSettings) {
    return new Promise((resolve, reject) => {
        const storageSetting = getBlobStorageSettings(blobSettings);
        const minioClient = getMinioClient(blobSettings);
        // expires in a day.
        return minioClient.presignedPutObject(storageSetting.BucketName, fileName, 1 * 60 * 60, function (err, presignedUrl) {
            if (err) { reject(); return loggerInfo(err) }
            resolve(presignedUrl);
        })

    });
}

function getFileUrl(fileName, blobSettings) {
    return new Promise((resolve, reject) => {
        const storageSetting = getBlobStorageSettings(blobSettings);
        const minioClient = getMinioClient(blobSettings);

        // expires in a day.
        return minioClient.presignedGetObject(storageSetting.BucketName, fileName, 180, function (err, presignedUrl) {
            if (err) { reject(); return loggerInfo(err) }
            resolve(presignedUrl);
        })
    });
}

function deleteFileObject(fileName, blobSettings) {
    return new Promise(resolve => {
        const storageSetting = getBlobStorageSettings(blobSettings);
        const minioClient = getMinioClient(blobSettings);

        minioClient.removeObject(storageSetting.BucketName, fileName, function (err) {
            if (err) {
                resolve(false);
            }
            resolve(true);
        })
    });

}

module.exports = {
    getPresignedUrl,
    getFileUrl,
    deleteFileObject,
    getBlobStorageSettings
}

