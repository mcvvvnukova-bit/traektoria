# Mattermost Transport Design

Date: 2026-06-07

## Goal

Connect the existing PFDO recommendation bot to Mattermost without forking the conversation engine.

The first Mattermost MVP should let the bot work in direct messages and in channels when the bot is mentioned. It should reuse the same scenario logic already used by Telegram, MAX, and web chat.

## Existing Context

The backend currently keeps one conversation engine in `src/index.js` and adapts multiple transports around it:

- Telegram updates are mapped into `handleText` and `handleCallback`;
- MAX updates are mapped into the same internal handlers;
- web chat collects internal bot messages and exposes them over HTTP;
- sessions are keyed by `platform:id` through `targetKey`;
- outbound messages pass through `sendMessage`;
- outbound documents pass through `sendDocument`.

Mattermost should be added as another transport adapter. It should not introduce a separate dialogue implementation.

## MVP Scope

Supported in the first version:

- login as the dedicated Mattermost service account `botnumber2`;
- listen to Mattermost events through WebSocket;
- respond in direct messages;
- respond in channels only when the bot is explicitly mentioned;
- post bot responses through the Mattermost REST API;
- preserve per-user/channel sessions using Mattermost string identifiers;
- support PDF delivery if file upload is available for the account.

Out of scope for the first version:

- responding to every message in a channel;
- administrative Mattermost actions;
- slash command registration;
- multi-workspace routing;
- advanced interactive buttons if they require a larger Mattermost-specific UI layer.

## Configuration

New environment variables:

```env
MATTERMOST_ENABLED=true
MATTERMOST_URL=https://mattermost.fabit.ru
MATTERMOST_USERNAME=botnumber2
MATTERMOST_PASSWORD=<set-in-env-only>
MATTERMOST_MODE=mentions
MATTERMOST_REPLY_MODE=thread
```

`MATTERMOST_PASSWORD` must only live in `.env` or server environment variables. It must not be committed to git, printed in logs, or written into documentation.

Future hardening should replace password login with a bot token or Personal Access Token:

```env
MATTERMOST_TOKEN=<set-in-env-only>
```

If `MATTERMOST_TOKEN` is present, the transport should prefer it over username/password login.

## Account And Permissions

The Mattermost account should be least-privilege:

- account: `botnumber2`;
- role: normal member or bot member;
- no System Admin role;
- membership only in teams/channels where the bot should work.

The bot only needs permission to read relevant messages, post messages, and upload files if PDF delivery is enabled.

## Target Identity

Mattermost IDs are strings. The existing `makeTarget(platform, chatId)` currently coerces IDs to numbers, which is unsafe for Mattermost.

The implementation should change target normalization so platform IDs can be strings. Telegram and MAX numeric IDs can continue to work, but the canonical stored ID should be a stable string.

Recommended Mattermost target keys:

- direct message: `mattermost:dm:<user_id>`;
- channel mention: `mattermost:channel:<channel_id>:user:<user_id>`;

This keeps a user's channel conversation separate from their direct-message conversation.

## Incoming Event Flow

1. On startup, Mattermost transport logs in or uses `MATTERMOST_TOKEN`.
2. The transport opens Mattermost WebSocket.
3. For each posted-message event:
   - ignore messages from the bot itself;
   - parse the post JSON;
   - detect direct channel versus normal channel;
   - accept all direct-message posts;
   - accept channel posts only if they mention the bot;
   - strip the bot mention from the text;
   - map accepted text to `handleText({ platform: "mattermost", chat: { id }, text })`.
4. Existing scenario logic generates replies through `sendMessage`.

## Outbound Message Flow

`sendMessage` should route `platform === "mattermost"` to a new Mattermost sender.

For text messages, the sender should call Mattermost REST API to create posts in the current channel. For channel mentions, the default should be thread replies so bot responses stay attached to the user's message.

Telegram-style inline buttons should be converted conservatively:

- if Mattermost interactive actions are simple to add, map buttons to Mattermost post actions;
- otherwise render numbered text choices and accept user replies by number or exact label for the MVP.

The implementation should keep this conversion isolated so Mattermost UI behavior does not leak into the core flow.

## PDF Delivery

`sendDocument` should route `platform === "mattermost"` to a Mattermost file upload path.

If upload fails because of account permissions or API constraints, the bot should tell the user that PDF delivery is unavailable in Mattermost and keep the text recommendation flow working.

## Error Handling

Startup should fail fast when:

- `MATTERMOST_ENABLED=true` but neither token nor username/password is configured;
- `MATTERMOST_URL` is missing or invalid.

Runtime behavior:

- WebSocket disconnects should retry with bounded backoff;
- authentication failures should be logged without printing secrets;
- malformed Mattermost events should be ignored with a compact warning;
- outbound post failures should not crash unrelated Telegram/MAX/web transports.

## Testing

Local automated checks:

- `node --check src/index.js`;
- existing `node --test test/*.test.js`;
- targeted unit tests for string-safe target IDs;
- targeted unit tests for Mattermost mention filtering and direct-message detection.

Manual verification:

1. Start the bot with `MATTERMOST_ENABLED=true`.
2. Send a direct message to `botnumber2`.
3. Mention `botnumber2` in a test channel.
4. Confirm the bot ignores a normal channel message without mention.
5. Walk through at least the first scenario selection path.
6. Try PDF delivery once if the account has file-upload permission.

## Deployment Notes

The Beget service should receive only environment-variable changes and code changes. Secrets must be edited directly on the server or injected through the existing deployment environment. They should not be added to tracked files.

The health endpoint should include Mattermost transport status only if that can be done without exposing credentials.
