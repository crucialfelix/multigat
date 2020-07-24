/**
 * These functions make gatsby file assets from the folders in sites.
 */
import del from "del";
import execa from "execa";
import { promises as fsp } from "fs";
import fsx, { mkdirp } from "fs-extra";
import jsYaml from "js-yaml";
import _ from "lodash";
import path from "path";
import readdir from "recursive-readdir";

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
  await fsx.ensureDir(sd);
  let filename = path.join(sd, `config.yaml`);
  let exists = await fsx.pathExists(filename);
  if (!exists) {
    let body = jsYaml.safeDump(config);
    await fsx.writeFile(filename, body);
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

// deprec
export async function updateSite(site: string) {
  let config = await loadExtendConfig(site);
  await makeMadeFiles(site, config);
  return config;
}

/**
 * Make all sites
 * deprec
 */
export async function makeAll() {
  let sites = await listSites();
  return Promise.all(sites.map(makeSite));
}

/**
 * Delete all files in `made/${site}`
 * deprec
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
 * Activate a site for gatsby develop / build by
 * linking the gatsby-config and src folders into the project root.
 *
 * If required folders or config files are missing from sites/{site} then it copies
 * them from default-site
 *
 * @param site
 */
export async function activateSite(site: string) {
  let r = root();

  let sm = path.join(r, "sites", site);
  let defaultSite = path.join(r, "default-site");

  if (!(await fsx.pathExists(sm))) {
    throw Error(`Site not found: ${site} dir: ${sm}`);
  }

  let config = await loadExtendConfig(site);
  await writeSiteData(config, path.join(sm, "src", "data", "config.json"));

  async function linkFromSite(filename: string) {
    // if it exists in source
    // else copy from default-site
    let source = path.join(sm, filename);
    if (!(await fsx.pathExists(source))) {
      source = path.join(defaultSite, filename);
    }
    let target = path.join(r, filename);
    let linked = await linksTo(source, target);

    if (!linked) {
      await maybeUnlink(target);
      await fsp.symlink(source, target);
    }
  }

  await linkFromSite("gatsby-config.js");
  await linkFromSite("gatsby-node.js");
  await linkFromSite("config.yaml");
  await linkFromSite("src");
  await linkFromSite("plugins");

  let dist = path.join(r, "dist", site);

  async function linkToDist(filename: string) {
    let source = path.join(dist, filename);
    let target = path.join(r, filename);
    let linked = await linksTo(source, target);

    if (!linked) {
      // create it if it doesn't exist
      await mkdirp(source);
      await maybeUnlink(target);
      await fsp.symlink(source, target);
    }
  }

  // await linkToDist(".cache");
  await linkToDist("public");
}

/**
 * Is target symlinked to source ?
 *
 * @param source
 * @param target
 */
async function linksTo(source: string, target: string): Promise<boolean> {
  if (!(await fsx.pathExists(target))) {
    return false;
  }
  let linkedTo = await fsp.readlink(target);
  return source === linkedTo;
}

async function maybeUnlink(target: string) {
  if (!(await fsx.pathExists(target))) {
    return;
  }
  let linkedTo = await fsp.readlink(target);
  if (linkedTo) {
    await fsp.unlink(target);
    return;
  }
}

/**
 * Names of all sites in `./sites`
 */
export async function listSites(): Promise<string[]> {
  let sites = await fsx.readdir(path.join(root(), "sites"));
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
 * Load a yaml config file
 */
async function loadConfig(site: string) {
  let configPath = await sitePath(site);
  let content = await fsx.readFile(configPath, "utf8");
  let config = jsYaml.safeLoad(content) as Config;

  return nullsToBlanks(config);
}

/**
 * Convert any null values in Config to empty strings: ''
 * so that Gatsby doesn't strip them out of the schema
 */
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
 */
async function writeConfig(config: Config, filename: string) {
  let content = jsYaml.safeDump(config);
  return writeFileIfChanged(filename, content);
}

/**
 * Find the yaml config file for a site:
 *  either sites/{site}/{site}.yaml or sites/{site}.yaml
 */
async function sitePath(site: string): Promise<string> {
  let sd = siteDir(site);
  let d = path.join(sd, `config.yaml`);

  if (await fsx.pathExists(d)) return d;

  throw Error(`Site config not found: ${site} at ${d}`);
}

/**
 * Returns paths joined, relative to root
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
 */
export function siteDir(site: string): string {
  return joinPath(["sites", site]);
}

/**
 * Path of the made directory for a site: `made/{site}/`
 */
function siteMadeDir(site: string): string {
  return joinPath(["made", site]);
}

/**
 * Initialize directories and make all gatsby artifacts for a site, writing them to `made/{site}/`
 *
 * deprec
 */
async function makeBuild(site: string, config: Config) {
  let sm = siteMadeDir(site);
  let src = path.join(sm, "src");

  await fsx.ensureDir(sm);
  await cleanSite(site);
  await makeMadeFiles(site, config);
}

/**
 * Make all gatsby artifacts for a site, writing them to `made/{site}/`
 *
 * deprec
 */
export async function makeMadeFiles(site: string, config: Config) {
  let sm = siteMadeDir(site);
  let src = path.join(sm, "src");

  await writeGatsbyConfig(config, path.join(sm, "gatsby-config.js"));
  await copySrcFiles(site, src);
  await writeSiteData(config, path.join(src, "data", "site.json"));
  await writeConfig(config, path.join(sm, "config.yaml"));
  await customizeComponents(config, src);
}

/**
 * Writes to file only if contents are different
 */
async function writeFileIfChanged(
  filename: string,
  contents: string
): Promise<void> {
  let current = await readFile(filename);
  if (current !== contents) {
    await fsx.ensureDir(path.dirname(filename));
    return fsx.writeFile(filename, contents);
  }
}

/**
 * Return file contents or '' if does not exist.
 */
function readFile(filename: string): Promise<string> {
  return fsx.readFile(filename, { encoding: "utf8" }).catch(error => "");
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
 * deprec
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
      await fsx.ensureDir(dir);
      dirs[dir] = true;
    }

    await copyNewer(full, target);
  }
}

