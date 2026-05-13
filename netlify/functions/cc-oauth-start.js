/**
 * CC OAuth start — redirects Dan to CC login.
 * Visit: https://thepropertydna.com/.netlify/functions/cc-oauth-start
 *
 * Protected by INTERNAL_API_KEY so only Dan can trigger it.
 * After login CC redirects to cc-oauth-callback which saves tokens automatically.
 */
const CLIENT_ID    = 'f626272f-4940-42e3-b0d6-d4ffc0366337';
const REDIRECT_URI = 'https://thepropertydna.com/.netlify/functions/cc-oauth-callback';

exports.handler = async (event) => {
  const key = event.queryStringParameters?.key || event.headers['x-internal-key'];
  if (key !== process.env.INTERNAL_API_KEY) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const authUrl =
    `https://authz.constantcontact.com/oauth2/default/v1/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=contact_data+campaign_data+offline_access` +
    `&state=pdna2026`;

  return {
    statusCode: 302,
    headers: { Location: authUrl },
    body: '',
  };
};
