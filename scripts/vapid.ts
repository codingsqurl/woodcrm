// vapid.ts — mint a VAPID key pair (raw P-256, base64url; the standard Web
// Push format). Run once, paste into .env.local / fly secrets, never rotate
// casually: rotating invalidates every existing subscription.
//   npm run vapid
import { createECDH } from 'node:crypto'

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()

console.log('# Add to .env.local (and fly secrets set ... for prod):')
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`)
console.log(`VAPID_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`)
