const { KEYGEN_ACCOUNT_ID } = process.env

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

  return `cache/${hash}.json`
}

function getCachedValidationResponse(key) {
  const path = getCurrentCacheLocation(key)
  if (fs.existsSync(path)) {
    const res = fs.readFileSync(path)
    console.log(
      chalk.gray(`Cache hit: ${key} (${path})`)
    )

    try {
      return JSON.parse(res)
    } catch (e) {
      console.error(
        chalk.red(`Cache err: ${e} (${key})`)
      )

      fs.unlinkSync(path)
    }
  }

  return null
}

function setCachedValidationResponse(key, res) {
  const path = getCurrentCacheLocation(key)
  console.log(
    chalk.gray(`Cache set: ${key} (${path})`)
  )

  return fs.writeFileSync(path, JSON.stringify(res))
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

  return res.json()
}

async function validateLicenseKey(key) {
  const cache = await getCachedValidationResponse(key)
  if (cache) {
    return cache
  }

  const {
    meta: validation,
    data: license,
    errors
  } = await getValidationResponse(key)
  if (errors) {
    const msgs = errors.map(e => `${e.title}: ${e.detail}`)
    console.error(
      chalk.red(`Request err: ${msgs}`)
    )

    process.exit(1)
  }

  if (validation.valid) {
    setCachedValidationResponse(key, { validation, license })
  }

  return {
    validation,
    license
  }
}

async function main() {
  const key = await getLicenseKeyFromUser()
  const { validation, license } = await validateLicenseKey(key)

  if (validation.valid) {
    console.log(
      chalk.green(`License ${license.id} is valid!`)
    )
  } else {
    console.log(
      chalk.red(`License is not valid (${validation.detail})`)
    )
  }
}

main()