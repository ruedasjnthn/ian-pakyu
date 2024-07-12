require("dotenv").config();
const nodemailer = require('nodemailer');
const { loggerInfo, loggerError, loggerLocal } = require("../config/logger");

const sendMail = (toMail, subject, text) => {

    var transporter = nodemailer.createTransport({
        host: process.env.MAIL_SMTP,
        port: process.env.MAIL_PORT,
        secure: (process.env.MAIL_SECURE === 'true'),
        requireTLS: (process.env.MAIL_TLS === 'true'),
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PW,
        },
    });

    var mailOptions = {
        from: process.env.MAIL_SENDER,
        to: toMail,
        subject: subject,
        html: text
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            loggerError({ error });
        } else {
            loggerLocal('---------------- email sent -----------')
            loggerInfo('email sent', {
                timeStamp: new Date().toTimeString(), 
                toMail, 
                'info.response': info.response, subject
            });
            loggerLocal('---------------------------------------')
        }
    });
}

module.exports = {
    sendMail
}