#!/bin/bash
mv js/HTTPQuery.js js/HTTPQuery-node.js
sed 's/require("request")/require("browser-request")/' js/HTTPQuery-node.js >js/HTTPQuery.js
./node_modules/browserify/bin/cmd.js api-browser.js -r ./js/Contract:Contract -r ./js/Transaction:Transaction -r ./js/Solidity:Solidity -r ./js/Faucet:claimEther > api.js
#minify api-tmp.js > api.js
#rm api-tmp.js
mv js/HTTPQuery-node.js js/HTTPQuery.js
