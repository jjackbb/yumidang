// Preview readiness check only; this is not the full product acceptance suite.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/b/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const url = process.env.CHECK_URL, out = process.env.EVIDENCE_DIR;
if (!url || !out) throw new Error('CHECK_URL and EVIDENCE_DIR required');
fs.mkdirSync(out, { recursive: true });
const result = { url, scope: 'preview readiness only', cases: [], errors: [], externalServiceRequests: [] };
(async () => {
 const browser = await chromium.launch({executablePath: process.env.BROWSER_EXECUTABLE || '/Users/b/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell'});
 try {
  for (const [name, viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1280,height:900}]]) {
   const context = await browser.newContext({viewport,timezoneId:'Asia/Seoul'});
   await context.route(/google-analytics|googletagmanager|generativelanguage/, route => {result.externalServiceRequests.push(route.request().url().split('?')[0]);return route.abort();});
   const page = await context.newPage(); page.setDefaultTimeout(12000);
   page.on('pageerror', error => result.errors.push(error.message));
   try {
    const response = await page.goto(url, {waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    await page.locator('#nav-tab-home').waitFor();
    assert.ok((await page.locator('#root').innerText()).length > 80);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:path.join(out,name+'-home.png'),fullPage:true});
    const panel = page.getByRole('region',{name:'체험 설정',exact:true});
    const toggle = panel.getByRole('button',{name:/체험 설정/});
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
    await page.locator('[data-demo-user]').first().click();
    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
    await page.locator('#nav-tab-me').click();
    assert.ok((await page.locator('#root').innerText()).includes('당도'));
    await page.screenshot({path:path.join(out,name+'-me.png'),fullPage:true});
    await page.reload({waitUntil:'networkidle'});
    await page.locator('#nav-tab-explore').click();
    assert.ok((await page.locator('#root').innerText()).length > 100);
    await page.locator('#nav-tab-home').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
    result.cases.push({name,status:'PASS'});
   } catch(error) {
    result.cases.push({name,status:'FAIL',reason:error.message});
    await page.screenshot({path:path.join(out,name+'-failure.png'),fullPage:true}).catch(()=>{});
   } finally {await context.close();}
  }
 } finally {await browser.close();}
 result.status = result.cases.length===2 && result.cases.every(x=>x.status==='PASS') && !result.errors.length && !result.externalServiceRequests.length ? 'PASS':'FAIL';
 fs.writeFileSync(path.join(out,'preview-smoke.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 if(result.status!=='PASS') process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});

