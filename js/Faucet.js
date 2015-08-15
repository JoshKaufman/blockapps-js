var HTTPQuery = require("./HTTPQuery.js");

module.exports = claimEther;

// faucetObj = {
//   apiURL : <blockapps node address>
//   callback : <callback function taking no args>
//   contract : <Contract to receive ether>
// }
function claimEther(faucetObj) {
    var address = faucetObj.contract.address.toString();
    
    // This is from Transaction.js.  Make a module for it!
    function pollAndCallback() {
        var poller = setInterval(pollTX.bind(this), 500);
        var timeout = setTimeout(function() {
            clearInterval(poller);
            console.log("sendTransaction timed out");
        }, 10000);
        function pollTX () {
            HTTPQuery({
                "serverURI":faucetObj.apiURL,
                "queryPath":"/account",
                "get":{
                    "address" : address
                },
                "callback":checkTXPosted.bind(this)
            });
        }
        function checkTXPosted(acctList) {
            console.log(acctList)
            // Only polls for the creation of a new account.
            if (acctList.length != 0) {
                clearTimeout(timeout);
                clearInterval(poller);
                if (typeof faucetObj.callback === "function") {
                    faucetObj.callback();
                }
            }
        }
    }
    
    HTTPQuery({
        "serverURI" : faucetObj.apiURL,
        "queryPath" : "/faucet",
        "callback"  : pollAndCallback,
        "post"      : {
            "address" : address
        }
    });
}