async function copyNewer(source: string, target: string): Promise<void> {
  let sourceTime = await mtime(source);
  let targetTime = await mtime(target);
  if (sourceTime > targetTime) {
    fsx.copyFileSync(source, target);
  }
}

async function mtime(source: string): Promise<number> {
  return fsx.stat(source).then(stats => stats.mtimeMs, error => 0);
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
 * deprec
 */
async function customizeComponents(config: Config, src: string) {
  if (config._LAYOUT) {
    let layoutPath = path.join(src, "layouts", "index.js");
    let content = await fsx.readFile(layoutPath, "utf8");
    for (let key in config._LAYOUT) {
      let target = config._LAYOUT[key];
      let re = new RegExp(`^import ${key} from ['"](.+)['"]`, "m");
      content = content.replace(
        re,
        `import ${key} from "../components/${target}";`
      );
    }
    await writeFileIfChanged(layoutPath, content);
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
  return writeFileIfChanged(filename, body);
}

/**
 * Generate gatsby-config from yaml config
 *
 * collect from config plugins
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
      // `gatsby-transformer-yaml`,
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
          path: `./src/data/site.json`,
          name: "site"
        }
      },
      // {
      //   resolve: `gatsby-source-filesystem`,
      //   options: {
      //     path: `./src/data/music.json`,
      //     name: "music"
      //   }
      // },
      // {
      //   resolve: `gatsby-source-filesystem`,
      //   options: {
      //     path: `./src/music`,
      //     name: "music"
      //   }
      // },
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
                related: false, //Optional: Will remove related videos from the end of an embedded YouTube video.
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
          // placeholder: replace when writing the gatsby-config.js file
          // with something that resolves this as runtime
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
  return writeFileIfChanged(filename, json);
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
  // options: colors work, but throws unhandled exception
  // TypeError: Cannot read property 'pipe' of null
  // { stdio: echo ? "inherit" : "pipe" }
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
