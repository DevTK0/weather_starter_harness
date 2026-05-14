# Run Flue POC in Cloudflare Event Processor

For the first Flue POC, the Cloudflare Event Processor will invoke Flue directly instead of handing work to a Vercel-hosted runner. This keeps Chat SDK state and Flue session history in the same Cloudflare Durable Object-backed environment, which is necessary for the latest-message-only memory model we want to prove.

**Considered Options**

- Vercel-hosted harness runner: rejected for this POC because it would need a separate Flue persistence strategy and would prove a different architecture.
- Cloudflare Event Processor: accepted because runtime compatibility with Flue and Vercel Sandbox from Cloudflare is the core proof we need next.

**Consequences**

- If Flue or Vercel Sandbox cannot run in the Cloudflare Worker runtime, we hard stop and revisit the architecture instead of adding a fallback path.
