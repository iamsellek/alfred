import * as fs from 'fs';
import * as path from 'path';
import readline from 'readline';
import { ConfigJson } from './types';
import chalk from 'chalk';
import * as os from 'os';
import { exec } from 'child_process';

const VERSION = '0.1.0';

class Alfred {
  private settingsDirectory: string;
  private repoLocations: Record<string, string> = {};
  private name: string = 'Wayne';
  private title: string = 'sir';
  private arguments: string[] = [];

  constructor() {
    this.settingsDirectory = os.homedir();
  }

  public async initialize(): Promise<void> {
    // Check if there's just one version and the config file doesn't exist, then restore settings
    const versionPattern = new RegExp(`alfred-${VERSION}`);
    const alfredDirectories = fs
      .readdirSync(this.settingsDirectory)
      .filter((file) =>
        fs.statSync(path.join(this.settingsDirectory, file)).isDirectory(),
      )
      .filter((dir) => versionPattern.test(dir));

    if (
      alfredDirectories.length > 1 &&
      !fs.existsSync(path.join(this.settingsDirectory, 'alfredConfig.json'))
    ) {
      this.restoreSettings('alfred', VERSION);
    }

    if (
      !fs.existsSync(path.join(this.settingsDirectory, 'alfredConfig.json'))
    ) {
      await this.config();
    } else {
      const configJson: ConfigJson = JSON.parse(
        fs.readFileSync(
          path.join(this.settingsDirectory, 'alfredConfig.json'),
          'utf8',
        ),
      );
      this.repoLocations = configJson.repos || {};
      this.name = configJson.name || 'Wayne';
      this.title = configJson.title || 'sir';
    }
  }

  public async alfred(args: string[]): Promise<void> {
    this.arguments = args;

    await this.alfredCommand();
    const command = this.commandToGitCommand();
    const repos = this.reposStringToArray();

    for (const repo of repos) {
      console.log(chalk.yellow(`Repo ${repo}:`));

      await this.bash(this.repoLocations[repo], command);

      console.log();
    }
  }

