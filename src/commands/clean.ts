import { Command } from '@oclif/command';

import { cleanSite } from '../configs';

export default class Clean extends Command {
  static description = "Clean any previously created assets from made/{site}";

  static examples = [
    `$ multigat clean hello-world
`
  ];

  static args = [{ name: "site", required: true }];

  async run() {
    const { args } = this.parse(Clean);
    let filename = await cleanSite(args.site);
    this.log(`Cleaned: ${filename}`);
  }
}
