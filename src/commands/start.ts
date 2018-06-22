import { Command } from '@oclif/command';
import chokidar from 'chokidar';

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
    await this.make(site);

    chokidar
      .watch("./sites", { ignored: /(^|[\/\\])\../ })
      .on("change", path => {
        console.log("changed:", path);
        this.make(site);
      });

    // run gatsby develop in child process
    // but then you don't get colors
  }

  async make(site: string) {
    await cleanSite(site);
    await makeSite(site);
    await activateSite(site);
    this.log(`Built and activated: ${site}`);
  }
}
