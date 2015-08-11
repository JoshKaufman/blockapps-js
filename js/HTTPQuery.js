var request = require("request");

module.exports = HTTPQuery;

// blockappsQueryObj = {
//   serverURI: <blockapps node address>
//   queryPath: <blockapps query route>
//   callback : <function to handle the JSON-parsed reply>
//   get|post : <list of {name:,value:} query parameters>
// }

function HTTPQuery(blockappsQueryObj) {
    var apiPrefix = "/eth/v1.0"
    
    var options = {
        "uri":blockappsQueryObj.serverURI + apiPrefix + blockappsQueryObj.queryPath,
        "json":true
    };
    if (blockappsQueryObj["get"]) {
        options.method = "GET";
        options.qs = blockappsQueryObj.get;
    }
    else if (blockappsQueryObj["post"]) {
        options.method = "POST";
        options.form = blockappsQueryObj.post;
    }
    else if (blockappsQueryObj["data"]) {
        options.method = "POST";
        options.body = blockappsQueryObj.data;
    }
    
    function httpCallback(error, response, body) {
        if(response && response.statusCode == 200) {
            if (typeof blockappsQueryObj.callback === "function") {
                blockappsQueryObj.callback(body);
            }
        }
        else {
            console.log(error);
        }
    }
    request(options, httpCallback);
}
