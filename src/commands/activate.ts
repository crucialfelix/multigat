import { Command } from '@oclif/command';

import { activateSite } from '../configs';

export default class Activate extends Command {
  static description =
    "Activate a site, copying it's `gatsby-config` and generated asset files into `./src`";

  static examples = [
    `$ multigat activate hello-world
`
  ];

  static args = [{ name: "site", required: true }];

  async run() {
    const { args } = this.parse(Activate);
    let site = args.site;
    await activateSite(site);
    this.log(`Activated: ${site}`);
  }
}
