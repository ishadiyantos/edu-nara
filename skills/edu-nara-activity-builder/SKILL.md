---
name: edu-nara-activity-builder
description: Build and publish teaching activities in Edu Nara.
version: 0.1.0
author: Pak Salim, Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Edu Nara, teaching, activity design, classroom]
    related_skills: []
---

# Edu Nara Activity Builder

Turn an instructor's teaching request into a classroom-ready Edu Nara activity. This skill supports Board, Crossword, quiz, and Word Cloud planning, content drafting, and publication through verified interfaces. It does not assume undocumented API routes or expose student records.

## When to Use

- Instructor asks to create a Board, quiz, Crossword, Word Cloud, or other Edu Nara activity.
- Instructor asks to turn a lecture case, image, document, or prompt into a student activity.
- Instructor wants activity content entered into Edu Nara rather than returned as a draft only.

Don't use for routine student responses or for editing unrelated application code.

## Prerequisites

- Confirm the active Edu Nara environment and base URL; default production is `https://edu.ishaalim.dev` only when instructor context or configuration confirms it.
- Use an authenticated browser/UI session or a documented, authorized API credential. Never request, print, store, or put passwords, cookies, bearer tokens, or session secrets into prompts, source files, logs, or this skill.
- Check `docs/EDU-NARA-AI-API.md` for supported endpoints before automating writes.
- If no supported authoring API is available, use the signed-in UI only when it is accessible and permitted. Otherwise return a ready-to-paste activity draft and state that publication needs an authorized interface.

## Procedure

1. **Clarify the learning task from the supplied context.** Identify course/topic, learner level, learning outcome, class time, group arrangement, and expected output. Ask only when a missing detail changes the activity materially; otherwise state assumptions.
2. **Extract source-grounded facts.** For an image/document, inspect the source. Separate explicit facts, reasonable hypotheses, and missing data. Never invent case evidence, quotations, participant counts, results, or institutional details.
3. **Design activity mechanics.** Make students analyze, decide, create, or compare—not merely copy source text. Define the task prompt, response format, sequencing, time, and discussion/debrief questions.
4. **Choose activity type.** Use Board for multiple visible responses or group synthesis; Crossword for clue/answer retrieval; Quiz for bounded checks; Word Cloud for short phrases. Do not force a format if another fits better.
5. **Draft all content before writing.** For Board, provide exact title, ordered column names, concise student-facing prompts, and optional opening card/instructions. For Crossword, validate answer length, spelling, coordinates, direction, and crossings. For Quiz, provide options and mark correct answers only in the authoring payload. Keep student-facing content free of answer keys.
6. **Check scope and reversibility.** Identify whether action creates an activity, edits shared activity content, launches a live session, or posts student-visible content. Do not launch a session, open it to participants, delete data, or alter an existing activity unless instructor explicitly asks.
7. **Publish through verified interface.** Prefer documented authoring API when available. Otherwise use the signed-in UI and preserve instructor review. Never write production SQLite directly as a normal workflow. Do not bypass app validation, ownership checks, or audit controls.
8. **Read back and verify.** Confirm activity title, type, exact content, order, owner, and intended state. Verify no live session launched unless requested. Report URL/ID and any part not verified.
9. **Return concise handoff.** State what was created, where, what was checked, and whether it is draft-only or launched. Keep answer keys and private participant data out of the report unless specifically needed by the instructor.

## Board Design Defaults

- Prefer 4–7 columns with distinct analytic purposes.
- Separate facts from assumptions and unknowns.
- Ask for evidence from source, not unsupported speculation.
- Include stakeholder, diagnosis, proposed action, owner, and indicator when task concerns a real case.
- Avoid vague prompts such as “Discuss” or “What do you think?” without a required output.
- Make every column prompt short enough to scan on mobile.
- Use the existing Board title as activity identity; don't add redundant group-name fields.

## API and Safety Rules

- The current app's documented API surface is in `docs/EDU-NARA-AI-API.md`.
- Existing Board APIs are primarily session-scoped runtime APIs; do not infer that they can create library activities.
- Do not scrape admin HTML or automate SvelteKit form actions as a stable integration contract.
- Do not use direct DB writes for ordinary activity creation. If a one-off maintenance script is explicitly approved, scope it narrowly, use app services/validation, avoid secrets in files, and read back records.
- Never commit `.env`, credentials, cookies, databases, backups, WAL/SHM files, uploads, or production data.
- Do not expose answer keys in participant responses. Check server-side privacy whenever activity type stores correct answers.

## Verification Checklist

- [ ] Activity matches stated learning outcome and source facts.
- [ ] Student task and expected response are explicit.
- [ ] Facts, assumptions, and unknowns are distinguishable.
- [ ] Board columns/prompts or question order are correct.
- [ ] Activity ownership and type verified.
- [ ] No session launched unless requested.
- [ ] No undocumented route or direct DB write used as routine workflow.
- [ ] Final response names activity URL/ID and verification limits.

## Pitfalls

- A working `/api/boards/{sessionCode}/...` endpoint does not imply an activity-library authoring API exists.
- Admin server actions such as `?/create` are framework form handlers, not a stable public API contract.
- Existing CRUD runtime endpoints require an authenticated admin or participant cookie; never ask the instructor to paste the cookie into chat.
- A Board with columns only may need instructor instructions/cards; verify intended student flow before launch.
- Creating a draft activity and launching a session are separate actions; treat launch as a distinct consequential step.
- Current session may not load a newly authored local skill until a later session.

## References

- API inventory and local-agent integration guidance: `docs/EDU-NARA-AI-API.md`
- Product architecture and supported activity scope: `docs/PLANNING.md`, `docs/FEATURES.md`
- Repository safety and release requirements: `AGENTS.md`
- This skill is repo-local source. It does not install itself into `~/.hermes/skills/`.