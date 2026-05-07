/**
 * GBP OAuth Setup — run once to generate tokens.json
 * Usage: node auth.js [path/to/credentials.json]
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const axios = require('axios');
const open = require('open');

const CREDENTIALS_PATH = process.argv[2] || './credentials.json';
const TOKEN_PATH = './tokens.json';
const REDIRECT_URI = 'http://localhost:3000';
const SCOPE = 'https://www.googleapis.com/auth/business.manage';

if (!fs.existsSync(CREDENTIALS_PATH)) {
  console.error(`\nERROR: credentials.json not found at "${CREDENTIALS_PATH}"`);
  console.error('Download it from Google Cloud Console → APIs & Services → Credentials\n');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const creds = raw.installed || raw.web;
const { client_id, client_secret } = creds;

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(client_id)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

async function exchangeCode(code) {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id,
    client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  return res.data;
}

async function main() {
  console.log('\nOpening Google authorization page...');
  console.log('If browser does not open, paste this URL manually:\n');
  console.log(authUrl + '\n');

  await open(authUrl);

  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const query = url.parse(req.url, true).query;

      if (query.error) {
        res.end('Authorization failed: ' + query.error);
        server.close();
        reject(new Error(query.error));
        return;
      }

      if (query.code) {
        res.end('<h2>Authorization complete — you can close this tab.</h2>');
        server.close();

        try {
          const tokens = await exchangeCode(query.code);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
          console.log('tokens.json saved successfully.\n');
          console.log('Now run: node push-content.js\n');
          resolve();
        } catch (err) {
          reject(err);
        }
      }
    });

    server.listen(3000, () => {
      console.log('Waiting for Google callback on http://localhost:3000 ...');
    });

    server.on('error', reject);
  });
}

main().catch(err => {
  console.error('Auth failed:', err.message);
  process.exit(1);
});
