const {
  KEYGEN_PUBLIC_KEY,
  KEYGEN_ACCOUNT_ID
} = process.env

const fetch = require('node-fetch')
const readline = require('readline')
const chalk = require('chalk')
const crypto = require('crypto')
const fs = require('fs')

const rl = readline.createInterface(
  process.stdin,
  process.stdout
)

async function getLicenseKeyFromUser() {
  return new Promise(resolve =>
    rl.question(chalk.yellow('Enter your license key: '), a => resolve(a))
  )
}

// Create a cache location based on the current timestamp down to the day,
// so there will be a new location for each day. You may want to periodically
// clean up old cache locations so this doesn't get out of hand.
function getCurrentCacheLocation(key) {
  const now = Date.now()
  const secs = Math.floor(now / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  const hash = crypto.createHash('sha1')
                    .update(`${days}:${key}`)
                    .digest('hex')

  return `cache/${hash}`
}

function getCachedValidationResponse(key) {
  const path = getCurrentCacheLocation(key)
  if (fs.existsSync(path)) {
    const contents = fs.readFileSync(path)
    console.log(
      chalk.gray(`Cache hit: ${key} (${path})`)
    )

    try {
      const [sig, encRes] = contents.toString().split(':')
      const res = Buffer.from(encRes, 'base64').toString()

      return {
        res: JSON.parse(res),
        sig,
      }
    } catch (e) {
      console.error(
        chalk.red(`Cache err: ${e} (${key})`)
      )

      fs.unlinkSync(path)
    }
  }

  return null
}

function setCachedValidationResponse(key, sig, res) {
  const path = getCurrentCacheLocation(key)
  console.log(
    chalk.gray(`Cache set: ${key} (${path})`)
  )

  const encRes = Buffer.from(JSON.stringify(res)).toString('base64')
  const contents = `${sig}:${encRes}`

  return fs.writeFileSync(path, contents)
}

async function getValidationResponse(key) {
  const res = await fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/licenses/actions/validate-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json'
    },
    body: JSON.stringify({
      meta: { key }
    })
  })

  return res.json().then(body => ({
    sig: res.headers.get('X-Signature'),
    res: body,
  }))
}

async function validateLicenseKey(key) {
  const cache = await getCachedValidationResponse(key)
  if (cache) {
    return cache
  }

  const { res, sig } = await getValidationResponse(key)
  const { meta, errors } = res
  if (errors) {
    const msgs = errors.map(e => `${e.title}: ${e.detail}`)
    console.error(
      chalk.red(`Request err: ${msgs}`)
    )

    process.exit(1)
  }

  if (meta.valid) {
    setCachedValidationResponse(key, sig, res)
  }

  return { res, sig }
}

function verifyResponseSignature(res, sig) {
  try {
    const body = JSON.stringify(res)
    const verifier = crypto.createVerify('sha256')
    verifier.write(body)
    verifier.end()

    return verifier.verify(KEYGEN_PUBLIC_KEY, sig, 'base64')
  } catch (e) {
    return false
  }
}

async function main() {
  const key = await getLicenseKeyFromUser()
  const { res, sig } = await validateLicenseKey(key)
  const ok = verifyResponseSignature(res, sig)
  if (!ok) {
    console.error(
      chalk.red(`Signature verification failed! Cached data has been tampered with.`)
    )

    process.exit(1)
  }

  const { meta, data } = res

  if (meta.valid) {
    console.log(
      chalk.green(`License ${data.id} is valid!`)
    )
  } else {
    console.log(
      chalk.red(`License is not valid (${meta.detail})`)
    )
  }
}

main()