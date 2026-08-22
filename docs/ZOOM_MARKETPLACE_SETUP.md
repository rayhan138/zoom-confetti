# Zoom Marketplace setup

Use these steps for local development testing.

## App type

Create a Zoom Marketplace **General App**.

Recommended development mode:

- User-managed app
- Zoom App surface enabled
- Local Test enabled

## OAuth information

If your tunnel URL is:

```text
https://example.trycloudflare.com
```

set:

```text
OAuth Redirect URL:
https://example.trycloudflare.com/api/zoom/auth
```

For OAuth Allow List, add:

```text
https://example.trycloudflare.com
```

Zoom may also auto-add the redirect URL. Keeping both is fine during development.

## Surface

Set:

```text
Home URL:
https://example.trycloudflare.com
```

Set Domain Allow List:

```text
example.trycloudflare.com
appssdk.zoom.us
```

Do not include `https://` in the Domain Allow List field.

If Zoom asks for a reason for a temporary tunnel domain, use:

```text
Temporary development tunnel for local Zoom App testing.
```

## Local Test

After saving the settings:

1. Go to `Local Test`.
2. Add or update the test app.
3. Open Zoom desktop.
4. Start a meeting.
5. Open Apps.
6. Launch the app.

## Important tunnel note

Free Cloudflare/ngrok tunnel URLs are temporary. If the tunnel restarts, update all matching Zoom Marketplace fields:

- Home URL
- OAuth Redirect URL
- OAuth Allow List
- Domain Allow List
- `.env` `ZM_REDIRECT_URL`
