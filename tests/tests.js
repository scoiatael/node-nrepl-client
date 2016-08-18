/*global console,require,module,setTimeout,clearTimeout*/

var nreplClient = require('../src/nrepl-client');
var nreplServer = require('../src/nrepl-server');
var async = require("async");

const serverOpts = {verbose: true, startTimeout: 20*1000},
    timeoutDelay = 10*1000;

let server, client, timeoutProc;

function createTimeout(test) {
  return timeoutProc = setTimeout(function() {
    test.ok(false, 'timeout');
    test.done();
  }, timeoutDelay);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var tests = {

  setUp: function (callback) {
    async.waterfall([
      function(next) { nreplServer.start(serverOpts, next); },
      function(serverState, next) {
        server = serverState;
        console.log("client connecting");
        client = nreplClient.connect({
          port: serverState.port,
          verbose: true
        });
        client.once('connect', function() {
          console.log("client connected");
          next();
        });
      }
    ], callback);
  },

  tearDown: function (cb) {
    if(!client) {
      cb(); 
    }
    else {
      client.once('close', function() {
        clearTimeout(timeoutProc);
        server.stop(cb);
      });
      client.end();
    };
  },

  testSimpleEval: function (test) {
    test.expect(3); createTimeout(test);
    client.eval('(+ 3 4)', function(err, messages) {
      console.log("in simple eval");
      console.log(messages);
      test.ok(!err, 'Got errors: ' + err);
      test.equal(messages[0].value, '7');
      test.deepEqual(messages[1].status, ['done']);
      test.done();
    });
  }
};

module.exports = tests;
