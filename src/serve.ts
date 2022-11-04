import path from "path";
import fs from "fs-extra";
import { orderBy, uniq } from "lodash";
import hostile from "hostile";
import http from "http";
import inquirer from "inquirer";

async function add(host: string) {
  return new Promise<void>((resolve, reject) => {
    const ip = "127.0.0.1";

    console.log("Setting", host, "=>", ip);

    hostile.set(ip, host, () => {
      resolve();
    });
  });
}

async function remove(host: string) {
  return new Promise<void>((resolve, reject) => {
    console.log("Removing", host);
    hostile.remove("127.0.0.1", host, () => {
      resolve();
    });
  });
}

async function serve(file: string, flags = { exclude: [] }) {
  const { exclude = [] } = flags;

  const resolved = path.resolve(__dirname, "..", file);

  const contents = await fs.readJSON(resolved, "utf-8");
  const har = contents.log;

  const hosts = har.entries.map((entry) => new URL(entry.request.url).host);

  const filtered =
    exclude.length === 0
      ? hosts
      : hosts.filter((host) => exclude.every((e) => !host.includes(e)));

  const choices = orderBy(uniq(filtered));

  const answers = await inquirer.prompt([
    {
      name: "hosts",
      message: `Select which of the ${choices.length} host(s) you'd like to setup.`,
      type: "checkbox",
      choices,
      default: choices,
    },
  ]);

  for (const host of answers.hosts) {
    await add(host);
  }

  const server = http.createServer((request, response) => {
    console.log(request.method, request.headers.host, request.url);

    const chunks = [];
    const size = 0;

    request.on("data", (data) => {
      chunks.push(data);
    });

    request.on("end", () => {
      const host = request.headers.host ?? "";

      const entry = har.entries.find((entry) => {
        const url = new URL(entry.request.url);

        if (url.host !== host) {
          return false;
        }

        if (request.method !== entry.request.method) {
          return false;
        }

        if (url.pathname !== request.url) {
          return false;
        }

        return true;
      });

      console.log({ entry });

      if (!entry) {
        response.statusCode = 404;
        response.end();
        return;
      }

      response.statusCode = entry.response.status;

      const blocked = ["content-encoding", "content-length"];

      for (const header of entry.response.headers) {
        if (blocked.includes(header.name.toLowerCase())) {
          continue;
        }

        response.setHeader(header.name, header.value);
      }

      if (entry.response.content.encoding === "base64") {
        console.log("buffer");

        const buffer = Buffer.from(entry.response.content.text, "base64");

        const html = buffer.toString("utf-8").replace(/https/gim, "http");

        return response.end(html);
      }

      console.log("string");

      response.end(entry.response.content.text.replace(/https/gim, "http"));
    });
  });

  process.on("SIGINT", async function () {
    for (const host of answers.hosts) {
      await remove(host);
    }

    process.exit(0);
  });

  return new Promise<void>((resolve, reject) => {
    server.listen(80, async () => {
      console.log("Listening on port", 80);
      resolve();
    });
  });
}

export default serve;
