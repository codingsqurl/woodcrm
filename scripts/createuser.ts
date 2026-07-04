// createuser — seed the single operator account. No public signup, ever.
//   npm run createuser <email> "<full name>" <password>
import './load-env'
import { createUser } from '../lib/auth'

const [email, name, password] = process.argv.slice(2)

if (process.argv.slice(2).length !== 3) {
  console.error('usage: npm run createuser <email> "<full name>" <password>')
  process.exit(1)
}
if (password.length < 12) {
  console.error('password must be at least 12 characters — it guards your whole pipeline')
  process.exit(1)
}

try {
  const u = createUser(email, name, password)
  console.log(`created ${u.email} (id=${u.id})`)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('UNIQUE')) {
    console.error(`an account with email ${email} already exists`)
    process.exit(1)
  }
  throw err
}
