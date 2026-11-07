import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route.js";
import { NextRequest } from "next/server";
import { hashApiKey } from "@admetrics/domain";

test("API ROUTE /api/tracking/events: Rejeita requisição sem header de autorização (401)", async () => {
  const req = new NextRequest("http://localhost:3000/api/tracking/events", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      eventId: "evt_1",
      eventName: "lead_capture",
      eventTimestamp: new Date().toISOString()
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.code, "UNAUTHORIZED_KEY_MISSING");
});

test("API ROUTE /api/tracking/events: Rejeita payload excessivo (> 32 KB) (413)", async () => {
  const req = new NextRequest("http://localhost:3000/api/tracking/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer admk_live_test_key",
      "content-length": "45000" // 45 KB > 32 KB
    },
    body: JSON.stringify({ eventId: "evt_large" })
  });

  const res = await POST(req);
  assert.equal(res.status, 413);
  const json = await res.json();
  assert.match(json.error, /Payload excessivo/i);
});

test("API ROUTE /api/tracking/events: Rejeita evento com payload malformado (400)", async () => {
  const req = new NextRequest("http://localhost:3000/api/tracking/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer admk_live_test_key"
    },
    body: JSON.stringify({
      eventId: "", // Min 1
      eventName: "evento_inexistente"
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.code, "VALIDATION_FAILED");
});

test("API ROUTE /api/tracking/events: Rejeita timestamp fora da janela de tempo (422)", async () => {
  const futureTimestamp = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min no futuro
  const req = new NextRequest("http://localhost:3000/api/tracking/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer admk_live_test_key"
    },
    body: JSON.stringify({
      eventId: "evt_future_1",
      eventName: "lead_capture",
      eventTimestamp: futureTimestamp
    })
  });

  const res = await POST(req);
  assert.equal(res.status, 422);
  const json = await res.json();
  assert.equal(json.code, "INVALID_TIMESTAMP_WINDOW");
});
