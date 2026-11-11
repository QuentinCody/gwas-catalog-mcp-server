import { expect, it } from "vitest";
import { nativeError } from "./native-error";

it("retains status and native provider text without forwarding response cookies", async () => {
  const error = await nativeError(new Response('{"error":"Revision Not Found"}', { status: 404, headers: { "set-cookie": "private" } }), "https://huggingface.co/api/datasets/gwascatalog/studies/revision/unknown");
  expect(error).toMatchObject({ status: 404, data: { http_status: 404, body_text: '{"error":"Revision Not Found"}', body_complete: true, text_sha256: expect.stringMatching(/^[a-f0-9]{64}$/) } });
  expect(JSON.stringify(error.data)).not.toContain("private");
});

it("bounds oversized Unicode errors and labels the evidence as a prefix", async () => {
  const error = await nativeError(new Response("α".repeat(50000), { status: 503 }), "https://ftp.ebi.ac.uk/example");
  expect(error).toMatchObject({ status: 503, data: { body_text: "α".repeat(32768), body_complete: false, hash_scope: "bounded decoded error prefix" } });
});
