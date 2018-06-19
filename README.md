multigat
========

Build gatsby sites en masse

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/multigat.svg)](https://npmjs.org/package/multigat)
[![CircleCI](https://circleci.com/gh/crucialfelix/multigat/tree/master.svg?style=shield)](https://circleci.com/gh/crucialfelix/multigat/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/crucialfelix/multigat?branch=master&svg=true)](https://ci.appveyor.com/project/crucialfelix/multigat/branch/master)
[![Codecov](https://codecov.io/gh/crucialfelix/multigat/branch/master/graph/badge.svg)](https://codecov.io/gh/crucialfelix/multigat)
[![Downloads/week](https://img.shields.io/npm/dw/multigat.svg)](https://npmjs.org/package/multigat)
[![License](https://img.shields.io/npm/l/multigat.svg)](https://github.com/crucialfelix/multigat/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g multigat
$ multigat COMMAND
running command...
$ multigat (-v|--version|version)
multigat/0.0.0 darwin-x64 node-v10.1.0
$ multigat --help [COMMAND]
USAGE
  $ multigat COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`multigat hello [FILE]`](#multigat-hello-file)
* [`multigat help [COMMAND]`](#multigat-help-command)

## `multigat hello [FILE]`

describe the command here

```
USAGE
  $ multigat hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ multigat hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/crucialfelix/multigat/blob/v0.0.0/src/commands/hello.ts)_

## `multigat help [COMMAND]`

display help for multigat

```
USAGE
  $ multigat help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.0.5/src/commands/help.ts)_
<!-- commandsstop -->
