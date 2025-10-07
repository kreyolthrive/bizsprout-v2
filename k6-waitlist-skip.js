import http from "k6/http";
import { check, sleep } from "k6";
export const options = {
  scenarios: {
    steady: { executor: "constant-vus", vus: 30, duration: "1m" },
    spike:  { executor: "ramping-vus", startVUs: 0, stages: [
      { duration: "10s", target: 100 },
      { duration: "20s", target: 100 },
      { duration: "10s", target: 0 },
    ]},
  },
  thresholds: { http_req_duration: ["p(95)<800"] },
};
export default function () {
  const host = __ENV.HOST || "http://localhost:3002";
  const email = `k6+${__ITER}@example.com`;
  const res = http.post(`${host}/api/waitlist`, JSON.stringify({ email }), {
    headers: { "Content-Type": "application/json" }
  });
  const ok2xx = res.status === 200 || res.status === 201;
  let skipped = false;
  try { const j = res.json(); skipped = j && (j.skipped === true || j.ok === true); } catch (_) {}
  check(res, { "2xx": () => ok2xx, "skip or ok": () => skipped });
  sleep(1);
}
