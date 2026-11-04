// Renders build/icon.png (1024×1024) from HTML. Run: npm run icon
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const html = `<!doctype html><html><body style="margin:0;width:1024px;height:1024px;background:transparent;display:flex;align-items:center;justify-content:center">
<div style="width:824px;height:824px;border-radius:185px;background:linear-gradient(145deg,#6d6af8 0%,#4f46e5 45%,#7c3aed 100%);
box-shadow:0 28px 50px rgba(30,20,90,.35), inset 0 2px 0 rgba(255,255,255,.25);position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center">
<div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 20%,rgba(255,255,255,.28),transparent 55%)"></div>
<div style="position:relative;font:700 360px/1 -apple-system,'SF Pro Display','Helvetica Neue',sans-serif;color:#fff;letter-spacing:-18px;text-shadow:0 10px 30px rgba(20,10,80,.35)">Ew</div>
<div style="position:absolute;bottom:150px;left:50%;transform:translateX(-50%);width:300px;height:22px;border-radius:11px;background:rgba(255,255,255,.85)"></div>
</div></body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 400))
  const img = await win.webContents.capturePage()
  const out = join(__dirname, '../../build/icon.png')
  writeFileSync(out, img.resize({ width: 1024, height: 1024 }).toPNG())
  console.log('wrote', out)
  app.quit()
})
