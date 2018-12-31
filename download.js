#!/usr/bin/env node

const fs = require('fs')
const exec = require('child_process').exec;

module.exports = {

  download: async function(directory) {

    return new Promise((resolve, reject) => {

      // Make directory for files
      try {
        fs.mkdirSync(directory)
      } catch (err) { /* ignore */ }

      // Download and relocate downloaded files into directory
      const cmd = `curl -L https://github.com/EFForg/https-everywhere/archive/master.tar.gz | tar -xzf- --strip-components=5 --directory ${directory} https-everywhere-master/src/chrome/content/rules/`
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          reject(error)
          return
        }
        console.log(`${stdout} -- ${stderr}`)
        console.log(`Files downloaded into ${directory}`)
        resolve()
      })
    })
  },

  cleanup: function(directory) {
    exec(`rm -rf ${directory}`)
    console.log(`${directory} deleted`)
  }
}