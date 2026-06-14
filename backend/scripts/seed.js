const reset = require('child_process').fork;
const path = require('path');

const child = reset(path.join(__dirname, 'reset-database.js'), ['--seed'], {
  stdio: 'inherit'
});

child.on('exit', (code) => process.exit(code));
