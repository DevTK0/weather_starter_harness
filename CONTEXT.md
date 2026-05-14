# Discord Implementation Harness

This context describes the language for a Discord-driven demo harness where a chat conversation initiates and scopes automated implementation work.

## Language

**Implementation Harness**:
A system that turns a user request into an isolated, observable implementation session.
_Avoid_: Bot, automation, agent system

**Demo Channel**:
The Discord channel where audience members submit implementation requests.
_Avoid_: Main channel, support channel

**Implementation Thread**:
A Discord thread that contains one implementation request and its follow-up conversation.
_Avoid_: Session, conversation, ticket

**Implementation Session**:
The durable work context for one **Implementation Thread**, including ingested conversation and implementation state.
_Avoid_: Thread, run, job

**Gateway Forwarder**:
The Vercel-hosted transport component that listens to Discord Gateway events and forwards them without domain filtering to the event processor.
_Avoid_: Bot service, webhook handler, processor

**Event Processor**:
The Cloudflare-hosted component that receives Discord-shaped events, applies chat state, and starts harness work.
_Avoid_: Gateway, listener, bot

**Forwarded Gateway Event**:
A Discord Gateway event received by the **Gateway Forwarder** and sent to the **Event Processor** over HTTP.
_Avoid_: Interaction, webhook event

**Interaction**:
A Discord HTTP event for slash commands, buttons, modals, or similar app interactions.
_Avoid_: Message, mention

**Mention Request**:
A normal Discord message that mentions the app and asks it to implement something.
_Avoid_: Interaction, slash command

**Message Batch**:
A group of user messages from an **Implementation Thread** ingested together into an **Implementation Session**.
_Avoid_: Queue, skipped messages, burst

**Sandbox Workspace**:
A persistent sandbox environment associated with one **Implementation Session**.
_Avoid_: Container, VM, project

## Relationships

- A **Demo Channel** contains many **Mention Requests**.
- A **Mention Request** creates exactly one **Implementation Thread**.
- An **Implementation Thread** owns exactly one active **Implementation Session**.
- An **Implementation Session** ingests one or more **Message Batches** over time.
- An **Implementation Session** owns exactly one **Sandbox Workspace**.
- The **Gateway Forwarder** produces **Forwarded Gateway Events**.
- The **Event Processor** consumes **Forwarded Gateway Events**.
- The **Event Processor** owns filtering decisions for **Forwarded Gateway Events**.
- An **Interaction** is delivered by Discord over HTTP, not through the **Gateway Forwarder** in the current plan.

## Example Dialogue

> **Dev:** "When a user mentions the app in the **Demo Channel**, do we treat that as an **Interaction**?"
> **Domain expert:** "No. That is a **Mention Request** delivered through the Discord Gateway, so the **Gateway Forwarder** receives it and forwards it to the **Event Processor**."

## Flagged Ambiguities

- "bot" was used to mean both the Discord-facing app and the whole implementation system; resolved: use **Gateway Forwarder** for transport, **Event Processor** for processing, and **Implementation Harness** for the whole system.
- "thread" was used to mean Discord thread, Chat SDK thread, and work session; resolved: use **Implementation Thread** for the Discord conversation boundary and **Implementation Session** for durable work context.
- "webhook" was used for both Discord interactions and forwarded Gateway traffic; resolved: use **Interaction** for Discord HTTP interactions and **Forwarded Gateway Event** for Gateway traffic sent to Cloudflare.
