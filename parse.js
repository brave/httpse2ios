#!/usr/bin/env node

const fs = require('fs')
const directory = './rules'

async function getFileNames(directory) {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, filenames) => {
      if (err) { reject(err) }
      resolve(filenames)
    })
  })
}

async function read(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, "ascii", (err, data) => {
      if (err) { reject(err) }
      resolve(data)
    })
  })
}

async function parseXMLfile(rawFileData) {
  return new Promise((resolve, reject) => {
    require('xml2js').parseString(rawFileData, function (parseError, fileContents) {
      if (parseError) { reject(parseError) }
      resolve(fileContents)
    })
  })
}

async function getHosts(xmlData) {
  let ruleset = xmlData.ruleset
  let rules = ruleset.rule

  if (rules.length > 1) {
    return []
  }

  let hosts = []
  rules.forEach(rule => {
    let from = rule.$.from
    let to = rule.$.to

    if (from == "^http:" && to == "https:") {
      
      // Rule is simple, store all targets

      ruleset.target.forEach(target => {
        let host = target.$.host
        hosts.push(host)
      })
    }
  })
  return hosts
}

async function run() {
  let hosts = []
  let files = await getFileNames(directory)
  for (file of files) {
    let path = directory + "/" + file
    let fileData = await read(path)
    let parsedXML = await parseXMLfile(fileData)
    let fileHosts = await getHosts(parsedXML)
    // console.log(fileHosts)
    hosts = hosts.concat(fileHosts)
  }
  console.log(hosts)
}

run()
