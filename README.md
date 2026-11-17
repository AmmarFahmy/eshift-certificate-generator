# eshift-certificate-generator
Certificate generator for ESHIFT students

## Configuration

Set these environment variables locally in `.env.local` (see `.env.local.example`), and in your hosting provider for production:

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Password for the admin panel |
| `AUTH_SECRET` | 32+ random characters used to sign admin sessions. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for template uploads |

Admin login is refused until both `ADMIN_PASSWORD` and `AUTH_SECRET` are set.
