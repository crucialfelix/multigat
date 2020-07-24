multigat
========

Build gatsby sites en masse.

This is a command line tool for working in one directory with a sub-folder containing many sites.

The tool switches between sites.  This enables you to keep one development environment with one gatsby / node_modules and work on many sites.


Symlinks these from sites/{current} to the project root:

-   plugins
-   public
-   src
-   gatsby-config.js
-   gatsby-node.js
-   config.yaml

Missing items are symlinked from `{project-root}/default-site`

You end up with a directory structure like this:

    .
    ├── default-site
    │   ├── plugins
    │   │   └── gatsby-multigat-config
    │   └── src
    │       ├── components
    │       ├── data
    │       ├── pages
    │       └── utils
    ├── dist
    │   ├── artkamp
    │   │   └── public
    │   ├── crucial-systems
    │   │   └── public
    │   │       └── static
    │   ├── default
    │   │   └── public
    │   └── mattermind
    │       └── public
    ├── plugins -> /Users/crucialfelix/code/matterminds/sites/crucial-systems/plugins
    ├── public -> /Users/crucialfelix/code/matterminds/dist/crucial-systems/public
    ├── sites
    │   ├── ai-shirt
    │   ├── artkamp
    │   │   └── src
    │   │       └── data
    │   ├── at-vertise
    │   ├── blogging
    │   │   └── src
    │   │       ├── components
    │   │       ├── pages
    │   │       └── templates
    └── src -> /Users/crucialfelix/code/matterminds/sites/crucial-systems/src


## USAGE
  `$ multigat [COMMAND]`

## COMMANDS

```
  activate  Activate a site, copying it's `gatsby-config` and generated asset files into `./src`
  build     Build one or all sites
  clean     Clean any previously created assets from made/{site}
  create    Create website yamls by passing in site name
  help      display help for multigat
  list      List sites
  start     Start a site in development mode
```
<!--
[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/multigat.svg)](https://npmjs.org/package/multigat)
[![CircleCI](https://circleci.com/gh/crucialfelix/multigat/tree/master.svg?style=shield)](https://circleci.com/gh/crucialfelix/multigat/tree/master)
[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/crucialfelix/multigat?branch=master&svg=true)](https://ci.appveyor.com/project/crucialfelix/multigat/branch/master)
[![Codecov](https://codecov.io/gh/crucialfelix/multigat/branch/master/graph/badge.svg)](https://codecov.io/gh/crucialfelix/multigat)
[![Downloads/week](https://img.shields.io/npm/dw/multigat.svg)](https://npmjs.org/package/multigat)
[![License](https://img.shields.io/npm/l/multigat.svg)](https://github.com/crucialfelix/multigat/blob/master/package.json) -->

## install

```sh-session
$ npm install -g multigat
$ multigat COMMAND
running command...
$ multigat (-v|--version|version)
multigat/0.0.0 darwin-x64 node-v10.1.0
$ multigat --help [COMMAND]

```

