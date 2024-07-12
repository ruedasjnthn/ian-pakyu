const axios = require('axios').default;
const { loggerInfo } = require("../config/logger");

module.exports = class HttpHelper {
    static async Execute({ url, contentType, userName, password, payload, requestType, customHeaders }) {
        try {
            var headers = HttpHelper.prepareHeaders(customHeaders);
            headers["Content-Type"] = contentType || "text/xml";
            let requestPayload = {
                method: requestType || 'post',
                url: url,
                headers: headers,
                data: payload
            };
            loggerInfo("args", payload);
            if (userName && userName.trim().length > 0) {
                requestPayload.withCredentials = true;
                requestPayload.auth = {
                    username: userName,
                    password: password
                };
            }
            loggerInfo("request payload", requestPayload);
            let remoteResponse = await axios(requestPayload);
            loggerInfo(remoteResponse.data)
            return remoteResponse.data;
        } catch (err) {
            throw new Error(
                `Oops something went wrong. Please try again later ${JSON.stringify(
                    err
                )}`
            );
        }
    }

    static prepareHeaders(customHeaders) {
        var obj = {}
        for (let index = 0; index < customHeaders.length; index++) {
            const element = customHeaders[index];
            obj[element.headerName] = element.headerValue
        }
        return obj;
    }
};