const {
  KEYGEN_VERIFY_KEY,
  KEYGEN_ACCOUNT_ID
} = process.env

const fetch = require('node-fetch')
const readline = require('readline')
const chalk = require('chalk')
const crypto = require('crypto')
const fs = require('fs/promises')

const rl = readline.createInterface(
  process.stdin,
  process.stdout
)

// Promp the user for their license key. Returns a license key string.
async function getLicenseKeyFromUser() {
  return new Promise(resolve =>
    rl.question(chalk.yellow('Enter your license key: '), a => resolve(a))
  )
}

// There is likely a third-party module for this, but we want to show
// how to parse the signature header without one. Returns an object.
function parseParameterizedHeader(header) {
  if (header == null) {
    return null
  }

  const params = header.split(/,\s*/g)
  const keyvalues = params.map(param => {
    const [, key, value] = param.match(/([^=]+)="([^"]+)"/i)

    return [key, value]
  })

  return keyvalues.reduce(
    (o, [k, v]) => (o[k] = v, o),
    {}
  )
}

// Verify the signature of a response. Returns void. Throws if invalid.
// See: https://keygen.sh/docs/api/#response-signatures
async function verifyResponseSignature({ target, digest, date, signature }) {
  if (signature == null) {
    throw new Error('Signature was expected but is missing')
  }

  // Rebuild the signing data
  const data = [
    `(request-target): ${target}`,
    `host: api.keygen.sh`,
    `date: ${date}`,
    `digest: ${digest}`,
  ].join('\n')

  // Decode DER verify key
  const verifyKey = crypto.createPublicKey({
    key: Buffer.from(KEYGEN_VERIFY_KEY, 'base64'),
    format: 'der',
    type: 'spki',
  })

  // Convert into bytes
  const signatureBytes = Buffer.from(signature, 'base64')
  const dataBytes = Buffer.from(data)

  // Cryptographically verify data against the signature
  const ok = crypto.verify(null, dataBytes, verifyKey, signatureBytes)
  if (!ok) {
    throw new Error(`Signature does not match: ${signature}`)
  }
}

// Create a cache location based on the current timestamp down to the day,
// so there will be a new location for each day. You may want to periodically
// clean up old cache locations so this doesn't get out of hand. Returns a
// cache location.
function getCurrentCacheLocation(key) {
  const dt = new Date().toDateString()
  const hash = crypto.createHash('sha1')
                    .update(`${dt}:${key}`)
                    .digest('hex')

  return `cache/${hash}`
}

// Get a cached validation response. Returns the cache contents.
async function getCachedValidationResponse(key) {
  const path = getCurrentCacheLocation(key)

  try {
    const contents = await fs.readFile(path)
    const data = JSON.parse(contents.toString())

    console.log(
      chalk.gray(`Cache hit: ${key} (${path})`)
    )

    return data
  } catch (e) {
    // Cache location doesn't exist -- this is fine.
    if (e.code === 'ENOENT') {
      console.log(
        chalk.gray(`Cache miss: ${key} (${path})`)
      )

      return null
    }

    console.error(
      chalk.red(`Cache err: ${e} (${key})`)
    )

    await fs.unlink(path)
  }
}

// Sets the validation response cache. Returns void.
async function setCachedValidationResponse(key, { target, date, signature, body }) {
  const path = getCurrentCacheLocation(key)
  const contents = JSON.stringify({
    target,
    date,
    signature,
    body,
  })

  console.log(
    chalk.gray(`Cache set: ${key} (${path})`)
  )

  await fs.writeFile(path, contents)
}

// Performs a license key validation request. Returns a response.
async function performLicenseKeyValidation(key) {
  return fetch(`https://api.keygen.sh/v1/accounts/${KEYGEN_ACCOUNT_ID}/licenses/actions/validate-key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json'
    },
    body: JSON.stringify({
      meta: { key }
    })
  })
}

// Validates a license key, using the cache. Returns the validation result
// and license object.
async function validateLicenseKey(key) {
  const cache = await getCachedValidationResponse(key)
  if (cache != null) {
    const { target, date, signature, body } = cache

    // Rehash the cached data
    const sha256 = crypto.createHash('sha256').update(body)
    const digest = `sha-256=${sha256.digest('base64')}`

    // Verify the cached response
    await verifyResponseSignature({ target, digest, date, signature })

    return JSON.parse(body)
  }

  // Validate the license key
  const res = await performLicenseKeyValidation(key)

  // Get plaintext response body for signature verification
  const body = await res.text()

  // Parse the response body
  const { meta, data, errors } = JSON.parse(body)
  if (errors) {
    const msgs = errors.map(e => `${e.title}=${e.detail}`)

    throw new Error(`API Error: ${msgs}`)
  }

  // Check if license is valid (and cache the response if it is)
  if (meta.valid) {
    const { signature } = parseParameterizedHeader(res.headers.get('keygen-signature'))
    const target = `post /v1/accounts/${KEYGEN_ACCOUNT_ID}/licenses/actions/validate-key`
    const sha256 = crypto.createHash('sha256').update(body)
    const digest = `sha-256=${sha256.digest('base64')}`
    const date = res.headers.get('date')

    // Verify the response
    await verifyResponseSignature({ target, digest, date, signature })

    // Cache the response
    await setCachedValidationResponse(key, { target, date, signature, body })
  }

  return { meta, data }
}

// Runs the main program. Exits with a non-zero code on failure.
async function main() {
  try {
    const key = await getLicenseKeyFromUser()
    const { meta, data } = await validateLicenseKey(key)

    if (meta.valid) {
      console.log(
        chalk.green(`License ${data.id} is valid!`)
      )
    } else {
      console.log(
        chalk.yellow(`License is not valid (${meta.detail})`)
      )
    }

    process.exit(0)
  } catch (e) {
    console.log(
      chalk.red(`Fatal: ${e.message}`)
    )

    process.exit(1)
  }
}

main()
