const http = require("http"), fs = require("fs"), path = require("path");
const { WebSocketServer } = require("ws");
const html = fs.readFileSync(path.join(__dirname, "index.html"));
const srv = http.createServer((q, s) => {
  s.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  s.end(html);
});
const wss = new WebSocketServer({ server: srv, maxPayload: 16384 });
const rooms = new Map();
function bc(name) {
  const r = rooms.get(name);
  if (!r) return;
  const list = [...r].map(([id, c]) => ({ peer: id, presence: c.p }));
  r.forEach((c, id) => {
    if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ t: "s", you: id, list }));
  });
}
wss.on("connection", (ws) => {
  let name = null;
  const id = Math.random().toString(36).slice(2, 10);
  ws.on("message", (d) => {
    let m;
    try { m = JSON.parse(d); } catch { return; }
    if (m.t === "j" && !name && /^[a-z0-9-]{1,20}$/.test(m.r)) {
      name = m.r;
      if (!rooms.has(name)) rooms.set(name, new Map());
      rooms.get(name).set(id, { ws, p: {} });
      bc(name);
    } else if (m.t === "p" && name && m.p && typeof m.p === "object") {
      const c = rooms.get(name).get(id);
      if (c) { Object.assign(c.p, m.p); bc(name); }
    }
  });
  ws.on("close", () => {
    if (!name) return;
    const r = rooms.get(name);
    r.delete(id);
    if (!r.size) rooms.delete(name); else bc(name);
  });
  ws.on("error", () => {});
});
setInterval(() => wss.clients.forEach((c) => { if (c.readyState === 1) c.ping(); }), 25000);
srv.listen(process.env.PORT || 3000);
