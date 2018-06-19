import { Command } from '@oclif/command';

import { activateSite, cleanSite, makeSite } from '../configs';

export default class Start extends Command {
  static description = "Start a site in development mode";

  static examples = [
    `$ multigat start hello-world
`
  ];

  static args = [{ name: "site", required: true }];

  async run() {
    const { args } = this.parse(Start);
    let site = args.site;
    await cleanSite(site);
    await makeSite(site);
    await activateSite(site);
    this.log(`Activated: ${site}`);
    // watch sites, make on change
    // run gatsby develop in child process
  }
}
