/**
 * These functions make gatsby file assets from the folders in sites.
 */
import del from 'del';
import execa from 'execa';
import jsYaml from 'js-yaml';
import _ from 'lodash';
import makeDir from 'make-dir';
import fs from 'mz/fs';
import path from 'path';
import readdir from 'recursive-readdir';

interface Config {
  extends?: string[];
  [key: string]: any;
}

// relative to cwd
const GATSBY_BIN = "node_modules/gatsby/dist/bin/gatsby.js";

/** API */

/**
 * Create a site folder and config yaml file by name if it doesn't already exist.
 *
 * This is used by create.ts command line tool
 *
 * Saves to sites/
 *
 * @param site
 * @param config
 */
export async function createSite(
  site: string,
  config: Config
): Promise<string> {
  let sd = siteDir(site);
  await makeDir(sd);
  let filename = path.join(sd, `${site}.yaml`);
  let exists = await fs.exists(filename);
  if (!exists) {
    let body = jsYaml.safeDump(config);
    await fs.writeFile(filename, body);
  }
  return filename;
}

/**
 * From configuration files in sites, generate gatsby config and source
 * for a website, saving them in `made/`
 *
 * @param site Name of site folder in sites/
 */
export async function makeSite(site: string) {
  let config = await loadExtendConfig(site);
  await makeBuild(site, config);
  return config;
}

export async function updateSite(site: string) {
  let config = await loadExtendConfig(site);
  await makeMadeFiles(site, config);
  return config;
}

/**
 * Make all sites
 */
export async function makeAll() {
  let sites = await listSites();
  return Promise.all(sites.map(makeSite));
}

/**
 * Delete all files in `made/${site}`
 *
 * @param site
 */
export async function cleanSite(site: string) {
  let sm = siteMadeDir(site);
  return emptyDir(sm);
}

async function emptyDir(dir: string) {
  return del([`${dir}/**`, `!${dir}`]);
}

/**
 * Having 'made' a site, activate it for gatsby develop / build
 * by linking gatsby-config and src folders into the project root.
 *
 * @param site
 */
export async function activateSite(site: string) {
  let sm = siteMadeDir(site);

  if (!(await fs.exists(sm))) {
    throw Error(`Site is not yet made: ${site} dir: ${sm}`);
  }
  let r = root();

  // maybe just copy them
  async function link(filename: string, type: string) {
    let target = path.join(sm, filename);
    let p = path.join(r, filename);

    // TODO: check if exists and does not point to target
    // only then unlink
    try {
      await fs.unlink(p);
    } catch (e) {
      console.warn(e);
    }
    await fs.symlink(target, p, type);
  }

  await link("gatsby-config.js", "file");
  await link("src", "dir");
}

/**
 * Names of all sites in `./sites`
 */
export async function listSites(): Promise<string[]> {
  let sites = await fs.readdir(path.join(root(), "sites"));
  return sites.filter((s: string) => !s.startsWith("."));
}

/**
 * Build one site
 *
 * Returns the execa Promise:
 *  result.stdout
 *  error
 *    message
 *    stdout
 *    stderr
 *
 * @param site
 * @param echo Echo stdout/stderr
 */
export async function buildSite(site: string, echo = true) {
  await makeSite(site);
  await activateSite(site);
  await emptyDir(joinPath(["public"]));
  return callGatsby(["build"], echo);
}

/**
 * Build all, but not very informative on errors or progress.
 */
export async function buildAll() {
  let sites = await listSites();
  for (let site of sites) {
    await buildSite(site, false).catch(console.error);
  }
}

/** INTERNAL */
/**
 * Load config yaml file, extending it with values from the configs of mixins specified in `.extends`
 *
 * Merges all top level objects. ie. If your config only supplies {contact: {email: 'xyz'}}
 * then the parent's values for contact will all be included, only email will be set.
 *
 * @param site
 */
async function loadExtendConfig(site: string): Promise<Config> {
  let parents = await mixinChain(site);
  let configs = await Promise.all(parents.map(s => loadConfig(s)));
  let customizer = (objValue: any, srcValue: any) => {
    if (_.isPlainObject(objValue)) {
      return _.merge({}, objValue, srcValue);
    }
  };
  configs.push(customizer);
  // merge each top level key
  return _.mergeWith({}, ...configs);
}

/**
 * Load a config yaml file
 *
 * @param site
 */
async function loadConfig(site: string) {
  let configPath = await sitePath(site);
  let content = await fs.readFile(configPath, "utf8");
  let config = jsYaml.safeLoad(content) as Config;

  return nullsToBlanks(config);
}

