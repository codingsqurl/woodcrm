// createuser — seed the single operator account. No public signup, ever.
//   npm run createuser <email> "<full name>"
// Sign-in itself is Google OAuth: the row only needs to exist for the email
// to be let in. (Alternative: list the email in GOOGLE_ALLOWED_EMAILS and the
// callback auto-provisions this row on first sign-in.)
import './load-env'
import { createUser } from '../lib/auth'

const [email, name] = process.argv.slice(2)

if (process.argv.slice(2).length !== 2) {
  console.error('usage: npm run createuser <email> "<full name>"')
  process.exit(1)
}

try {
  const u = createUser(email, name)
  console.log(`created ${u.email} (id=${u.id})`)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('UNIQUE')) {
    console.error(`an account with email ${email} already exists`)
    process.exit(1)
  }
  throw err
}
