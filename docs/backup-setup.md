# Database backup setup

The clinic database currently has **no working backup**. Supabase's free tier
keeps none, so the live database is the only copy. `.github/workflows/db-backup.yml`
is written and complete, but it has never run: the tooling, the secrets and the
Drive token are all missing.

Work through these steps in order. Every one of them needs credentials, so they
have to be done by hand.

## Current state

| Thing                             | Status                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `.github/workflows/db-backup.yml` | Written, verified against live Supabase (614 KB, 28 table-data entries). **Untracked, not pushed** |
| `rclone`                          | Not installed                                                                                      |
| `gpg`                             | Not installed                                                                                      |
| Google Drive remote / token       | Never configured                                                                                   |
| The six repository secrets        | None set                                                                                           |
| Workflow runs                     | Zero, not even a manual one                                                                        |
| gpg encrypt/decrypt round trip    | Never tested                                                                                       |

## Step 1: Install the local tools

```bash
brew install rclone gnupg
```

`gnupg` is only needed so you can test decryption in step 9. The GitHub runner
has its own.

## Step 2: Create the Drive folder and grab its ID

In Google Drive, using your **personal** account, create a folder such as
`mimos-backups`. A service account will not work: it has zero Drive quota and
the upload fails with a confusing quota error.

Open the folder and copy the ID out of the URL:

```
https://drive.google.com/drive/folders/1a2B3cD4eF5gH6iJ7kL
                                       ^^^^^^^^^^^^^^^^^^^ GDRIVE_FOLDER_ID
```

## Step 3: Create your own Google OAuth client

Do not skip this. rclone's built-in client works locally but is heavily
rate-limited, and the workflow explicitly passes `GDRIVE_CLIENT_ID` and
`GDRIVE_CLIENT_SECRET`, which are blank if you use the default.

1. Go to https://console.cloud.google.com/ and create a project, e.g. `mimos-backup`.
2. APIs & Services > Library > enable **Google Drive API**.
3. APIs & Services > OAuth consent screen > External, fill in the required fields.
4. **Set publishing status to "In production".** Left in "Testing", Google
   expires the refresh token after 7 days and the backups die silently a week
   from now.
5. Create the client. Google renamed this area in 2025, so the console shows
   one of two layouts. Check the project selector in the top bar says
   `mimos-backup` first: creating the client in the wrong project is the usual
   reason the ID does not work.
   - **New layout:** left nav **Google Auth Platform** > **Clients** >
     **+ Create client**. Direct link: https://console.cloud.google.com/auth/clients
   - **Classic layout:** left nav **APIs & Services** > **Credentials** >
     **+ Create Credentials** > **OAuth client ID**. Direct link:
     https://console.cloud.google.com/apis/credentials

   Application type **Desktop app**, name it anything (`rclone` is fine), Create.
   Copy the client ID and client secret from the modal. If you close it too
   early they are not lost: click the client's name in the list and both are on
   that page, the secret behind a "show" toggle or the download-JSON button.

## Step 4: Configure rclone

```bash
rclone config
```

Answers:

| Prompt                  | Answer                             |
| ----------------------- | ---------------------------------- |
| New remote              | `n`                                |
| name                    | `gdrive`                           |
| storage                 | `drive`                            |
| client_id               | paste from step 3                  |
| client_secret           | paste from step 3                  |
| scope                   | `1` (full drive access)            |
| root_folder_id          | blank                              |
| service_account_file    | blank                              |
| Edit advanced config    | `n`                                |
| Use auto config         | `y` (opens a browser to authorize) |
| Configure as team drive | `n`                                |
| Confirm                 | `y`, then `q` to quit              |

Test it and pull out the three values:

```bash
rclone lsd gdrive: && sed -n '/^\[gdrive\]/,/^\[/p' ~/.config/rclone/rclone.conf
```

The `token = {...}` line, the whole JSON object including the braces, is
`GDRIVE_TOKEN`.

## Step 5: Generate the passphrase

```bash
openssl rand -base64 32
```

**Save this in your password manager right now.** If you lose it, every backup
ever made is unrecoverable ciphertext. GitHub secrets are write-only, so you
cannot read it back out later.

## Step 6: Push the workflow

It currently only exists on this Mac. A scheduled workflow has to be on the
default branch before it will ever fire.

```bash
git add .github/workflows/db-backup.yml && git commit -m "chore: nightly database backup to Google Drive" && git push origin main
```

## Step 7: Set the six secrets

GitHub > repo > Settings > Secrets and variables > Actions > New repository
secret, six times:

| Secret                 | Value                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL`      | the **direct** URL, port **5432**, from the commented `DIRECT_URL` line in `.env`. Not the 6543 pooler: `pg_dump` cannot use it |
| `BACKUP_PASSPHRASE`    | from step 5                                                                                                                     |
| `GDRIVE_CLIENT_ID`     | step 3                                                                                                                          |
| `GDRIVE_CLIENT_SECRET` | step 3                                                                                                                          |
| `GDRIVE_TOKEN`         | the full `{...}` JSON from step 4                                                                                               |
| `GDRIVE_FOLDER_ID`     | step 2                                                                                                                          |

## Step 8: Run it by hand

Actions tab > "Database backup" > Run workflow > main. Watch it, it takes about
two minutes.

If it fails on `citext` or `btree_gist`, enable that extension in the Supabase
dashboard under Database > Extensions, then rerun.

## Step 9: Prove the backup is actually restorable

This is the step people skip, and the only one that proves anything. The gpg
round trip has never been tested.

```bash
rclone copy gdrive: ./backup-test --include "mimos-*.dump.gpg" && ls -lh ./backup-test
```

```bash
gpg --decrypt --batch --passphrase 'YOUR_PASSPHRASE' ./backup-test/mimos-*.dump.gpg > /tmp/test.dump && pg_restore --list /tmp/test.dump | grep -c "TABLE DATA"
```

Expect **28**. Anything under 20 would already have failed the workflow's own
check, so a low number here means the encryption step mangled the archive.

Clean up afterwards. The decrypted dump is real client PII: names, phone
numbers, payment history.

```bash
rm -rf ./backup-test /tmp/test.dump
```

## Step 10: Confirm tomorrow

The cron is 22:00 UTC daily. Check the Actions tab the next day to confirm the
**scheduled** run fired, not just your manual one.

## Ongoing

- The workflow keeps 30 days of backups and prunes anything older.
- GitHub disables scheduled workflows on repos with no activity for 60 days. If
  this repo goes quiet for a couple of months, check the workflow is still enabled.
- `BACKUP_PASSPHRASE` must live in a password manager, not only in GitHub.
