//! # rustra-messages
//!
//! The channel adapter layer: how agents reach users *outside* the chat
//! transcript. This is the Rust analogue of Mastra's notification/channel
//! surface, built on the classic adapter pattern — one small
//! [`ChannelAdapter`] trait, many interchangeable delivery backends:
//!
//! * [`InAppChannel`] — persists a [`ChannelMessageRecord`] and broadcasts it
//!   over a `tokio::sync::broadcast` channel for live SSE delivery to
//!   connected clients (name `in_app`).
//! * [`SlackWebhookChannel`] — posts `{"text": ...}` to a Slack incoming
//!   webhook (name `slack`).
//! * [`WebhookChannel`] — posts the full [`OutboundMessage`] as JSON to an
//!   arbitrary URL with configurable headers (name `webhook`).
//! * [`EmailChannel`] — resolves the user id to an email address and hands
//!   the mail to a pluggable [`Mailer`] (name `email`).
//!
//! Adapters register with a [`ChannelRegistry`], which routes sends by
//! channel name and **always** persists an audit-trail
//! [`ChannelMessageRecord`] (flagged with `metadata.audit = true`) regardless
//! of which adapter delivered — or failed to deliver — the message. Agents
//! get access through [`send_message_tool`], which is hard-scoped to the
//! calling principal: a tool invocation can only message `ctx.runtime.user_id()`.
//!
//! ## Known tech debt
//!
//! * **No SMTP mailer yet.** [`LogMailer`] (tracing + in-memory capture) is
//!   the only shipped [`Mailer`]; a real SMTP/API implementation (lettre,
//!   SES, ...) plugs in behind the same trait.
//! * In-app sends produce **two** records: the user-visible message written
//!   by the adapter and the registry's audit copy. Consumers should filter
//!   on `metadata.audit` when listing an inbox.
//! * Slack/webhook adapters do not retry; callers rely on
//!   [`rustra_core::Error::is_retryable`] upstream.
//!
//! [`ChannelMessageRecord`]: rustra_storage::types::ChannelMessageRecord

mod adapters;
mod registry;
mod tool;
mod types;

pub use adapters::{
    AddressResolver, EmailChannel, InAppChannel, LogMailer, Mailer, SentMail, SlackWebhookChannel,
    WebhookChannel,
};
pub use registry::ChannelRegistry;
pub use tool::send_message_tool;
pub use types::{ChannelAdapter, DeliveryReceipt, OutboundMessage};
