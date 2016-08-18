let nreplClient = require('./nrepl-client'),
    nreplServer = require('./nrepl-server');


nreplClient.Server = nreplServer;

module.exports = nreplClient;
