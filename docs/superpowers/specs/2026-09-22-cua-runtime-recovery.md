# CUA runtime recovery

## Scope

Restore the Windows Computer Use broker client needed by the existing
`node_repl` host, and make the official Helper runtime available to source
builds through an explicit local staging step. The native Helper remains an
external runtime artifact; the open-source build owns its discovery, manifest
validation, lifecycle and broker connection.

## Ownership and event order

```text
Desktop/Helper host owns Helper lifecycle and named-pipe path
  -> node_repl captures ZCODE_CUA_PERMISSION_BROKER_SOCKET
  -> @zcode/zcode-cua authenticates (IPC v2)
  -> broker method request is admitted
  -> Helper returns one JSONL response
  -> node_repl projects the result
```

The runtime client owns no accepted queue, session state, or permission state.
It opens one bounded connection per request and treats the broker as the source
of truth. A missing socket, authentication failure, malformed response, or
timeout remains unavailable and must not fall back to local automation.

## Contract

- Request ids sent to the Helper are non-negative safe integers.
- The first request is `authenticate` with `clientApiVersion: 2` and
  `client_type: "zcode_cua_mcp"`.
- Subsequent requests use `{id, method, params}` JSONL messages.
- Responses use `{id, ok, result}` or `{id, ok: false, error}`.
- Desktop continuous and replayable remote contexts are passed as request
  metadata; this change does not merge their delivery semantics.

## Acceptance cases

1. Given a valid Windows named-pipe path, `broker_info` authenticates and
   returns a successful result.
2. Given a malformed or unauthenticated response, the call rejects with a
   typed broker error and does not retry a possibly delivered mutation.
3. Given an absent broker path, `createComputerUseRuntime` remains unavailable
   and the existing node_repl error is preserved.
4. Given an abort signal, the socket is destroyed and the promise settles.

## Source-build runtime staging

- On Windows, `pnpm --filter @zcode/desktop prepare:cua-helper` stages the
  runtime into `packages/desktop/dist-cua-helper`.
- `ZCODE_CUA_HELPER_SOURCE` may point to another local Helper runtime; when it
  is absent, the script uses the standard installed ZCode path under
  `%LOCALAPPDATA%/Programs/ZCode/resources/tools/cua-helper`.
- The staged package name is normalized to `@zcode/zcode-cua` because the
  runtime resolver validates the producer contract name. The native files and
  manifest hashes are copied unchanged.
- `pnpm dev:desktop` sets `ZCODE_CUA_DEV_ROOT` to the staged directory. Windows
  production packaging copies that directory to `resources/tools/cua-helper`.
