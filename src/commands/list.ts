import { Command } from '@oclif/command';

import { listSites } from '../configs';

export default class List extends Command {
  static description = "List sites";

  static examples = [
    `$ multigat list
`
  ];

  async run() {
    let sites = await listSites();
    for (let site of sites) {
      this.log(site);
    }
  }
}
