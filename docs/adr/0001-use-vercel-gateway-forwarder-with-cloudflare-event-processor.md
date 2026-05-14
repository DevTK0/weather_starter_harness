# Use Vercel Gateway Forwarder with Cloudflare Event Processor

Discord mention requests require the Discord Gateway, while Cloudflare Workers cancelled the long-lived `waitUntil` task used by the Chat SDK Discord adapter to maintain that Gateway connection. We will host a minimal Vercel Gateway Forwarder that starts the Chat SDK Discord Gateway listener on an overlapping cron window and forwards all Gateway events to the Cloudflare Event Processor, where Durable Object-backed chat state and orchestration remain.

**Considered Options**

- Cloudflare-only Gateway listener: rejected because the long-lived Gateway task was cancelled by the Worker runtime.
- Slash-command-only UX: rejected for now because the demo goal is a natural mention request in a Discord channel.
- Always-on Discord service: viable, but deferred because the Vercel Gateway Forwarder preserves the Chat SDK adapter path while staying managed.

**Consequences**

- Vercel owns Gateway transport only; Cloudflare remains the source of truth for event processing and state.
- Cloudflare no longer runs cron or manual Gateway listener paths.
- The Gateway Forwarder must stay thin, forward all events produced by the Chat SDK adapter's built-in forwarding mode, and leave filtering to the Cloudflare Event Processor.
- The Gateway Forwarder uses overlapping listener windows: a 10-minute listener duration restarted every 9 minutes.
- The Gateway Forwarder sends forwarded events to the Cloudflare Event Processor's existing `/webhooks/discord` endpoint, which the Chat SDK Discord adapter already uses for forwarded Gateway events.
