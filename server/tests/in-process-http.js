// Offline transport for the exact same Express middleware. It does not pretend
// to be Supertest: npm test uses Supertest; test:offline avoids sandboxed ports.
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";

export function inProcessRequest(app) {
  const request = {};
  for (const method of ["get", "post", "patch", "put", "delete", "options"]) request[method] = (path) => {
    let body, headers = {};
    const run = () => new Promise((resolve, reject) => {
      const chunks = [];
      const socket = new Duplex({ read() {}, write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
      socket.remoteAddress = "127.0.0.1";
      const req = new IncomingMessage(socket);
      const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
      req.method = method.toUpperCase(); req.url = path; req.httpVersion = "1.1";
      req.headers = { host: "localhost", ...headers, ...(data ? { "content-type": "application/json", "content-length": String(data.length) } : {}) };
      const res = new ServerResponse(req);
      res.assignSocket(socket);
      res.on("error", reject);
      res.on("finish", () => {
        const raw = Buffer.concat(chunks).toString();
        const text = raw.slice(raw.indexOf("\r\n\r\n") + 4);
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null, headers: res.getHeaders() });
      });
      app(req, res);
      if (data) req.push(data);
      req.complete = true;
      req.push(null);
    });
    const chain = { send(value) { body = value; return chain; }, set(name, value) { headers[name.toLowerCase()] = value; return chain; }, then(yes, no) { return run().then(yes, no); } };
    return chain;
  };
  return request;
}
