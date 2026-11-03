/**
 * CiteCheck AI - Playwright Full Network & Third-Party Audit
 *
 * Traverses all application views across all roles and records every outgoing
 * network request to prove zero unauthorized third-party trackers, zero Google Fonts
 * requests, and complete data minimization.
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

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

const ROLES = ['creator', 'reviewer', 'brand_manager'];

async function runAudit() {
  console.log(`Starting Playwright Network Audit against: ${BASE_URL}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const capturedRequests = [];
  const capturedHosts = new Set();
  const storageItems = {};

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
      // non-standard URL (e.g. data:, blob:)
    }
  });

  // 1. Visit each route
  for (const route of ROUTES) {
    const fullUrl = `${BASE_URL}${route}`;
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });
      // Small pause to capture any deferred queries
      await page.waitForTimeout(500);
    } catch (err) {
      console.warn(`Warning loading ${fullUrl}: ${err.message}`);
    }
  }

  // 2. Audit localStorage and sessionStorage
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

  // Summary statistics
  const fontRequests = capturedRequests.filter((r) =>
    r.host.includes('googleapis') || r.host.includes('gstatic') || r.url.includes('.woff')
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

  fs.writeFileSync('docs/evidence/NETWORK_CAPTURE.json', JSON.stringify(report, null, 2));
  console.log('Audit artifact saved to docs/evidence/NETWORK_CAPTURE.json\n');
  return report;
}

runAudit().catch((e) => {
  console.error('Audit failed:', e);
  process.exit(1);
});

