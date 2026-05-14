# Gateway Forwarder Deployment

Deploy this directory as its own Vercel project. The Gateway Forwarder is the
Discord Gateway transport only; the Cloudflare Event Processor remains a
separate deployment and owns event handling, state, and orchestration.

## Cron

`vercel.json` starts `GET /api/discord/gateway` every 9 minutes:

```json
{
  "crons": [
    {
      "path": "/api/discord/gateway",
      "schedule": "*/9 * * * *"
    }
  ]
}
```

The route keeps each listener open for `GATEWAY_LISTENER_DURATION_MS`, which is
10 minutes. The one-minute overlap prevents gaps between listener windows.

## Required Vercel Environment Variables

Set these on the Vercel project for the Gateway Forwarder:

| Variable | Required | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_DISCORD_WEBHOOK_URL` | Yes | Full Cloudflare Event Processor URL for forwarded Gateway events, normally `https://<worker-host>/webhooks/discord`. |
| `CRON_SECRET` | Yes | Shared secret Vercel sends as `Authorization: Bearer <CRON_SECRET>` when invoking the cron route. |
| `DISCORD_APPLICATION_ID` | Yes | Discord application ID for the Gateway Forwarder adapter. |
| `DISCORD_BOT_TOKEN` | Yes | Discord bot token used to connect to the Gateway. |
| `DISCORD_PUBLIC_KEY` | Yes | Discord application public key expected by the adapter configuration. |
| `DISCORD_GATEWAY_USER_NAME` | No | Adapter user name override. Defaults to `flue-discord-demo`. |

Do not hard-code the Cloudflare URL in this app. Change
`CLOUDFLARE_DISCORD_WEBHOOK_URL` when the Event Processor deployment URL changes.
