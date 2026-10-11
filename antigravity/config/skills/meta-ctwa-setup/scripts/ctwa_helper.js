const https = require('https');

const API_VERSION = 'v20.0';

function get(path, token) {
  return new Promise((resolve, reject) => {
    https.get(`https://graph.facebook.com/${API_VERSION}/${path}${path.includes('?') ? '&' : '?'}access_token=${token}`, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    }).on('error', reject);
  });
}

function post(endpoint, data, token) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams(data).toString();
    const req = https.request({
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/${API_VERSION}/${endpoint}?access_token=${token}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { resolve(b); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function listPages(token) {
  const res = await get('me/accounts?fields=id,name,connected_instagram_account', token);
  if (res.error) {
    console.error('Error listing pages:', res.error);
    process.exit(1);
  }
  console.log('Available Facebook Pages & Linked IG Accounts:');
  console.log(JSON.stringify(res.data, null, 2));
}

async function createCtwaAdset(options) {
  const { token, act, campaign, page, name, budget, targeting } = options;

  if (!token || !act || !campaign || !page || !name || !budget) {
    console.error('Missing required arguments: --token, --act, --campaign, --page, --name, --budget');
    process.exit(1);
  }

  const payload = {
    name,
    campaign_id: campaign,
    optimization_goal: 'CONVERSATIONS',
    billing_event: 'IMPRESSIONS',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    daily_budget: budget,
    destination_type: 'WHATSAPP',
    promoted_object: JSON.stringify({ page_id: page }),
    attribution_spec: JSON.stringify([{ event_type: 'CLICK_THROUGH', window_days: 1 }]),
    status: 'PAUSED'
  };

  if (targeting) {
    payload.targeting = typeof targeting === 'string' ? targeting : JSON.stringify(targeting);
  }

  const res = await post(`${act}/adsets`, payload, token);
  console.log('Create CTWA Adset Result:', res);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    params[key] = args[i + 1];
  }
  return { command, params };
}

async function main() {
  const { command, params } = parseArgs();

  if (command === 'list-pages') {
    await listPages(params.token);
  } else if (command === 'create-adset') {
    await createCtwaAdset(params);
  } else {
    console.log('Usage:');
    console.log('  node ctwa_helper.js list-pages --token <TOKEN>');
    console.log('  node ctwa_helper.js create-adset --token <TOKEN> --act <ACT_ID> --campaign <CAMPAIGN_ID> --page <FB_PAGE_ID> --name <NAME> --budget <BUDGET>');
  }
}

main();
