var Contract = require("./Contract.js");
var Transaction = require("./Transaction.js");
var HTTPQuery = require("./HTTPQuery.js");

module.exports = Solidity;

function Solidity(code) {
    if (this instanceof Solidity) {
        this.code = code;
        this.vmCode = undefined;
//        this.abi = undefined;
        this.symtab = undefined;

        this.toContract = compileAndSubmit;
        this.compile = compileSolidity;
        this.submit = submitSolidity;
    }
    else {
        return new Solidity(code);
    }
}

// argObj = {
//   apiURL:, fromAccount:, value:, gasPrice:, gasLimit:
// }
function compileAndSubmit(argObj, callback) {
    function compileCallback(solidity) { 
        submitSolidity.bind(this) (argObj, callback);
    }
    compileSolidity.bind(this)(argObj.apiURL, compileCallback.bind(this));
}

function submitSolidity(argObj, callback) {
    argObj.toAccount = Contract();
    argObj.data = this.vmCode;
    var submitTX = Transaction(argObj);
    submitTX.send(argObj.apiURL, contractCallback.bind(this));

    function contractCallback(txResult) {
        var contract = Contract({
            address: txResult.contractsCreated[0], // Only handle one-contract code
 //           abi: this.abi,
            symtab: this.symtab,
        });
        callback(contract);
    }
}

function compileSolidity(apiURL, callback) {
    function getSolc(solcResult) {
        if (solcResult["contracts"].length != 1) {
            console.log("Code must define one and only one contract");
            return;
        }
        this.symtab = solcResult["xabis"];
        //this.abi = solcResult["abis"][0]["abi"];
        this.vmCode = solcResult["contracts"][0]["bin"];
        if (typeof callback === "function") {
            callback(this);
        }
    }

    HTTPQuery({
        "serverURI":apiURL,
        "queryPath":"/solc",
        "post":{"src":this.code},
        "callback":getSolc.bind(this)
    });
}
