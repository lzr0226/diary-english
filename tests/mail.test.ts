import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { sendFeedback } from "../src/lib/integrations/mail";
test("direct feedback sends only form content to fixed recipient through local SMTP", async () => {
  let message = "",
    recipient = "";
  const server = net.createServer((socket) => {
    socket.write("220 localhost test SMTP\r\n");
    let buffer = "",
      inData = false;
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 Accepted\r\n");
          } else message += line + "\n";
          continue;
        }
        if (line.startsWith("EHLO"))
          socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
        else if (line.startsWith("AUTH")) socket.write("235 Authenticated\r\n");
        else if (line.startsWith("RCPT")) {
          recipient = line;
          socket.write("250 OK\r\n");
        } else if (line === "DATA") {
          inData = true;
          socket.write("354 Send content\r\n");
        } else if (line === "QUIT") {
          socket.end("221 Bye\r\n");
        } else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const keys = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
  ];
  const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String((server.address() as net.AddressInfo).port),
    SMTP_SECURE: "false",
    SMTP_USER: "test",
    SMTP_PASSWORD: "test",
    SMTP_FROM: "test@example.com",
  });
  try {
    const result = await sendFeedback({
      subject: "Local test",
      message: "Feedback body only",
      replyTo: "reply@example.com",
      to: "other@example.com",
      diary: "PRIVATE_DIARY",
    });
    assert.match(result, /已接受/);
    assert.match(recipient, /1363578991@qq.com/);
    assert.doesNotMatch(message, /PRIVATE_DIARY|other@example.com/);
    assert.match(message, /Feedback body only/);
    assert.match(message, /Reply-To: reply@example.com/);
  } finally {
    for (const k of keys) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
