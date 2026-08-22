# Security

## Secrets

Never commit:

- `.env`
- `ZM_CLIENT_SECRET`
- Zoom OAuth access tokens
- tunnel logs
- local recordings or screenshots that include private meeting details

## Reporting issues

This is currently a private/development project. If you find a security issue, contact the repository owner directly instead of opening a public issue with sensitive details.

## Production notes

Before marketplace submission:

- use a permanent HTTPS host
- rotate any credentials that were used during public demos
- set a strong `SESSION_SECRET`
- verify OAuth redirect URLs exactly match Zoom Marketplace settings
- review cookie, privacy policy, and data handling requirements
