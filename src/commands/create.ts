import { Command } from '@oclif/command';

import { createSite } from '../configs';

export default class Create extends Command {
  static description = "Create website yamls by passing in site name";

  static examples = [
    `$ multigat create hello-world
`
  ];

  static args = [{ name: "site", required: true }];

  async run() {
    const { args } = this.parse(Create);
    let config = {
      name: args.site,
      extends: ["default"]
    };
    let filename = await createSite(args.site, config);
    this.log(`Created: ${filename}`);
  }
}
