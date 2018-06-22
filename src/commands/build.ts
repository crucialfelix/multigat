import { Command } from '@oclif/command';
import { ExecaError } from 'execa';

import { buildSite, listSites } from '../configs';

interface FailedBuild {
  site: string;
  description: string;
}

export default class Build extends Command {
  static description = "Build one or all sites";

  static examples = ["$ multigat build hello-world", "$ multigat build"];

  static args = [{ name: "site", required: false }];

  async run() {
    const { args } = this.parse(Build);
    let site = args.site;
    let sites: string[] = site ? [site] : await listSites();

    let failed: FailedBuild[] = [];
    for (let site of sites) {
      await buildSite(site, false).then(
        result => this.log(`BUILT: ${site}`),
        (error: ExecaError) => {
          let description = [
            `FAILED: ${site}`,
            error.message,
            error.stderr
          ].join("\n");
          console.error(description);
          failed.push({ site, description });
        }
      );
    }

    if (failed.length) {
      for (let f of failed) {
        console.error(
          "---------------------------------------------------------------"
        );
        console.error(f.description);
      }
      console.error(
        "---------------------------------------------------------------"
      );
      this.error("FAILED: " + failed.map(f => f.site).join(", "));
    }

    this.log("SUCCESS");
  }
}
