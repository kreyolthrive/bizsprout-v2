import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

export const status2xx = new Rate('status_2xx');
export const status429 = new Rate('status_429');
export const status5xx = new Rate('status_5xx');
export const ttfb = new Trend('ttfb', true);      // time to first byte
export const created = new Counter('created_201');

export const options = {
  // keep your scenarios here (spike + steady, etc.)
  thresholds: {
    // hard correctness gates
    http_req_failed: ['rate==0'],               // no network/HTTP-level failures
    status_5xx:     ['rate==0'],               // no 5xx allowed
    status_2xx:     ['rate>0.98'],             // 98%+ should be 200/201 in happy-path runs
    created_201:    ['count>100'],             // ensure we actually created rows in the run

    // latency gates (tune to your target/CI hardware)
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    ttfb:              ['p(95)<400'],
  },
  summaryTrendStats: ['avg','min','med','p(90)','p(95)','p(99)','max'],
};

const HOST = __ENV.HOST || 'http://localhost:3002';

export default function () {
  const url = `${HOST}/api/waitlist`;
  const payload = JSON.stringify({ email: `k6+${Math.random().toString(36).slice(2)}@example.com` });
  const res = http.post(url, payload, { headers: { 'content-type': 'application/json' } });

  status2xx.add(res.status >= 200 && res.status < 300);
  status429.add(res.status === 429);
  status5xx.add(res.status >= 500);
  ttfb.add(res.timings.waiting);
  if (res.status === 201) created.add(1);

  check(res, {
    'ok status': r => r.status === 201 || r.status === 200 || r.status === 429, // allow 429 in RL test runs
    'json ok true': r => (r.headers['Content-Type'] || '').includes('application/json') && r.json('ok') === true || r.status === 429,
  });

  sleep(1);
}
