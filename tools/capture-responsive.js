#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const net = require("net");

const [, , url, outPath, widthArg, heightArg] = process.argv;
const width = Number(widthArg);
const height = Number(heightArg);
const port = Number(process.env.CDP_PORT || 9222);

if (!url || !outPath || !width || !height) {
  console.error("Usage: node tools/capture-responsive.js <url> <out.png> <width> <height>");
  process.exit(1);
}

function requestJson(path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path, method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitForDebugger() {
  let lastError;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await requestJson("/json/version");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw lastError;
}

class CdpSocket {
  constructor(webSocketUrl) {
    const parsed = new URL(webSocketUrl);
    this.host = parsed.hostname;
    this.port = Number(parsed.port);
    this.path = `${parsed.pathname}${parsed.search}`;
    this.buffer = Buffer.alloc(0);
    this.callbacks = new Map();
    this.events = new Map();
    this.id = 1;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString("base64");
      this.socket = net.createConnection({ host: this.host, port: this.port }, () => {
        this.socket.write(
          [
            `GET ${this.path} HTTP/1.1`,
            `Host: ${this.host}:${this.port}`,
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Key: ${key}`,
            "Sec-WebSocket-Version: 13",
            "",
            "",
          ].join("\r\n"),
        );
      });

      let handshake = Buffer.alloc(0);
      const onHandshake = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const end = handshake.indexOf("\r\n\r\n");

        if (end === -1) {
          return;
        }

        const head = handshake.slice(0, end).toString("utf8");

        if (!head.includes(" 101 ")) {
          reject(new Error(`WebSocket handshake failed: ${head}`));
          return;
        }

        this.socket.off("data", onHandshake);
        this.socket.on("data", (data) => this.onData(data));

        const rest = handshake.slice(end + 4);
        if (rest.length) {
          this.onData(rest);
        }

        resolve();
      };

      this.socket.on("data", onHandshake);
      this.socket.on("error", reject);
    });
  }

  onData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;

      if (length === 126) {
        if (this.buffer.length < 4) return;
        length = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (this.buffer.length < 10) return;
        length = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskOffset = masked ? 4 : 0;
      const frameLength = offset + maskOffset + length;
      if (this.buffer.length < frameLength) return;

      let payload = this.buffer.slice(offset + maskOffset, frameLength);

      if (masked) {
        const mask = this.buffer.slice(offset, offset + 4);
        payload = payload.map((byte, index) => byte ^ mask[index % 4]);
      }

      this.buffer = this.buffer.slice(frameLength);

      if (opcode === 1) {
        this.onMessage(payload.toString("utf8"));
      } else if (opcode === 8) {
        this.socket.end();
      }
    }
  }

  onMessage(text) {
    const message = JSON.parse(text);

    if (message.id && this.callbacks.has(message.id)) {
      const { resolve, reject } = this.callbacks.get(message.id);
      this.callbacks.delete(message.id);

      if (message.error) {
        reject(new Error(JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
      return;
    }

    if (message.method && this.events.has(message.method)) {
      const listeners = this.events.get(message.method);
      listeners.forEach((listener) => listener(message.params || {}));
      this.events.delete(message.method);
    }
  }

  send(method, params = {}) {
    const id = this.id;
    this.id += 1;

    const payload = JSON.stringify({ id, method, params });
    this.socket.write(this.encodeFrame(payload));

    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
    });
  }

  waitEvent(method) {
    return new Promise((resolve) => {
      const listeners = this.events.get(method) || [];
      listeners.push(resolve);
      this.events.set(method, listeners);
    });
  }

  encodeFrame(payloadText) {
    const payload = Buffer.from(payloadText);
    const length = payload.length;
    let offset = 2;
    let frame;

    if (length < 126) {
      frame = Buffer.alloc(2 + 4 + length);
      frame[1] = 0x80 | length;
    } else if (length < 65536) {
      frame = Buffer.alloc(4 + 4 + length);
      frame[1] = 0x80 | 126;
      frame.writeUInt16BE(length, 2);
      offset = 4;
    } else {
      frame = Buffer.alloc(10 + 4 + length);
      frame[1] = 0x80 | 127;
      frame.writeBigUInt64BE(BigInt(length), 2);
      offset = 10;
    }

    frame[0] = 0x81;
    const mask = crypto.randomBytes(4);
    mask.copy(frame, offset);

    for (let index = 0; index < length; index += 1) {
      frame[offset + 4 + index] = payload[index] ^ mask[index % 4];
    }

    return frame;
  }

  close() {
    this.socket.end();
  }
}

(async () => {
  await waitForDebugger();
  const target = await requestJson("/json/new?about%3Ablank", "PUT");
  const cdp = new CdpSocket(target.webSocketDebuggerUrl);

  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
  });

  await cdp.send("Page.navigate", { url });
  await new Promise((resolve) => setTimeout(resolve, 400));
  await cdp.send("Runtime.evaluate", {
    expression: "document.fonts ? document.fonts.ready : Promise.resolve()",
    awaitPromise: true,
  });

  if (url.includes("#")) {
    const hash = new URL(url).hash.slice(1);
    await cdp.send("Runtime.evaluate", {
      expression: `new Promise((resolve) => {
        const element = document.getElementById(${JSON.stringify(decodeURIComponent(hash))});
        if (element) {
          const original = document.documentElement.style.scrollBehavior;
          document.documentElement.style.scrollBehavior = "auto";
          window.scrollTo(0, element.offsetTop);
          document.documentElement.style.scrollBehavior = original;
        }
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      })`,
      awaitPromise: true,
    });
  }

  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });

  fs.writeFileSync(outPath, Buffer.from(screenshot.data, "base64"));
  cdp.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
