---
name: computer-use
description: Main-agent-only desktop control through accessibility-first semantic actions with visual pixel fallback only when accessibility cannot reach the target.
---

# ZCode Computer Use

Main agent only. Never delegate Computer Use to a subagent.

## Core loop

Observe once, act once, then verify.

1. If readiness is unknown, call `request_access` once.
2. `list_apps` shows running apps only. If the user names an app that is absent,
   use `open_application` once with the original user-provided name: copy it character-for-character,
   including its script, case, spaces, punctuation, and suffixes such as `app`.
   For example, use `{"name":"网易云音乐app"}`, not `{"name":"网易云音乐"}`;
   use `{"name":"日历"}`, not `{"name":"Calendar"}`.
   Do not translate, localize, normalize, shorten, or remove a suffix. Do not retry names,
   operate Finder/Spotlight, use shell commands to discover it, or substitute a different running app.
3. Call `get_app_state`. Start with the accessibility tree and no screenshot.
4. If the target has an accessibility element, use an element action. This is the primary path because it is semantic, precise, background-safe, and does not steal the user's focus.
5. Only when accessibility cannot locate or express the target, request a window
   screenshot or full screenshot and use a frame-bound coordinate action.
6. Let actions return the default receipt only. Use `return_state="compact"` or
   call `get_app_state` only when the next step needs fresh UI state.

Do not run both the accessibility and visual workflows for the same action.
Do not activate or focus an app merely to make a semantic action work.
Honor tool capabilities and fail-closed results.

Tool failures are reported without a producer-side permission classifier. Read
the original message before choosing recovery. Call `request_access` once only
when the failure explicitly names Accessibility or Screen Recording; do not
infer macOS permission loss from a generic `permission_denied`, foreground,
focus-policy, UIPI, or capability failure. If delivery is `possibly_sent`,
observe the application state and never replay the same action automatically.
If `request_access` reports Accessibility as `denied`/`stale` or Screen Recording
as `denied`, tell the user that authorization is required and end the current
turn. Do not call another Computer Use action, retry `request_access`, or promise
that the interrupted action will continue automatically after authorization.

## Choose the target

There are two authoritative target forms:

- Element: `{"type":"element","state_id":"<state_id>","index":<index>}`
- Coordinate: `{"type":"coordinate","x":<x>,"y":<y>}`

Use an element target whenever the observed accessibility tree contains the
target. Use only an action advertised by the element.
Never translate image pixels into an element target.

Use a coordinate target only for a point chosen from the latest returned image.
Submit only `x` and `y`. Do not attach an `app_ref`, `state_id`, coordinate-space
name, or extra transform to it. An optional explicit `frame_id` exists only for
backward compatibility; never invent one.

### Frame-bound coordinates

Choose `x` and `y` only by looking at the current returned raster.
Submit those integers unchanged; CUA binds the current raster internally.
CUA owns every transform from the returned raster to native dispatch.

When visual fallback begins, discard coordinate-like numbers from earlier text or accessibility results.
They are not part of the visual task.

Act directly on the current raster when the target is clear.
Do not call `zoom` routinely.
Zoom is not part of the normal flow.
Use `zoom` only when the target is too small or ambiguous to select confidently.
For a Zoom result, choose the point in that returned child raster and submit only its pixels.

## Action strategy

- Accessibility element action is always preferred. It avoids focus changes and
  real-pointer movement.
- `strategy="a11y"` requires an accessibility action and fails closed otherwise.
- For a coordinate target, `strategy="auto"` may use an actionable accessibility
  hit first and otherwise follows the tool's declared fallback behavior.
- `strategy="event"` forces the raw coordinate path on tools that expose it. Use
  it only when accessibility cannot perform the intended action or the task
  explicitly requires visual pixel interaction.

On macOS, verified app/window-scoped raw dispatch is designed not to move the
real cursor or steal focus. Linux and Windows may require the target window to
be foreground for raw input. Never bypass a stale-frame, changed-owner,
occlusion, permission, or capability refusal.

A coordinate refusal may report that windows covering the point were skipped, or
name an owner other than the app you expected. Those windows are invisible
overlays belonging to the user's environment. Raise the window you meant to act on
with `open_application(activate=true)`, observe again, and retry. Do not move,
resize, or close the reported windows.

### macOS file panels

For an `open_panel` / `save_panel` exact-path workflow, background app-scoped
keyboard receipts may be accepted without executing the AppKit command. Use this
single recovery sequence:

1. Observe the panel and keep its `pid`, `bundle_id`, and fresh `actual_window_id`.
2. Call `open_application` with those three fields and `activate=true`.
3. Observe the same panel again, then send Cmd+Shift+G with `strategy=event` and
   that exact panel window id.
4. Observe by `pid` / `bundle_id` **without the old panel `window_id`**, so CUA
   returns the newly focused `attached_dialog`. Pin its fresh `actual_window_id`
   for the path `type(strategy=event)` and Enter.

`key` and `type` never activate implicitly. If they return `foreground_required`
with `action_sent=false`, repeat the confirmed activation and fresh observation;
do not retry the same key blindly. Ordinary windows and popovers do not receive
this activation exception.

For every ordinary launch or application activation, omit `window_id`. Never
invent a window id or use a placeholder such as `1`. If `bundle_id` or `pid` is
known, pass that canonical identity without a translated or guessed `name`.

## Text and keyboard

Prefer `set_value` for editable elements. It is semantic and background-safe.
Use `select_text` and `perform_action` for element capabilities exposed by the
current state.

Never send targetless `type` or `key`; scope them with an element target or
`app_ref` as allowed by the tool schema. Preserve a returned `window_id` in
`app_ref` so the runtime can verify and retain window scope.
macOS uses `cmd`; Linux and Windows use `ctrl`.
Use `hold_key` for a duration; use `key` for a normal chord or repeated presses.

Platform app references:

- macOS: prefer `bundle_id`, otherwise `pid`.
- Windows: use AUMID in `bundle_id` for packaged apps; otherwise `name` or `pid`.
- Linux: use `name` or `pid`; do not invent a bundle id.

## Outcome and retry safety

`action_sent=true` means the action may already have happened. Never blindly
replay it. When `action_sent=false`, re-observe with `get_app_state`, choose a
fresh target from the new state, and issue a new action only if it is still
needed. Never replay the same stale action call.

The default action result is an `action_receipt`, not a UI observation. Old
`state_id` values used by a sent element write are consumed after dispatch; call
`get_app_state` before another element write or whenever the next step depends
on current UI state. A changed tree is not by itself proof that this action
caused the change; verify with the app state or an external task oracle when it
matters.

Call `stop_computer_control` to stop the active control session. Do not continue
after the kill switch, denied access, or a non-retryable readiness result.

## Tool surface

Tool schemas are authoritative for arguments and supported strategies. The 30
tools are grouped as follows:

- Observe and resolve: `list_apps`, `open_application`, `list_windows`,
  `get_app_state`, `screenshot`, `zoom`, `list_displays`, `switch_display`,
  `cursor_position`
- Pointer: `left_click`, `double_click`, `triple_click`, `right_click`,
  `middle_click`, `scroll`, `left_click_drag`, `mouse_move`, `left_mouse_down`,
  `left_mouse_up`
- Text and keyboard: `type`, `set_value`, `select_text`, `key`, `hold_key`
- Semantic: `perform_action`
- Runtime: `request_access`, `stop_computer_control`, `wait`, `read_clipboard`,
  `write_clipboard`

Do not infer unsupported arguments from this guide. Read the live tool schema,
prefer the accessibility path, and use screenshot pixels only as the fallback.
