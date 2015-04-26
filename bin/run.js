#!/usr/bin/env node
var args = process.argv.slice(2)

if (!args.length) {
  console.error(usage())
  process.exit(1)
}


// defaults
var nodeArgs = []

var timeout = process.env.TAP_TIMEOUT || 120
var color = require('supports-color')
var reporter
var files = []

for (var i = 0; i < args.length; i++) {
  var arg = args[i]
  if (arg.charAt(0) !== '-') {
    files.push(arg)
    continue
  }

  // support -Rspec as well as --reporter=spec
  arg = arg.replace(/^-R/, '--reporter=')

  var key = arg
  var val
  if (key.match(/^--/) && arg.indexOf('=') !== -1) {
    var kv = arg.split('=')
    key = kv.shift()
    val = kv.join('=')
  }

  switch (key) {
    case '-h': case '--help': case '-?':
      return console.log(usage())

    case '-v': case '--version':
      return console.log(require('../package.json').version)

    case '--reporter':
      val = val || args[++i]
      reporter = val
      continue

    case '--gc': case '-gc': case '--expose-gc':
      nodeArgs.push('--expose-gc')
      continue

    case '--strict':
      nodeArgs.push('--strict')
      continue

    case '--debug':
      nodeArgs.push('--debug')
      continue

    case '--debug-brk':
      nodeArgs.push('--debug-brk')
      continue

    case '--harmony':
      nodeArgs.push('--harmony')
      continue

    case '-c': case '--color':
      color = true
      continue

    case '-C': case '--no-color':
      color = false
      continue

    case '-t': case '--timeout':
      val = val || args[++i]
      timeout = +val
      continue

    case '--':
      files = files.concat(args.slice(i + 1))
      i = args.length
      continue

    default:
      throw new Error('Unknown argument: ' + arg)
  }
}

// default to tap for non-tty envs
if (!reporter)
  reporter = color ? 'classic' : 'tap'


function usage () {
  return function () {/*
Usage:
  tap [options] <files>

Executes all the files and interprets their output as TAP
formatted test result data.

Options:

  -c --color                  Force use of colors

  -C --no-color               Force no use of colors

  -R<type> --reporter=<type>  Use the specified reporter.  Defaults to
                              'classic' when colors are in use, or 'tap'
                              when printing to a non-fancy TTY.

  -gc --expose-gc             Expose the gc() function to Node tests

  --debug                     Run JavaScript tests with node --debug

  --debug-brk                 Run JavaScript tests with node --debug-brk

  --harmony                   Enable all Harmony flags in JavaScript tests

  --strict                    Run JS tests in 'use strict' mode

  -t<n> --timeout=<n>         Time out tests after this many seconds.
                              Defaults to 120, or the value of the
                              TAP_TIMEOUT environment variable.

  -h --help                   print this thing you're looking at

  -v --version                show the version of this program
*/}.toString().split('\n').slice(1, -1).join('\n')
}

var isExe
if (process.platform == "win32") {
  // On windows, there is no good way to check that a file is executable
  isExe = function isExe () { return true }
} else {
  isExe = function isExe (stat) {
    var mod = stat.mode
    var uid = stat.uid
    var gid = stat.gid
    var u = parseInt('100', 8)
    var g = parseInt('010', 8)
    var o = parseInt('001', 8)
    var ug = u | g

    var ret = (mod & o)
        || (mod & g) && process.getgid && gid === process.getgid()
        || (mod & u) && process.getuid && uid === process.getuid()
        || (mod & ug) && process.getuid && 0 === process.getuid()

    return ret
  }
}

var tap = require('../lib/root.js')
var fs = require('fs')
process.env.TAP_TIMEOUT = timeout

if (reporter !== 'tap') {
  var TSR = require('tap-mocha-reporter')
  tap.unpipe(process.stdout)
  reporter = new TSR(reporter)
  tap.pipe(reporter)
}

for (var i = 0; i < files.length; i++) {
  var file = files[i]
  var st = fs.statSync(files[i])

  if (file.match(/\.js$/))
    tap.spawn(process.execPath, nodeArgs.concat(file))
  else if (st.isDirectory()) {
    files.push.apply(files, fs.readdirSync(file).map(function (f) {
      return file + '/' + f
    }))
  }
  else if (isExe(st))
    tap.spawn(files[i], [])
}