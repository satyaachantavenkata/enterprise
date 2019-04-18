const chalk = require('chalk');
const logger = require('../../scripts/logger');

module.exports = {
  isIE: () => browser.browserName === 'ie',
  isFF: () => browser.browserName === 'firefox',
  isSafari: () => browser.browserName === 'safari',
  isChrome: () => browser.browserName === 'chrome',
  isMac: async () => {
    const capabilities = await browser.getCapabilities();
    return capabilities.platform === 'MAC';
  },
  isBS: () => process.env.isBrowserStack,
  isCI: () => process.env.TRAVIS,
  setPage: async (url) => {
    let addQuery = '?';
    let theme = `theme=${browser.params.theme}`;
    if (url.indexOf('?') > -1) {
      addQuery = '';
      theme = `&${theme}`;
    }

    const pageurl = `${browser.baseUrl + url}${addQuery}${theme}`;
    await browser.waitForAngularEnabled(false);
    await browser.driver.get(pageurl);
  },
  checkForErrors: async () => {
    await browser.manage().logs().get('browser').then((browserLog) => {
      let errors = 0;
      for (let i = 0; i < browserLog.length; i++) {
        const type = browserLog[i].level.name;
        logger(type, browserLog[i].message);
        errors++;
      }
      expect(errors).toEqual(0);
    });
  },
  getSelectedText: async () => {
    await browser.executeScript(() => {
      let text = '';
      if (window.getSelection) {
        text = window.getSelection().toString();
      } else if (document.selection && document.selection.type !== 'Control') {
        text = document.selection.createRange().text;
      }
      return text;
    });
  },
  reportAxeViolations: (res) => {
    let msg = '';
    if (!res || !res.violations || !res.violations.length) {
      return;
    }

    msg += 'Axe Violations:\n\n';
    res.violations.forEach((violation) => {
      msg += `${chalk.bold(violation.help)}\n`;

      const violationNodes = violation.nodes || [];
      let failureSummary;
      let targetList = '';
      violationNodes.forEach((node) => {
        if (!failureSummary) {
          failureSummary = node.failureSummary;
        }
        node.target.forEach((target) => {
          targetList += `  \`${target}\`\n`;
        });
      });

      msg += `${chalk.yellow('Targets:')}\n`;
      msg += `${targetList}\n`;
      msg += `${chalk.yellow('Suggested Fix:')} ${failureSummary}\n`;
    });

    logger('error', msg);
  }
};
