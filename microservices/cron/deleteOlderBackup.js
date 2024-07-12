require("dotenv").config();

const Minio = require('minio');
const ftp = require('basic-ftp');
const { loggerInfo, loggerError } = require('./config/logger')

const { Backup } = require('./Helper/BackupJobHelper');

let minioClient = new Minio.Client({
    endPoint: process.env.StorageUrl,
    port: 443,
    useSSL: true,
    accessKey: process.env.UsernameCC,
    secretKey: process.env.Password
});

async function deleteFtpFolders(paths) {
    const client = new ftp.Client(0)
    try {
        await client.access({
            host: process.env.FtpHost,
            user: process.env.FtpUser,
            password: process.env.FtpPassword,
            secure: true
        })
        for (const path of paths){
          await client.removeDir(path);
          loggerInfo('deleting ', path)
        }
    }
    catch (err) {
        loggerError({ err })
    }

    client.close()
}

async function deleteS3Backups(filepaths) {
  const remove = await new Promise((resolve, reject) => {
    minioClient.removeObjects(process.env.BackupUpload, filepaths, function(e) {
      if (e) {
          loggerError ('Unable to remove Objects ', { e })
          resolve(false)
      }
      loggerInfo('Removed the objects successfully')
      resolve(true)
    })
  });
  loggerInfo(`remove file from s3`, remove)
  
  //list S3 length
  // const objList = await new Promise((resolve, reject) => {
  //   const objectsListTemp = [];
    
  //   const streams = minioClient.listObjects(process.env.BackupUpload, '', true);

  //   streams.on('data', obj => {
  //     objectsListTemp.push(obj.name)
  //   });
  //   streams.on('error', reject);
  //   streams.on('end', () => {
  //     resolve(objectsListTemp)
  //   });
  // });
}

async function deleteOlderBackup() {
  let now = new Date();
  // Set the date 14 days in the past
  now = new Date(now.setDate(now.getDate()-14));
  const backupsToDelete = await Backup.find({backupDate: {$lte: now}, ftpDir: {$exists: true}});
  const filepaths = backupsToDelete.map(({filepath}) => filepath)
  let ftpPaths = [];
  backupsToDelete.forEach(({ftpDir}) => {
      if (!ftpPaths.includes(ftpDir)) {
          ftpPaths.push(ftpDir);
      }
  });
  
  const [ , , deleted] = await Promise.all([
    deleteFtpFolders(ftpPaths),
    deleteS3Backups(filepaths),
    Backup.deleteMany({filepath: {$in: filepaths}}),
  ])
  loggerInfo('deleted backups in database', deleted)
}

module.exports = deleteOlderBackup