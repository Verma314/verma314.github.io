---
name: fix-symbols
description: Fix math and logic symbol formatting in one of Aditya's blog posts. Given a blog post name (e.g. "2026-07-27-Modal-Operators"), convert ASCII / pseudo-code math and logic notation into proper Unicode symbols and LaTeX WITHOUT changing the author's meaning, then git add / commit / push. Use when the user runs /fix-symbols <blog-name>.
---

# fix-symbols

Clean up the *formatting* of math and logic notation in a single blog post: turn ASCII placeholders and pseudo-LaTeX into real Unicode symbols and real LaTeX. This is a formatting pass only — the writing is Aditya's and its meaning must be preserved exactly.

Blog source lives in `_blog/*.markdown`. The generated site in `_site/` is never touched by this skill.

## 1. Locate the file

The argument is a blog name, possibly partial and any case (e.g. `Modal-Operators`, `2026-07-27-Modal-Operators`, `2026-07-27-Modal-Operators.markdown`).

- Search `_blog/` for a `.markdown` file whose name matches (case-insensitive, substring is fine).
- Exactly one match → use it.
- Zero matches → tell the user, list the closest candidates, and stop.
- More than one match → list them and ask which one; do not guess.

Read the whole file before editing.

## 2. What to convert

Replace ASCII / shorthand notation with the proper symbol. Follow the LaTeX style already used elsewhere in the file: inline math in `$...$`, display math in `$$...$$`. If the file already uses a symbol for something, stay consistent with it.

**Modal logic**
| Written | Becomes |
|---|---|
| `<>` (diamond) | `◇` |
| `[]` (box) | `□` |

**Common math notation (in prose / inline)**
| Written | Becomes |
|---|---|
| `->` (a map/function) | `\to` |
| `=>` | `\Rightarrow` |
| `<=>` | `\iff` |
| `<=`, `>=`, `!=` | `\leq`, `\geq`, `\neq` |
| `~=`, `≈` | `\approx` |
| `in` (set membership) | `\in` |
| `forall`, `exists` | `\forall`, `\exists` |
| `union`, `intersection`, `subset` | `\cup`, `\cap`, `\subseteq` |
| `R`, `C`, `Z`, `Q`, `N` (number sets) | `\mathbb{R}`, `\mathbb{C}`, … |
| `F` (a field) | `\mathbf{F}` |
| `R^n`, `x^2` | `\mathbb{R}^n`, `x^2` (real superscripts) |
| `a1`, `x_1` | `a_1`, `x_1` (real subscripts) |
| `*` (multiplication in math) | `\cdot` |
| `lambda`, `sigma`, `theta`, … | `\lambda`, `\sigma`, `\theta`, … |
| `sum`, `prod`, `sqrt` | `\sum`, `\prod`, `\sqrt{}` |
| `infinity` | `\infty` |

This table is a guide, not a whitelist — apply the same judgment to any other ASCII math/logic shorthand you find.

## 3. Rules — do not break these

1. **Never change the content or meaning.** Only change how a symbol is *written*, never what it says. Word choices, sentence structure, examples, numbers, and the author's typos in ordinary prose stay exactly as they are.
2. **Leave fenced code blocks (```` ``` ````) alone.** Those are real programs (e.g. Julia) or intentional structural pseudo-code. Do not LaTeX-ify them.
3. **Never touch the YAML frontmatter** (between the `---` lines).
4. **Don't invent math.** If a line is ambiguous (is `in` the English word or set membership? is `*` a bullet or multiplication?), leave it as-is rather than risk a wrong conversion.
5. **Be conservative.** When unsure whether something is a symbol-formatting fix or a content change, treat it as content and leave it.

## 4. If something looks wrong

If, while reading, you find something that appears **factually wrong or misinformed** (a false mathematical claim, a broken definition, a wrong symbol semantics — not a stylistic quibble), **stop before committing.** Do not silently "fix" the substance. Report it to Aditya, quote the passage, explain what seems off, and let him decide. You may still apply the safe symbol formatting elsewhere, but flag the issue clearly in your reply.

## 5. Commit and push

Once the formatting edits are done (and nothing was flagged as wrong that would block committing):

```
git add <path/to/the-one-blog-file.markdown>
git commit -m "fix symbols"
git push
```

- Add **only** the specific blog file that was edited — nothing else.
- **Do NOT add a `Co-Authored-By` trailer or any Claude/Anthropic attribution.** The writing is Aditya's; Claude only reformatted symbols. The commit author is his configured git identity — keep it that way.
- This is a personal blog: committing and pushing straight to the current branch (`master`) is the intended workflow — do not create a branch.

## 6. Report back

Tell the user, briefly: which file was fixed, the kinds of substitutions made (with a couple of examples), and confirm the commit + push succeeded. If you flagged a possible content problem in step 4, lead with that.
