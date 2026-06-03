/** node:http adapter: serve a Web fetch handler on a port. */
import { createServer } from "node:http";

export async function listen(
  handler: (req: Request) => Promise<Response>,
  port = 54321,
): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer(async (nodeReq, nodeRes) => {
    const url = `http://localhost:${port}${nodeReq.url ?? "/"}`;
    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) chunks.push(chunk as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const req = new Request(url, {
      method: nodeReq.method,
      headers: nodeReq.headers as Record<string, string>,
      body: body && nodeReq.method !== "GET" && nodeReq.method !== "HEAD" ? body : undefined,
    });
    const res = await handler(req);
    nodeRes.statusCode = res.status;
    res.headers.forEach((v, k) => nodeRes.setHeader(k, v));
    const buf = Buffer.from(await res.arrayBuffer());
    nodeRes.end(buf);
  });
  await new Promise<void>((resolve) => server.listen(port, resolve));
  return {
    url: `http://localhost:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}