function nullsToBlanks(obj: Config): Config {
  return _.mapValues(obj, v => {
    if (_.isPlainObject(v)) {
      return nullsToBlanks(v);
    } else if (_.isArray(v)) {
      return v;
    } else {
      return _.isEmpty(v) ? "" : v;
    }
  });
}

/**
 * Write yaml file to disk
 *
 * @param config
 * @param filename
 */
async function writeConfig(config: Config, filename: string) {
  let content = jsYaml.safeDump(config);
  await fs.writeFile(filename, content);
}

/**
 * Find the yaml config file for a site:
 *  either sites/{site}/{site}.yaml or sites/{site}.yaml
 *
 * @param site
 */
async function sitePath(site: string) {
  let sd = siteDir(site);
  let d = path.join(sd, `${site}.yaml`);
  let f = sd + ".yaml";

  if (await fs.exists(d)) return d;
  if (await fs.exists(f)) return f;

  throw Error(`Site config not found: ${site}`);
}

/**
 * Returns paths joined, relative to root
 *
 * @param paths
 */
function joinPath(paths: string[]): string {
  return path.join(root(), ...paths);
}

/**
 * Project root
 */
function root() {
  return process.cwd();
}

/**
 * Directory where a site's yaml config and custom source
 * files are stored.
 *
 * @param site
 */
export function siteDir(site: string) {
  return joinPath(["sites", site]);
}

/**
 * Path of the made directory for a site: `made/{site}/`
 *
 * @param site
 */
function siteMadeDir(site: string) {
  return joinPath(["made", site]);
}

/**
 * Initialize directories and make all gatsby artifacts for a site, writing them to `made/{site}/`
 *
 * @param site
 * @param config
 */
async function makeBuild(site: string, config: Config) {
  let sm = siteMadeDir(site);
  let src = path.join(sm, "src");

  await makeDir(sm);
  await cleanSite(site);
  await Promise.all(
    ["pages", "components", "layouts", "data", "utils"].map(p =>
      makeDir(path.join(src, p))
    )
  );
  await makeMadeFiles(site, config);
}

/**
 * Make all gatsby artifacts for a site, writing them to `made/{site}/`
 *
 * @param site
 * @param config
 */
export async function makeMadeFiles(site: string, config: Config) {
  let sm = siteMadeDir(site);
  let src = path.join(sm, "src");
  // TODO: only need to copy those that are newer than 'modified'
  // or if contents changed.
  await writeGatsbyConfig(config, path.join(sm, "gatsby-config.js"));
  await copySrcFiles(site, src);
  await writeSiteData(config, path.join(src, "data", "site.json"));
  await writeConfig(config, path.join(sm, "config.yaml"));
  await customizeComponents(config, src);
}

interface MergedSourceFiles {
  [key: string]: string;
}

interface Dirs {
  [key: string]: boolean;
}

/**
 * Copy source files for the site and for any parent that this
 * site .extends from
 *
 * @param site
 * @param dest
 */
async function copySrcFiles(site: string, dest: string) {
  let sourceFiles: MergedSourceFiles = {};
  let parents = await mixinChain(site);
  for (let p of parents) {
    let parentSrc = siteDir(p);
    let files = await readdir(parentSrc);
    for (let f of files) {
      sourceFiles[path.relative(parentSrc, f)] = f;
    }
  }
  let dirs: Dirs = {};

  for (let relative in sourceFiles) {
    let full = sourceFiles[relative];
    // create directory if needed
    let target = path.join(dest, relative);
    let dir = path.dirname(target);
    if (!dirs[dir]) {
      let exists = await fs.exists(dir);
      if (!exists) {
        await fs.mkdir(dir);
        dirs[dir] = true;
      }
    }
    fs.copyFileSync(full, target);
  }
}

/**
 * Customize components in layout/index.js by replacing with mappings in config._LAYOUT
 *
 * where _LAYOUT transforms can be:
 *
 *   Header: CustomHeader.js
 *   Footer: CustomFooter.js
 *   Content: CustomContent.js
 *   Menu: MyMenu.js
 *
 */
async function customizeComponents(config: Config, src: string) {
  if (config._LAYOUT) {
    let layoutPath = path.join(src, "layouts", "index.js");
    let content = await fs.readFile(layoutPath, "utf8");
    for (let key in config._LAYOUT) {
      let target = config._LAYOUT[key];
      let re = new RegExp(`^import ${key} from ['"](.+)['"]`, "m");
      content = content.replace(
        re,
        `import ${key} from "../components/${target}";`
      );
    }
    await fs.writeFile(layoutPath, content);
  }
}

