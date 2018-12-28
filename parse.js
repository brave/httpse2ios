#!/usr/bin/env node

const fs = require('fs')
const url = require('url')
const directory = './rules'
const basicRuleHTTP = '/^http:/'

/**
 * 
 * Returns all files names in a specific directory.
 * 
 * @param {String} directory 
 */
async function getFileNames(directory) {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, filenames) => {
      if (err) { reject(err) }
      resolve(filenames.filter(name => {return name.endsWith('.xml')}))
    })
  })
}

/**
 * 
 * Returns all URL `hosts` to include in the iOS content rules `if-domain` list.
 * 
 * @param {Ruleset} xmlData 
 */
async function getHosts(xmlData) {
  let ruleset = xmlData.ruleset

  if (defaultOff(ruleset) || includesExclusion(ruleset)) {
    return []
  }

  let hosts = []
  hosts = hosts.concat(ruleUpgrades(ruleset))
  hosts = hosts.concat(targetUpgrades(ruleset))
  return hosts
}

/**
 * 
 * This finds all rules that specify custom upgrade behavior (completely ignoring the `target` properties):
 * e.g. `http://one.url.com -> https://two.url.com`
 * Although many are not actionable with iOS HTTPSE upgrades, a good number of them are (~halfish)
 * 
 * Partly Doable:
 * `^http://(?:www\.)?url\.com/ -> https://www.url.com/`
 * 
 *    ignores:
 * `http://url.com -> https://www.url.com` is _not_ possible, but handling the same URL format is.
 *    uses:
 * `http://www.url.com -> https://www.url.com`
 * 
 * @param {Ruleset} ruleset An XML top level `ruleset` element
 */
function ruleUpgrades(ruleset) {
  let hosts = []
  ruleset.rule.forEach(ruleEntry => {
    let from = RegExp(ruleEntry.$.from)

    try {
      let ruleURL =  new URL(ruleEntry.$.to)

      // "downgrade" to make it hit the upgrade regex, this is not used in the actual ruleset, just to find what is needed
      ruleURL.protocol = 'http'
      let href = ruleURL.href

      if (RegExp(from).test(href) && !includesPlaceholders(href)) {
        // Just use the raw `host` for upgrade list
        hosts.push(ruleURL.host)
      }

    } catch(error) { /* Lots of URL parsing errors, this is okay */ }
  })
  return hosts
}

/**
 * 
 * Finds all usable `target` upgrades, matching against known `rule` properties to verify they are truly usable
 * on the iOS content format.
 * 
 * @param {Ruleset} ruleset An XML top level `ruleset` element
 */
function targetUpgrades(ruleset) {
  let rules = ruleset.rule.map(r => RegExp(r.$.from))

  // Update to `reduce`
  return ruleset.target.map(t => {
    let host = t.$.host
    let target = new URL(`http://${host}`)
    let allRuleHits = rules.filter(rule => rule.test(target))

    if (invalidWildcardHost(host, rules)) {
      return null
    }

    // This verifies that each target hits only one rule, and that it is a simple rule.
    // One rule hit is important for situations like:
    // `www.url.com`, where rule 1 is a simple http upgrade, and the other is a subdomain rewrite:
    // [ `http` -> `https` && `http://www.url.com` -> `https://url.com` ]
    // Since only the first can be represented with iOS rules, this entire target must be ignored.
    if (allRuleHits.length == 1 && allRuleHits[0] == '/^http:/') {
      return host
    }

    return null
  }).filter(t => t !== null)
}

/**
 * 
 * Checks to see if a host is a wildcard host (`*.url.com`), and verifies rule application is isolated to a single rule.
 * 
 * Certain situations arise that adds complexity to wildcard rules:
 * `Target.host`: `*.url.com`
 * 
 * `Rule.from.1`: `http://www.url.com` -> `https://url.com`
 * `Rule.from.2`: `http://` -> `https://`
 * 
 * `Target.host` above technically applies to both, although both are not representable.
 * For now, to avoid running into these situations, any ruleset with a wildcard target and multiple rules, excludes the target in question.
 * Improvements can theoretically be made, as discussed in `improvements.md`
 * 
 * @param {String} host Specific 
 * @param {Array<String>} rules 
 */
function invalidWildcardHost(host, rules) {
  let isWildcard = host.startsWith('*')
  let httpOnlyRules = rules.length == 1 && rules[0] == basicRuleHTTP
  return isWildcard && !httpOnlyRules
}

/**
 * Wildcards are part of HTTPSE spec to use URL replacement parameters.
 * e.g.
 * `^http://([^/:@]+)?\.fema\.gov/ -> https://$1.fema.gov/`
 * 
 * Here the paren rules on LHS are places inside the `$1` on the RHS
 * Multiple params can be used, but start at index `1`, so just checking for this should be thorough enough
 * 
 * @param {String} rule Generally an HTTPS Upgrade `rule`'s `to` attribute 
 */
function includesPlaceholders(rule) {
  return rule.includes("$1")
}

/**
 * 
 * Returns whether a specific `ruleset` is `off` by default.
 * 
 * @param {Ruleset} ruleset An XML top level `ruleset` element
 */
function defaultOff(ruleset) {
  return ruleset.$.default_off != undefined
}

/**
 * 
 * Returns whether a specific `ruleset` contains exclusions.
 * Exclusions are currently not handled, so any `ruleset` that has _any_ exceptions is currently ignored.
 * 
 * @param {Ruleset} ruleset An XML top level `ruleset` element
 */
function includesExclusion(ruleset) {
  return ruleset.exclusion != undefined
}

async function parseXMLfile(rawFileData) {
  return new Promise((resolve, reject) => {
    // Required with certain parsing errors
    // var rawFileData = rawFileData.toString().replace("\ufeff", "");
    require('xml2js').parseString(rawFileData, function (parseError, fileContents) {
      if (parseError) { reject(parseError) }
      resolve(fileContents)
    })
  })
}

async function read(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) { reject(err) }
      resolve(data)
    })
  })
}

function write(filePath, data) {
  fs.writeFile(filePath, data, (err) => {
    if (err) { reject(err) }
    console.log("File written to: " + filePath)
  })
}

async function run() {
  let hosts = []
  let files = await getFileNames(directory)
  for (file of files) {
    let path = directory + "/" + file
    let fileData = await read(path)
    let parsedXML = await parseXMLfile(fileData)
    let fileHosts = await getHosts(parsedXML)
    hosts = hosts.concat(fileHosts)
  }
  write('finalOutput.txt', hosts.sort().join("\n"))
}

run()
