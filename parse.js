#!/usr/bin/env node


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

  let rules = ruleset.rule.map(r => RegExp(r.$.from))

  return ruleset.target.map(t => {
    let host = t.$.host
    let target = new URL(`http://${host}`)
    let allRuleHits = rules.filter(rule => rule.test(target))

    // This verifies that each target hits only one rule, and that it is a simple
    if (allRuleHits.length == 1 && allRuleHits[0] == "/^http:/") {
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
