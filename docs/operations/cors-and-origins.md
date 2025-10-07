# CORS and Allowed Origins

Set the ALLOW_ORIGIN environment variable to your production domain(s), comma-separated. The first origin is applied to responses.

Examples:
- Single domain: `ALLOW_ORIGIN=https://app.yourdomain.com`
- Multiple: `ALLOW_ORIGIN=https://app.yourdomain.com,https://www.yourdomain.com`

Notes:
- Avoid `*` in production.
- API routes read ALLOW_ORIGIN and set `Access-Control-Allow-Origin` accordingly.
