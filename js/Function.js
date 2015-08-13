var HTTPQuery = require("./HTTPQuery.js")
var SolArray = require("./Array.js")
var Transaction = require("./Transaction.js")
var typeify = require("./typeify.js");

module.exports = Function;

function Function(toContract, api) { // NOT the solc API
    var apiDomain = api["functionDomain"];
    var apiArgs = api["functionArgs"];
    var apiReturns = api["functionReturns"];

    function getResultAndCallback(apiURL, callback, tx) {
        HTTPQuery({
            "serverURI": apiURL,
            "queryPath": "/transactionResult/" + tx.hash,
            "callback" : useRetVal.bind(this, callback),
            "get"      : {}
        });
    }

    function useRetVal(callback, txResultJSON) {
        var txResult = JSON.parse(txResultJSON);
        var retVal = txResult.response;
        Object.defineProperties(retVal, {
            decode : {
                value: true,
                enumerable : false
            },
            type : {
                value : apiReturns,
                enumerable : false
            }
        });
        if (typeof callback === "function") {
            callback(typeify(retVal));
        }
    }

    // argObj = {
    //   fromAccount:, value:, gasPrice, gasLimit
    // }
 
    function f(apiURL, callback, argObj, fArgObj) {
        var args = []
        apiArgs.forEach(function(arg, i) {
            var tmp = fArgObj[arg];
            Object.defineProperties(tmp, {
                type : {
                    value : apiDomain[i],
                    enumerable : false
                }
            });
            args.push(typeify(tmp));
        });
        argObj.toAccount = toContract;
        argObj.data = api.functionHash + SolArray(args).encoding();

        Transaction(argObj).send(
            apiURL, getResultAndCallback.bind(this, apiURL, callback));
    }
    f.toString = function() { return api["solidityType"]; };
    f.encoding = function() { return argObj.functionHash; };
    return f;
}
