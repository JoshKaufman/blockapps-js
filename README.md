# blockapps-js

blockapps-js is a library that exposes a number of functions for interacting with the Blockchain via the BlockApps API.

## Installation

`npm install blockapps`

## Documentation

Documentation is available at http://blockapps.net/apidocs.

## API Overview

All functionality is included in the `blockapps-js` module:

```js
var blockapps = require('blockapps');
// blockapps.{ RESOURCE_NAME }.{ METHOD_NAME }
```

Every method accepts an optional callback as the last argument:

```js
blockapps.Contract...

```

Additionally, every method returns a promise, so you don't have to use the regular callback. E.g.

```js
blockapps....

```


### API URLs

All of the functions below take an "apiURL", which indicates from what server the API queries are to be obtained. If defined, the apiURL is used, otherwise the default is http://stablenet.blockapps.net. The "apiURL" is always taken first in the signature and is omitted, henceforth.

### Available resources & methods

* contract({address,abi,symtab})
  * [`storage()`](http://blockapps.net/apidocs)
  * [`call(methodName, data)`](http://blockapps.net/apidocs)
  * [`balance()`](http://blockapps.net/apidocs)
* transaction({privateKey})
  * [`_push(nonce, gasPrice, to, value, data, privateKey)`](http://blockapps.net/apidocs)
  * [`send(to, value)`](http://blockapps.net/apidocs)
  * [`createContract(value,data)`](http://blockapps.net/apidocs)
  * [`result(hash)`](http://blockapps.net/apidocs)
* solidity({src,privateKey})
  * [`compile(src)`](http://blockapps.net/apidocs)
  * [`contract(src)`](http://blockapps.net/apidocs)
 
## More information / wikis

## Development

```bash
$ npm install -g mocha
$ npm test
```