  // repo is the directory path
  private async bash(repo: string, command: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const childProcess = exec(command, { cwd: repo });

      childProcess.stdout?.on('data', (data) => {
        console.log(data.toString());
      });

      childProcess.stderr?.on('data', (data) => {
        console.error(data.toString());
      });

      childProcess.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          console.error(
            `Error executing command "${command}" in ${repo}, ${this.title}`,
          );

          reject();
        }
      });
    });
  }

  private async alfredCommand(): Promise<void> {
    if (!this.arguments[0] || this.arguments[0] === '') {
      console.log(
        chalk.red('I need a command to run, Master ' + this.name + '.'),
      );

      process.exit(1);
    }

    switch (this.arguments[0]) {
      case 'list-repo':
      case 'list-repos':
      case 'listrepo':
      case 'listrepos':
      case 'lr':
        console.log(
          'Here are your repos and their locations, Master ' + this.name + ':',
        );
        console.log();

        this.listReposAndLocations();

        console.log();

        process.exit(0);
      case 'add-repo':
      case 'addrepo':
      case 'ar':
        if (this.secondArgumentMissing()) {
          console.log(
            chalk.red(
              'I need a repo name for the new repo, Master ' + this.name + '.',
            ),
          );

          process.exit(1);
        }

        await this.addRepo();

        process.exit(0);
      case 'delete-repo':
      case 'deleterepo':
      case 'deletrepo':
      case 'dr':
        if (this.secondArgumentMissing()) {
          console.log(
            chalk.red(
              "I need a repo name to know which repo I'm deleting, Master " +
                this.name +
                '.',
            ),
          );

          process.exit(1);
        }

        await this.deleteRepo();

        process.exit(0);
      case 'repo-add-directory':
      case 'rad':
        if (this.secondArgumentMissing()) {
          console.log(
            chalk.red(
              'I need a directory path to know which repos to add, Master ' +
                this.name +
                '.',
            ),
          );

          process.exit(1);
        }

        await this.repoAddDirectory();

        process.exit(0);
      case 'reset-config':
      case 'rc':
        fs.unlinkSync(`${this.settingsDirectory}/alfredConfig.json`);
        await this.initialize();

        process.exit(0);
      default:
        return;
    }
  }

  private listReposAndLocations(): void {
    Object.entries(this.repoLocations).forEach(([repo, location]) => {
      console.log(chalk.yellow(`${repo}: ${location}`));
    });
  }

  public async addRepo(): Promise<void> {
    const repoName = this.arguments[1];
    console.log();
    console.log(
      `I can add the ${repoName} repo straight away, ${this.title}. Where is that repository? Please paste the full path.`,
    );

    const repoPath = await this.getUserInput();

    console.log();

    const configPath = `${this.settingsDirectory}/alfredConfig.json`;
    const configFileExists = fs.existsSync(configPath);
    const configJson = configFileExists
      ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
      : {};

    configJson.repos = configJson.repos || {};
    configJson.repos[repoName] = repoPath;

    fs.writeFileSync(configPath, JSON.stringify(configJson, null, 2), 'utf8');

    console.log(
      chalk.green(`I've added that repository successfully, ${this.title}!`),
    );
    console.log();
  }

  public async deleteRepo(): Promise<void> {
    const repoName = this.arguments[1];

    console.log();

    const configPath = path.join(this.settingsDirectory, 'alfredConfig.json');

    if (!fs.existsSync(configPath)) {
      console.log(chalk.red('Configuration file not found.'));

      return;
    }

    const configJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (repoName === 'all') {
      configJson.repos = {};
      console.log(
        chalk.green(
          `I've deleted all repositories successfully, ${this.title}!`,
        ),
      );
    } else if (Object.keys(configJson.repos).includes(repoName)) {
      delete configJson.repos[repoName];

      console.log(
        chalk.green(
          `I've deleted the ${repoName} repository successfully, ${this.title}!`,
        ),
      );
    } else {
      console.log(
        chalk.red(
          `Sorry, ${this.title}, that is not a repository that is currently in my list. If you'd *really* like to delete it, please add it first using the 'add-repo' command.`,
        ),
      );

      return;
    }

    fs.writeFileSync(configPath, JSON.stringify(configJson, null, 2), 'utf8');

    console.log();
  }

  public async repoAddDirectory(): Promise<void> {
    console.log();

    const rootDir =
      this.arguments[1] === '.' ? process.cwd() : this.arguments[1];
    const repoPaths: string[] = [];

    const findGitRepos = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name === '.git') {
            repoPaths.push(fullPath.slice(0, -4)); // Remove the '.git' part
            continue; // Skip further exploration of this directory
          }

          findGitRepos(fullPath); // Recursively find in subdirectories
        }
      }
    };

    findGitRepos(rootDir);

    let configJson = this.loadConfig();

    console.log(
      chalk.green(
        "I've added the following repositories successfully, " + this.title,
      ),
    );

    console.log();

    repoPaths.forEach((repoPath) => {
      const repo = path.basename(repoPath);

      if (!configJson.repos[repo]) {
        configJson.repos[repo] = repoPath;
        console.log(chalk.yellow(repo + ':') + ` ${repoPath}`);
      }
    });

    this.saveConfig(configJson);
  }

  private loadConfig(): any {
    const configPath = path.join(this.settingsDirectory, 'alfredConfig.json');

    if (!fs.existsSync(configPath)) {
      return { repos: {} };
    }

    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  private saveConfig(config: any): void {
    const configPath = path.join(this.settingsDirectory, 'alfredConfig.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  public commandToGitCommand(): string {
    let command = '';

    switch (this.arguments[0]) {
      case 'pull':
        command = 'git pull';

        this.deleteArguments(1);

        break;
      case 'push':
        command = 'git push';

        this.deleteArguments(1);

        break;
      case 'checkout':
        if (this.secondArgumentMissing()) {
          console.log(
            chalk.red(
              `I need a branch name to execute the 'checkout' command, Master ${this.name}.`,
            ),
          );

          process.exit(1);
        }

        command = `git checkout ${this.arguments[1]}`;

        this.deleteArguments(2);

        break;
      case 'checkoutb':
      case 'cb':
        if (this.secondArgumentMissing()) {
          console.log(
            chalk.red(
              `I need a branch name to execute the 'checkout' command, Master ${this.name}.`,
            ),
          );

          process.exit(1);
        }

        command = `git checkout -b ${this.arguments[1]}`;

        this.deleteArguments(2);

        break;
      case 'commit':
        if (this.secondArgumentMissing()) {
          console.log(
            chalk.red(
              `I need a commit message to execute the 'commit' command, Master ${this.name}.`,
            ),
          );

          process.exit(1);
        }

        command = `git commit -m "${this.arguments[1]}"`;

        this.deleteArguments(2);

        break;
      case 'status':
        command = 'git status';

        this.deleteArguments(1);

        break;
      case 'branches':
      case 'branch':
        command = 'git rev-parse --abbrev-ref HEAD';

        this.deleteArguments(1);

        break;
      default:
        command = this.arguments[0]; // Allow users to send any command to all repos.
        this.deleteArguments(1);
    }

    return command;
  }

  private secondArgumentMissing(): boolean {
    return this.arguments.length < 2 || !this.arguments[1];
  }

  private deleteArguments(count: number): void {
    this.arguments.splice(0, count);
  }

  public reposStringToArray(): string[] {
    if (!this.arguments[0] || this.arguments[0] === '') {
      console.log(
        chalk.red(
          `I need at least one repository to work with, Master ${this.name}.`,
        ),
      );

      process.exit(1);
    } else if (this.arguments[0] === 'all') {
      return Object.keys(this.repoLocations);
    } else {
      return this.arguments;
    }
  }

  private getUserInput(): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('', (input) => {
        rl.close();
        resolve(input.trim());
      });
    });
  }

  private restoreSettings(appName: string, version: string): void {
    const versionPattern = new RegExp(`${appName}-[0-9.]+`); // Regex to match versioned app directories
    const directories = fs
      .readdirSync(this.settingsDirectory)
      .filter((file) => {
        const filePath = path.join(this.settingsDirectory, file);

        return (
          fs.statSync(filePath).isDirectory() &&
          versionPattern.test(file) &&
          file !== `${appName}-${version}`
        );
      });

    // Try to find and copy an existing alfredConfig.json from the first matching versioned directory
    for (const dir of directories) {
      const configPath = path.join(
        this.settingsDirectory,
        dir,
        'alfredConfig.json',
      );

      if (fs.existsSync(configPath)) {
        const destinationPath = path.join(
          this.settingsDirectory,
          'alfredConfig.json',
        );

        fs.copyFileSync(configPath, destinationPath);
        console.log(
          `Restored settings from ${configPath} to ${destinationPath}`,
        );

        break; // Stop after the first found and copied alfredConfig.json
      }
    }

    // Attempt to load the restored settings
    const restoredConfigPath = path.join(
      this.settingsDirectory,
      'alfredConfig.json',
    );

    if (fs.existsSync(restoredConfigPath)) {
      const configJson = JSON.parse(
        fs.readFileSync(restoredConfigPath, 'utf8'),
      );
      this.repoLocations = configJson.repos || {};
      this.name = configJson.name || 'Wayne';
      this.title = configJson.title || 'sir';
    } else {
      // If no alfredConfig.json was found and copied, you might want to call this.config() or handle this case differently
      console.log(chalk.red('No previous alfredConfig.json found to restore.'));
      // this.config(); // Uncomment this if you want to fallback to creating a new config if none was restored
    }
  }

  private async config(): Promise<void> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (query: string): Promise<string> =>
      new Promise((resolve) => rl.question(query, resolve));

    console.log('Configuring Alfred...');

    // Ask for user's name
    let name = await question("What's your name? (default: Wayne) ");
    name = name.trim() || 'Wayne';

    // Ask for title
    let titleInput = await question('Your title? (Default: sir) ');
    let title = titleInput.trim() || 'sir';
    const repos: Record<string, string> = {};
    let addMore = 'yes';

    while (addMore.toLowerCase() === 'yes' || addMore.toLowerCase() === 'y') {
      const repoName = await question(
        "Enter a 'friendly' name for your repository: ",
      );
      const repoLocation = await question(
        'Enter the full path to this repository: ',
      );

      repos[repoName] = repoLocation;
      addMore = await question('Add more repositories? (yes/no) ');
    }

    rl.close();

    // Now, save these configurations to alfredConfig.json
    const configPath = path.join(this.settingsDirectory, 'alfredConfig.json');
    const config = { name, title, repos };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

    console.log(`Configuration saved to ${configPath}`);
  }
}

export default Alfred;
