const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://citecheck-jet.vercel.app';

const ROUTES = [
  '/',
  '/dashboard',
  '/drafts',
  '/drafts/new',
  '/review',
  '/verifier-lab',
  '/gap-radar',
  '/audit',
  '/brand-kit',
  '/settings',
  '/how-it-works',
];

async function runAudit() {
  console.log(`Starting Playwright Network Audit against: ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const capturedRequests = [];
  const capturedHosts = new Set();

  page.on('request', (req) => {
    try {
      const url = new URL(req.url());
      capturedHosts.add(url.hostname);
      capturedRequests.push({
        url: req.url(),
        host: url.hostname,
        method: req.method(),
        resourceType: req.resourceType(),
      });
    } catch (e) {
      // non-standard URL
    }
  });

  // 1. Visit each route
  for (const route of ROUTES) {
    const fullUrl = `${BASE_URL}${route}`;
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(400);
    } catch (err) {
      console.warn(`Warning loading ${fullUrl}: ${err.message}`);
    }
  }

  // 2. Audit localStorage
  const localStorageDump = await page.evaluate(() => {
    const dump = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      dump[key] = localStorage.getItem(key);
    }
    return dump;
  });

  const cookies = await context.cookies();
  await browser.close();

  const fontRequests = capturedRequests.filter((r) =>
    r.host.includes('googleapis') || r.host.includes('gstatic')
  );
  const trackerRequests = capturedRequests.filter((r) =>
    r.host.includes('analytics') || r.host.includes('doubleclick') || r.host.includes('facebook') || r.host.includes('segment')
  );

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalRequests: capturedRequests.length,
    capturedHosts: Array.from(capturedHosts).sort(),
    fontRequestsCount: fontRequests.length,
    trackerRequestsCount: trackerRequests.length,
    localStorageKeys: Object.keys(localStorageDump).sort(),
    cookiesCount: cookies.length,
    cookies: cookies.map((c) => ({ name: c.name, domain: c.domain, secure: c.secure, sameSite: c.sameSite })),
  };

  console.log('\n=== NETWORK AUDIT SUMMARY ===');
  console.log(`Unique hosts contacted: ${report.capturedHosts.join(', ')}`);
  console.log(`Google Fonts requests: ${report.fontRequestsCount}`);
  console.log(`Analytics / Tracking requests: ${report.trackerRequestsCount}`);
  console.log(`LocalStorage keys present: ${report.localStorageKeys.join(', ')}`);
  console.log(`Cookies present: ${report.cookiesCount}`);

  const outDir = path.resolve(__dirname, '../../../../../docs/evidence');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, 'NETWORK_CAPTURE.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Audit artifact saved to ${outPath}\n`);
  return report;
}

runAudit().catch((e) => {
  console.error('Audit failed:', e);
  process.exit(1);
});
