# Lighthouse Metrics Analysis

Online at https://googlechrome.github.io/lighthouse/plots/

For context and roadmap, please see issue:
https://github.com/GoogleChrome/lighthouse/issues/1924

## Workflow

### Setup

Install node and yarn
Install and build lighthouse.
sudo apt-get install google-chrome-unstable
export LIGHTHOUSE_CHROMIUM_PATH="$(which google-chrome-unstable)"

### Generating & viewing charts

```
# View all commands
$ cd plots
$ yarn run

# Run lighthouse to collect metrics data
$ yarn measure

# Analyze the data to generate a summary file (i.e. out/generatedResults.js)
# This will launch the charts web page in the browser
$ yarn analyze

# If you need to view the charts later
$ yarn open
```
