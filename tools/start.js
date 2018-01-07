/*eslint-disable func-names, prefer-arrow-callback, no-console */

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');

const path = require('path');
const { spawn, spawnSync } = require('child_process');
const chalk = require('chalk');
const dateFns = require('date-fns');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const clearConsole = require('react-dev-utils/clearConsole');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls,
} = require('react-dev-utils/WebpackDevServerUtils');
const openBrowser = require('react-dev-utils/openBrowser');
const paths = require('../config/paths');
const config = require('../config/webpack.config.dev');
const createDevServerConfig = require('../config/webpackDevServer');

const args = process.argv.slice(2);
const isInteractive = process.stdout.isTTY;
const isAutomationTest = args[0] && args[0] === 'automation';

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// Tools like Cloud9 rely on this.
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// We attempt to use the default port but if it is busy, we offer the user to
// run on a different port. `detect()` Promise resolves to the next free port.
choosePort(HOST, DEFAULT_PORT)
  .then(port => {
    if (port === null) {
      // We have not found a port.
      return;
    }
    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
    const appName = require(paths.packageJson).name;
    const urls = prepareUrls(protocol, HOST, port);
    const compiler = createCompiler(webpack, config, appName, urls);

    // Load proxy config
    const proxySetting = require(paths.packageJson).proxy;
    const proxyConfig = prepareProxy(proxySetting, paths.assets);
    // Serve webpack assets generated by the compiler over a web sever.
    const serverConfig = createDevServerConfig(
      proxyConfig,
      urls.lanUrlForConfig
    );

    let start;

    compiler.plugin('compile', function() {
      start = new Date();
    });

    compiler.plugin('emit', function(compilation, callback) {
      const now = new Date();
      console.log(chalk.yellow(`Duration: ${dateFns.differenceInSeconds(now, start)}s - ${compilation.hash}`));

      if (isAutomationTest) {
        spawnSync('pkill', ['-f', 'selenium']);
  
        const nightwatch = spawn(path.join(__dirname, '../node_modules/.bin/nightwatch'), [
          '-c',
          path.join(__dirname, '../test/__setup__/nightwatch.conf.js'),
        ]);

        nightwatch.stdout.on('data', (data) => {
          process.stdout.write(data.toString());
        });

        nightwatch.stderr.on('data', (data) => {
          process.stdout.write(data.toString());
        });

        nightwatch.on('close', () => {
          process.exit(0);
        });
      }

      callback();
    });

    const devServer = new WebpackDevServer(compiler, serverConfig);
    // Launch WebpackDevServer.
    devServer.listen(port, HOST, err => {
      if (err) {
        console.log(err);
        return;
      }

      if (isInteractive) {
        clearConsole();
      }

      console.log(chalk.cyan('Starting the development server...'));

      if (!isAutomationTest) {
        openBrowser(urls.localUrlForBrowser);
      }
    });

    ['SIGINT', 'SIGTERM'].forEach(function(sig) {
      process.on(sig, function() {
        devServer.close();
        process.exit();
      });
    });
  })
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });
