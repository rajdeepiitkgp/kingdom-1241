/**
 * Reads a JSON answer from another site with a cap on its size. kingshot.net's
 * list and MightPulse's rankings are a few kilobytes; an answer of megabytes
 * is a broken or hostile server, and parsing it would cost the function its
 * memory and its time budget. Over the cap the body is dropped and a
 * ResponseTooLargeError thrown, which the callers treat like an unreachable
 * server.
 */
export const JSON_RESPONSE_LIMIT = 1_000_000;

export class ResponseTooLargeError extends Error {
  constructor(limit: number) {
    super(`The answer is larger than ${limit} bytes`);
    this.name = "ResponseTooLargeError";
  }
}

export async function readJson(response: Response, limit = JSON_RESPONSE_LIMIT): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new ResponseTooLargeError(limit);
  const body = response.body;
  if (!body) {
    const text = await response.text();
    if (text.length > limit) throw new ResponseTooLargeError(limit);
    return JSON.parse(text) as unknown;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ResponseTooLargeError(limit);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
