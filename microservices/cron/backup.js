require("dotenv").config();

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const MongoClient = require("mongodb").MongoClient;
const Minio = require('minio');
const ftp = require('basic-ftp');
const chokidar = require('chokidar');
const { loggerInfo, loggerError } = require('./config/logger')

const PATH_SEP = path.sep;
const dir = process.env.TemDir
const zip_dir = dir + PATH_SEP + new Date().toISOString().slice(0, 10);
const url = process.env.DATABASE_URL;
const databasename = process.env.DATABASE_NAME;
const collections = process.env.Collections
const cols = collections ? collections.split(";") : [];

let minioClient = new Minio.Client({
    endPoint: process.env.StorageUrl,
    port: 443,
    useSSL: true,
    accessKey: process.env.UsernameCC,
    secretKey: process.env.Password
});

const createProjectFolder = (folder) => {
    loggerInfo('before folder');
    if (!fs.existsSync(folder)) {
        loggerInfo('Creating directory for ', folder)
        fs.mkdirSync(folder);
        return true;
    }
    return false;
}

const fileDownload = async (folder, collection, records) => {
    if (collection === 'col_UploadedFiles') {
        let filePath = `${folder}${PATH_SEP}files`;
        if (createProjectFolder(`${filePath}`)) {
            records.forEach(record => {
                if (record.blobPath !== undefined) {
                    let blobPath = record.blobPath.split("/")[2]
                    let fileName = path.parse(record.fileName).base;
                    let ws = fs.createWriteStream(`${filePath}${PATH_SEP}${fileName}`)
                    minioClient.getObject(process.env.BucketName, blobPath, function (err, dataStream) {
                        if (err) {
                        }
                        if (dataStream) {
                            dataStream.pipe(ws)
                        }
                    })
                }
            })
        }
    }
}

async function zipProjectFolder(folder, fn, fnS3) {
    loggerInfo('Start zipping the project')
    await Promise.all(cols.map(async (collection) => {
        let records = await fn(collection)
        if (records && records.length > 0) {
            fs.writeFileSync(`${folder}${PATH_SEP}${collection.toLowerCase()}.json`, JSON.stringify(records))
            fileDownload(folder, collection, records)
            loggerInfo('file downloading:: ', folder)
        }
    }));

    //wait until all collections have been exported to json file.
    zipDirectory(folder, `${folder}.zip`, fnS3, true)
    loggerInfo(`Done zipping project :: ${folder}.zip`)
}

async function zipDirectory(sourceDir, outPath, fn, isMove) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(outPath);
    const project_zip_path = `${zip_dir}${PATH_SEP}${path.basename(outPath)}`;
    archive
        .directory(sourceDir, false)
        .on('error', err => loggerError(`Error zip :: `, { err }))
        .pipe(stream);

    await archive.finalize();
    if (isMove) {
        fs.renameSync(outPath, project_zip_path, function (err) {
            if (err) throw err
        })
    }

    await fn(project_zip_path)
}

const exportProject = (project, connection, ftpDir) => {
    loggerInfo('Exporting the project to directory')
    return new Promise((resolve, reject) => {
        const projectId = project._id;
        const folder = `${dir}${PATH_SEP}${projectId}-${new Date().getTime()}`;

        try {
            if (createProjectFolder(folder)) {
                //export project to json
                fs.writeFileSync(`${folder}${PATH_SEP}col_projects.json`, JSON.stringify(project))

                zipProjectFolder(folder,
                    (collection) => connection.collection(collection).find({ projectId: projectId }).toArray(),
                    (path) => uploadS3(`${path}`, connection, ftpDir))

                resolve()
            }
        } catch (error) {
            loggerError('Error while exporting:: ', { error })
            reject(error)
        }
    })
}

async function runAsyncBackup() {
    loggerInfo("function start");
    if (createProjectFolder(`${dir}`) && createProjectFolder(`${zip_dir}`)) {
        loggerInfo("Running Async Backup...");
        let client = await MongoClient.connect(url);
        let connection = client.db(databasename);
        const ftpDir = `${new Date().toISOString().slice(0, 10)}_${new Date().getTime()}`
        
        let projects = await connection.collection("col_Projects").find().toArray();
        let totalProjects = projects.length;

        loggerInfo(`Total Project(s) :: ${totalProjects}`)

        Promise.all(projects.map(async (project) => {
            exportProject(project, connection, ftpDir)
                .catch(err => loggerError(`Error Exporting :: `, { err }))
        }))
        //wait until exported/zip and uploaded to s3
        const watcher = chokidar.watch(`${zip_dir}${PATH_SEP}*.zip`);
        var counter = 0;
        var isUpload = false;

        watcher.on('add', function (filePath) {
            counter++;
            loggerInfo(`path :: ${filePath}`)
            if (counter === totalProjects && !isUpload) {
                loggerInfo(`Uploading all ${totalProjects} zip projects`)
                ftpUpload(`${zip_dir}`)
                isUpload = true;
            }
        })
    }
}

async function ftpUpload(filePath, ftpDir) {
    const client = new ftp.Client(0)
    try {
        loggerInfo('ftp uploading::', filePath, ftpDir)
        await client.access({
            host: process.env.FtpHost,
            user: process.env.FtpUser,
            password: process.env.FtpPassword,
            secure: true
        })
        await client.ensureDir(ftpDir)
        await client.uploadFromDir(`${filePath}`, ftpDir)
    }
    catch (err) {
        loggerError({ err })
    }

    client.close()
    removeTempDir()
}

function uploadS3(fileToUploadZip, connection, ftpDir) {
    loggerInfo(`uploading to s3 from::${fileToUploadZip} `)
    let baseFile = path.basename(fileToUploadZip);
    let split = baseFile.split("-")
    // let timestamp = split[1];
    let projectId = split[0];

    let filePath = `${projectId}${PATH_SEP}${baseFile} `

    let fileStream = fs.createReadStream(fileToUploadZip)

    fs.stat(fileToUploadZip, function (err, stats) {
        if (err) {
            return loggerError( { err })
        }
        minioClient.putObject(process.env.BackupUpload, baseFile, fileStream, stats.size, function (err, objInfo) {
            if (err) {
                return loggerError({ err }) // err should be null
            }
            loggerInfo("Success", objInfo)
            //save details in the database
            try {
                loggerInfo('Start saving to col_Backups:: ', { baseFile })
                connection.collection('col_Backups').insertOne({
                    projectId: projectId,
                    filepath: baseFile,
                    backupDate: new Date(),
                    ftpDir: ftpDir,
                })
            } catch (error) {
                loggerError(`Error saving to col_Backup:: `, { error })
            }
        })
    });
}

function removeTempDir() {
    loggerInfo('removing temp directory::', dir)
    fs.rmdir(dir, {
        recursive: true,
        force: true
    }, (error) => {
        if (error) {
            loggerError({ error });
        } else {
            loggerInfo("Recursive: Directories Deleted!");
            
            // Get the current filenames
            // in the directory to verify
            getCurrentFilenames();
        }
    });
}
function getCurrentFilenames() {
    loggerInfo("\nCurrent filenames:");
    fs.readdirSync(__dirname).forEach(file => {
      loggerInfo(file);
    });
    loggerInfo("\n");
}

module.exports = runAsyncBackup