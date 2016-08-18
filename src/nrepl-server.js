'use strict';
/*global console,require,module,process,__dirname,setTimeout,clearTimeout,Buffer*/

/*
 * Depending on how you start the clojure nREPL server you don't need this.
 * This will start a minimal nrepl via `lein repl :headless` to which the node
 * client will connect.
 *
 */

const path = require("path"),
      ps = require("child_process"),
      util = require("util"),
      EventEmitter = require('events'),
      merge = util._extend,
      Promise = require('bluebird'),
      os = require('os'),
      kill = require('tree-kill');

function _spawnProc(that) {
  const hostname = that.options.hostname,
    port = that.options.port,
    projectPath = that.options.projectPath,
    verbose = that.options.verbose,
    logger = that.options.logger;
  var procArgs = ["repl", ":headless"],
      proc = null;

  if (hostname) procArgs.push(':host', hostname);
  if (port) procArgs.push(':port', port);

  var cwd = projectPath,
      cmd = 'lein';

  if(os.platform() == 'win32') {
    cmd = 'lein.bat';
  }

  verbose && logger.debug('Spawning server with', { cmd: cmd,
     procArgs: procArgs,
     cwd: cwd
   });
  try {
    proc = ps.spawn(cmd, procArgs, {cwd: cwd});
  } catch (e) {
    that.emit('error', e);
  }

  return proc;
};

function _attachListeners(that) {
  const proc = that.proc,
        logger = that.options.logger,
         verbose = that.options.verbose;

  if (verbose) {
    proc.on('close', () => { logger.info("nREPL server stopped", {}); });
    proc.on('error', (error) => { logger.error("nREPL server error ", {error: error}); });
    proc.stderr.on('data', (data) => { logger.error("nREPL error ", {error: data.toString()}); });
  }

  proc.on('close', function(_) { that.emit('close', that); });
  _discoverStart(that)
    .then(_discoverHostAndPort(that))
    .then((opts) => {
      that.host = opts.host;
      that.port = opts.port;
      that.emit('start', that);
      verbose && logger.info(`nREPL server started on ${that.host}:${that.port}`);
    });
}

function _discoverStart(that) {
  const verbose = that.options.verbose,
        logger = that.options.logger;
  return new Promise((resolve, reject) => {
    let stdout = that.proc.stdout,
        listener = (data) => {
          data = data.toString();
          verbose && logger.debug('Received ', { data: data });
          stdout.removeListener('data', listener);
          resolve(data);
        };

    stdout.on('data', listener);
  });
}

function _discoverHostAndPort(that) {
  const verbose = that.options.verbose,
        logger = that.options.logger;
  return (initializeString) => {
    const match = initializeString.match(/on port ([0-9]+) on host ([\w.]+)/);
    verbose && logger.debug('Parsed initialize string', { match: match });

    const port = parseInt(match[1]),
          host = match[2];

    return {host, port};
  };
}

class Server extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.proc = _spawnProc(this);
    _attachListeners(this);
  }

  stop(cb) {
    const verbose = this.options.verbose,
        logger = this.options.logger,
        stopTimeout = this.options.stopTimeout,
        pid = this.proc.pid;

    kill(pid, 'SIGTERM');
    let killTimeout = setTimeout(() => { kill(pid, 'SIGKILL'); }, stopTimeout);

    this.proc.once('close', function() {
      clearTimeout(killTimeout);
      verbose && logger.info("Stopped nREPL server with pid ", { pid: pid });
      cb && cb();
    });
  }
}


const consoleLog = console.log.bind(console),
      consoleError = console.error.bind(console),
      defaultLogger = {
        info:  consoleLog,
        debug:  consoleLog,
        error: consoleError
      },
      defaultOptions = {
        stopTimeout: 10*1000, // milliseconds
        verbose: false,
        projectPath: process.cwd(),
        // if host / port stay undefined they are chosen by leiningen
        hostname: undefined,
        port: undefined,
        logger: defaultLogger
      };

function start(options, cb) {
  let server = new Server(merge(merge({}, defaultOptions), options));
  if(cb) {
    server.once('start', (server) => {
      cb(null, server);
    });

    server.on('error', (err) => {
      cb(err);
    });
  }
  return server;
}

module.exports = {start: start};
