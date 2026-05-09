#!/usr/bin/env node
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const CREDS  = JSON.parse(fs.readFileSync(path.join(__dirname,'credentials.json'))).installed;
const TOKENS = JSON.parse(fs.readFileSync(path.join(__dirname,'ga4-tokens.json')));

function req(method, hostname, p, body, headers={}) {
  return new Promise((resolve,reject)=>{
    const payload = body ? (typeof body==='string'?body:JSON.stringify(body)) : null;
    const r = https.request({
      hostname, path:p, method,
      headers:{...headers, ...(payload?{'Content-Length':Buffer.byteLength(payload)}:{})}
    }, res=>{
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve({s:res.statusCode,d:JSON.parse(d)})}catch{resolve({s:res.statusCode,d})} });
    });
    r.on('error',reject);
    if(payload) r.write(payload);
    r.end();
  });
}

async function refreshToken() {
  const body = new URLSearchParams({
    client_id: CREDS.client_id, client_secret: CREDS.client_secret,
    refresh_token: TOKENS.refresh_token, grant_type: 'refresh_token'
  }).toString();
  const r = await req('POST','oauth2.googleapis.com','/token',body,{'Content-Type':'application/x-www-form-urlencoded'});
  if (!r.d.access_token) throw new Error('Token refresh failed: '+JSON.stringify(r.d));
  return r.d.access_token;
}

(async()=>{
  console.log('Refreshing token...');
  const token = await refreshToken();
  const auth = {'Authorization':`Bearer ${token}`,'Content-Type':'application/json'};

  // Get accounts
  console.log('Fetching Analytics accounts...');
  const accts = await req('GET','analyticsadmin.googleapis.com','/v1beta/accountSummaries',null,auth);
  if (accts.d.error) throw new Error('API error: '+accts.d.error.message+' — may need to enable API at: https://console.developers.google.com/apis/api/analyticsadmin.googleapis.com/overview?project=224867788732');

  const summaries = accts.d.accountSummaries||[];
  console.log('Accounts found:', summaries.length);
  if (!summaries.length) throw new Error('No GA accounts. Create one at analytics.google.com first.');

  const accountName = summaries[0].account;
  console.log('Using account:', summaries[0].displayName, accountName);

  // Check if PropertyDNA property already exists
  const existing = summaries[0].propertySummaries?.find(p=>p.displayName==='PropertyDNA');
  let propertyName;
  if (existing) {
    propertyName = existing.property;
    console.log('Property already exists:', propertyName);
  } else {
    // Create property
    console.log('Creating GA4 property...');
    const prop = await req('POST','analyticsadmin.googleapis.com','/v1beta/properties',{
      displayName:'PropertyDNA', timeZone:'America/Los_Angeles',
      currencyCode:'USD', industryCategory:'REAL_ESTATE', parent:accountName
    },auth);
    if (!prop.d.name) throw new Error('Create property failed: '+JSON.stringify(prop.d));
    propertyName = prop.d.name;
    console.log('Property created:', propertyName);
  }

  // Create web data stream
  console.log('Creating web data stream...');
  const stream = await req('POST','analyticsadmin.googleapis.com',`/v1beta/${propertyName}/dataStreams`,{
    type:'WEB_DATA_STREAM', displayName:'thepropertydna.com',
    webStreamData:{defaultUri:'https://www.thepropertydna.com'}
  },auth);
  if (!stream.d.name) throw new Error('Create stream failed: '+JSON.stringify(stream.d));

  const measurementId = stream.d.webStreamData?.measurementId;
  const propertyId    = propertyName.replace('properties/','');
  console.log('\n✓ Measurement ID:', measurementId);
  console.log('✓ Property ID:', propertyId);

  fs.writeFileSync(path.join(__dirname,'ga4-config.json'),
    JSON.stringify({measurementId, propertyId, propertyName}, null, 2));
  console.log('Saved to ga4-config.json');
})().catch(e=>{ console.error('FATAL:',e.message); process.exit(1); });
