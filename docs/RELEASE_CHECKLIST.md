# Release checklist

Use this before pushing publicly or sharing the repository with another developer.

## Code safety

- [ ] `.env` is not tracked
- [ ] no Zoom client secret is committed
- [ ] no access tokens are committed
- [ ] tunnel logs are not tracked
- [ ] generated screenshots/videos are not tracked unless intentionally added
- [ ] `npm run check` passes

## Developer clarity

- [ ] README matches the real app architecture
- [ ] Zoom Marketplace setup instructions are current
- [ ] known Camera Mode behavior is documented
- [ ] temporary tunnel URLs are not hard-coded in committed files

## Zoom testing

- [ ] app opens inside Zoom desktop
- [ ] sidebar shows connected status
- [ ] camera overlay starts
- [ ] startup blink/flash happens then video returns
- [ ] confetti appears on the real camera video
- [ ] mirror toggle behaves as expected
- [ ] `Turn off overlay` closes the camera overlay

## Production preparation

- [ ] replace temporary tunnel with a permanent HTTPS host
- [ ] configure a permanent domain
- [ ] update Zoom Marketplace production URLs
- [ ] create privacy policy and terms pages
- [ ] prepare marketplace screenshots
- [ ] prepare demo video
- [ ] review Zoom Marketplace submission requirements
