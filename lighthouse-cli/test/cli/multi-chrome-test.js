const seleniumAssistant = require('selenium-assistant');
const childProcess = require('child_process');

Promise.all([
  seleniumAssistant.downloadBrowser('chrome', 'stable'),
  seleniumAssistant.downloadBrowser('chrome', 'beta'),
  seleniumAssistant.downloadBrowser('chrome', 'unstable')
])
.then(() => {
  seleniumAssistant.printAvailableBrowserInfo();

  const chromeBrowsers = [
    seleniumAssistant.getBrowser('chrome', 'stable'),
    seleniumAssistant.getBrowser('chrome', 'beta'),
    seleniumAssistant.getBrowser('chrome', 'unstable')
  ];
  const testChain = chromeBrowsers.reduce((promiseChain, chromeBrowser) => {
    // Checkes executable exists
    if (!chromeBrowser.isValid()) {
      return promiseChain;
    }

    // Lighthouse requires version 52+
    if (chromeBrowser.getVersionNumber < 52) {
      return promiseChain;
    }

    console.log('Running test on Chrome version: ' +
      chromeBrowser.getVersionNumber());
    return promiseChain
    .then(() => {
      return new Promise(resolve => {
        process.env.LIGHTHOUSE_CHROMIUM_PATH = chromeBrowser.getExecutablePath();

        const launchChromeProcess = childProcess.exec(
          './lighthouse-core/scripts/launch-chrome.sh', {
            stdio: 'inherit'
          });

        // Let's make sure Chrome is up
        setTimeout(() => {
          console.log('Starting smoke test');
          childProcess.execSync('./lighthouse-cli/scripts/run-smoke-tests.sh', {
            stio: 'inherit'
          });

          launchChromeProcess.kill();

          resolve();
        }, 2000);
      });
    });
  }, Promise.resolve());

  return testChain;
});
