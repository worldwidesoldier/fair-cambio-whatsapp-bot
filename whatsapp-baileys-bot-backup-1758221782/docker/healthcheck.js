#!/usr/bin/env node

const http = require('http');

async function healthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: process.env.MONITORING_PORT || 3001,
      path: '/health',
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (res.statusCode === 200 && response.status === 'healthy') {
            console.log('✅ Health check passed:', response);
            resolve(true);
          } else {
            console.log('❌ Health check failed:', response);
            reject(new Error(`Health check failed: ${response.status || 'unknown'}`));
          }
        } catch (error) {
          console.log('❌ Health check error parsing response:', error.message);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log('❌ Health check request error:', error.message);
      reject(error);
    });

    req.on('timeout', () => {
      console.log('❌ Health check timeout');
      req.destroy();
      reject(new Error('Health check timeout'));
    });

    req.end();
  });
}

// Executa o health check
if (require.main === module) {
  healthCheck()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Health check failed:', error.message);
      process.exit(1);
    });
}

module.exports = healthCheck;