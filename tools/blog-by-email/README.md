# Blog by email

Publish a post to the blog by emailing yourself. Subject:

```
{BLOG} My Post Title
```

The email body becomes the post. A Google Apps Script (`Code.gs`) checks Gmail
once a minute, and any matching, authorized email is committed to `_blog/` via
the GitHub API — same filename/front-matter as the local `blog` alias. GitHub
Pages then rebuilds the site.

This folder is documentation + source of truth for the script. The **running**
copy lives in your Google account (Apps Script); it is not executed from the repo.

## One-time setup (~5 minutes)

### 1. GitHub token
- GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate.
- **Resource owner:** you. **Repository access:** only `verma314/verma314.github.io`.
- **Permissions → Contents: Read and write.** (Nothing else is needed.)
- Set an expiry you're comfortable with, generate, and copy the token.

### 2. Create the Apps Script
- Sign into the **Gmail account that receives your blog emails**, then go to
  <https://script.google.com> → **New project**.
- Delete the stub and paste the full contents of `Code.gs`. Rename the project
  `blog-by-email`.

### 3. Add the secret
- Project **Settings** (gear icon) → **Script properties** → **Add script property**:
  - Name: `GITHUB_TOKEN`
  - Value: *(the token from step 1)*

### 4. Tune the config (top of `Code.gs`)
- `allowedSenders` — every address you send from. This is the security guard:
  only these senders can publish. (Pre-filled with your known addresses.)
- `secretKeyword` — leave `''` to rely on the sender list, or set e.g. `'hunter2'`
  and then use `{BLOG:hunter2} Title` in subjects for a second guard.
- `timezone` — controls the offset written into `date:` (default `Europe/London`).

### 5. Authorize + install the trigger
- In the editor, choose the function **`setup`** and click **Run**.
- Approve the OAuth prompt (Gmail read/modify, external requests, triggers).
  You may see an "unverified app" screen — it's your own script; choose
  *Advanced → go to project (unsafe)*.
- `setup` installs a **1-minute** trigger. Done.

## Use it

Email yourself:

```
To:      you@gmail.com
Subject: {BLOG} Hello from my phone
Body:    Whatever you want the post to say.
```

Within ~1 minute a new file appears in `_blog/`, GitHub Pages rebuilds, and the
thread gets a **blogged** label + is marked read.

## Notes & troubleshooting

- **Executions** tab (left sidebar) shows each run's logs.
- A message that errors during publish gets a **blog-error** label so it isn't
  retried in a loop — remove the label to retry after fixing the cause.
- Signatures like `Sent from my iPhone` and standard `-- ` blocks are stripped.
- Same title on the same day → the second post becomes `...-Title-2.markdown`.
- Attachments/inline images are **not** handled yet (plain text only).
