# CLAUDE.md 

## Behavioral Guidelines

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No defensive code for scenarios that can't realistically occur in this codebase.

Ask yourself: *"Would a senior engineer say this is overcomplicated?"* If yes, simplify.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that **your** changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: *Every changed line should trace directly to the user's request.*

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

**If a verify step requires environment setup not yet confirmed, stop and ask — don't proceed or install dependencies unilaterally.**

### 5. Destructive Action Policy
**Always confirm before irreversible operations.**

Never run without explicit confirmation:
- `git reset --hard`, `git clean`, force-push
- `DROP TABLE`, `TRUNCATE`, direct `ALTER TABLE` (use migration scripts)
- Deleting files outside the current working scope
- Any command that modifies git history

If a task requires one of the above, state what you're about to do and why, then wait.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Languages
** Luôn trả lời bằng tiếng Việt
** Xưng hô bạn với user và mình cho bản thân
** Ghi rõ các code note khi triển khai để user có thể đọc hiểu