async function writeGatsbyConfig(config: Config, filename: string) {
  let json = JSON.stringify(gatsbyConfig(config), undefined, 2);
  // Replace NODE_MODULES placeholder with runtime javascript expression
  // ? + require("path").resolve(__dirname, "src"),
  json = json.replace(
    '"__NODE_MODULES__"',
    `[require("path").resolve(__dirname, "node_modules")]`
  );
  let body = `module.exports = ${json};\n`;
  return fs.writeFile(filename, body);
}

/**
 * Generate gatsby-config from yaml config
 *
 * @param config
 */
function gatsbyConfig(config: Config) {
  return {
    siteMetadata: {
      title: config.title || config.name,
      siteUrl: config.domain
    },
    plugins: [
      "gatsby-plugin-react-helmet",
      "gatsby-plugin-catch-links",
      `gatsby-transformer-json`,
      "gatsby-plugin-sharp",
      {
        resolve: `gatsby-plugin-typography`,
        options: {
          pathToConfigModule: `src/utils/typography.js`
        }
      },
      {
        resolve: `gatsby-source-filesystem`,
        options: {
          path: `./src/data`,
          name: "data"
        }
      },
      {
        resolve: `gatsby-source-filesystem`,
        options: {
          path: `./src/pages`,
          name: "pages"
        }
      },
      {
        resolve: "gatsby-transformer-remark",
        options: {
          plugins: [
            "gatsby-remark-copy-images",
            "gatsby-remark-autolink-headers",
            "gatsby-remark-external-links",

            {
              resolve: `gatsby-remark-images`,
              options: {
                // It's important to specify the maxWidth (in pixels) of
                // the content container as this plugin uses this as the
                // base for generating different widths of each image.
                maxWidth: 800
              }
            },
            {
              resolve: "gatsby-remark-embed-video",
              options: {
                width: 800,
                ratio: 1.77, // Optional: Defaults to 16/9 = 1.77
                height: 400, // Optional: Overrides optional.ratio
                related: true, //Optional: Will remove related videos from the end of an embedded YouTube video.
                noIframeBorder: true //Optional: Disable insertion of <style> border: 0
              }
            },
            {
              resolve: `gatsby-remark-prismjs`,
              options: {
                // Class prefix for <pre> tags containing syntax highlighting;
                // defaults to 'language-' (eg <pre class="language-js">).
                // If your site loads Prism into the browser at runtime,
                // (eg for use with libraries like react-live),
                // you may use this to prevent Prism from re-processing syntax.
                // This is an uncommon use-case though;
                // If you're unsure, it's best to use the default value.
                classPrefix: "language-",
                // This is used to allow setting a language for inline code
                // (i.e. single backticks) by creating a separator.
                // This separator is a string and will do no white-space
                // stripping.
                // A suggested value for English speakers is the non-ascii
                // character '›'.
                inlineCodeMarker: null,
                // This lets you set up language aliases.  For example,
                // setting this to '{ sh: "bash" }' will let you use
                // the language "sh" which will highlight using the
                // bash highlighter.
                aliases: {}
              }
            }
            // "gatsby-remark-responsive-iframe"
          ] // just in case those previously mentioned remark plugins sound cool :)
        }
      },
      {
        resolve: `gatsby-plugin-sass`,
        options: {
          // placeholder
          includePaths: "__NODE_MODULES__"
        }
      },
      "gatsby-plugin-antd"
      // {
      //   resolve: `gatsby-source-filesystem`,
      //   options: {
      //     name: `docs`,
      //     path: `${__dirname}/../docs/`,
      //   },
      // },
    ]
    // pathPrefix: `/blog`,
  };
}

/**
 * Save all site data as site.json to be loaded by Gatsby
 *
 * @param config
 * @param filename
 */
async function writeSiteData(config: Config, filename: string) {
  let json = JSON.stringify(config, undefined, 2);
  return fs.writeFile(filename, json);
}

/**
 * Returns the list of mixin sites for this site from `default` down to and including `site`
 *
 */
async function mixinChain(site: string): Promise<string[]> {
  let config = await loadConfig(site);
  if (config.extends) {
    let parents = await Promise.all(config.extends.map(e => mixinChain(e)));
    let flat = _.flattenDeep(parents);
    flat.push(site);
    return _.uniq(flat);
  }
  return [site];
}

/**
 * Call gatsby, returning Promise for the command result
 *
 * @param command - Array of args to gatsby
 * @param echo    - Echo stdout/stderr
 */
export async function callGatsby(command: string[], echo = true) {
  let job = execa(GATSBY_BIN, command);
  if (echo) {
    job.stdout.pipe(process.stdout);
    job.stderr.pipe(process.stderr);
  }
  return job;
}

// checkProject
// that there is sites, package.json, src

// buildSite

// serveSite
