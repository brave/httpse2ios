#!/usr/bin/env node

/**
 * 
 * Potential improvements:
 * 
 * - 
 * solve predefined wildcards
 * `http://url.com/(one|two) -> https://url.com/$1`
 * This can be split into two rules, and handled since the results are known
 * (file exp: 4gamer.net.xml)
 * 
 * -
 * URL wildcard prefixes
 * `*.32red.com  -> /^http:\/\/(?:www\.)?32red\.com\//`
 * 
 * 
 */

const fs = require('fs')
const url = require('url')
const directory = './rules'

async function getFileNames(directory) {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, filenames) => {
      if (err) { reject(err) }
      resolve(filenames.filter(name => {return name.endsWith('.xml')}))
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

async function getHosts(xmlData) {
  let ruleset = xmlData.ruleset

  if (defaultOff(ruleset) || includesExclusion(ruleset)) {
    return []
  }

  let hosts = []

  let rulesFrom = []
  ruleset.rule.forEach(ruleEntry => {
    let from = RegExp(ruleEntry.$.from)
    rulesFrom.push(from)

    try {
      let ruleURL =  new URL(ruleEntry.$.to)

      // "downgrade" to make it hit the upgrade regex, this is not used in the actual ruleset, just to find what is needed
      ruleURL.protocol = 'http'
      let href = ruleURL.href

      if (RegExp(from).test(href) && !includesWildcards(href)) {
        // Just use the raw `host` for upgrade list
        hosts.push(ruleURL.host)
      }

    } catch(error) { /* Lots of URL parsing errors, this is okay */ }
  })

  return hosts.concat(simpleUpgrades(ruleset))
}

/**
 * Wildcards are part of HTTPSE spec to use URL replacement parameters
 * e.g.
 * ^http://([^/:@]+)?\.fema\.gov/ -> https://$1.fema.gov/
 * 
 * Here the paren rules on LHS are places inside the `$1` on the RHS
 * Multiple params can be used, but start at index `1`, so just checking for this should be thorough enough
 * 
 * @param {String} rule Generally an HTTPS Upgrade `rule`'s `to` attribute 
 */
function includesWildcards(rule) {
  return rule.includes("$1")
}

function simpleUpgrades(ruleset) {
  let rules = ruleset.rule.map(r => RegExp(r.$.from))

  // Update to `reduce`
  return ruleset.target.map(t => {
    let host = t.$.host
    let target = new URL(`http://${host}`)
    let allRuleHits = rules.filter(rule => rule.test(target))

    // This verifies that each target hits only one rule, and that it is a simple
    if (allRuleHits.length == 1 && allRuleHits[0] == '/^http:/') {
      return host
    }

    return null
  }).filter(t => t !== null)
}

function defaultOff(ruleset) {
  return ruleset.$.default_off != undefined
}

function includesExclusion(ruleset) {
  return ruleset.exclusion != undefined
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
