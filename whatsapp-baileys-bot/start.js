const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting WhatsApp Bot Dashboard System...');

// Start dashboard server first
console.log('📊 Starting dashboard server on port 3001...');
const dashboard = spawn('node', ['src/dashboard/server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, DASHBOARD_PORT: '3001' }
});

// Wait 3 seconds then start bot
setTimeout(() => {
  console.log('🤖 Starting WhatsApp bot...');
  const bot = spawn('node', ['src/bot.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  bot.on('exit', (code) => {
    console.log(`Bot exited with code ${code}`);
    dashboard.kill();
    process.exit(code);
  });
}, 3000);

dashboard.on('exit', (code) => {
  console.log(`Dashboard exited with code ${code}`);
  process.exit(code);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down...');
  dashboard.kill();
  process.exit(0);
});