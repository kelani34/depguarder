import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function initCommand() {
  console.log(`\n🛡️ Initializing DepGuarder in this repository...`);

  const workflowDir = join(process.cwd(), '.github', 'workflows');
  const workflowPath = join(workflowDir, 'depguarder.yml');

  // We use a placeholder for the repository. The user should update this to their actual repo name.
  const workflowContent = `name: DepGuarder Audit
on:
  pull_request:
    branches: [ main, master ]
  push:
    branches: [ main, master ]

jobs:
  depguarder:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      # Automatically use the correct package manager
      - name: Install Dependencies
        run: |
          if [ -f "pnpm-lock.yaml" ]; then npm install -g pnpm && pnpm install;
          elif [ -f "yarn.lock" ]; then yarn install;
          elif [ -f "bun.lock" ]; then npm install -g bun && bun install;
          else npm install; fi
          
      - name: DepGuarder Security Audit
        # NOTE: Update the 'uses' line below with your actual GitHub username/organization and repository name
        uses: kelani34/depguarder/packages/github-action@main
        with:
          fail-on: 'high'
          token: \${{ secrets.GITHUB_TOKEN }}
`;

  try {
    if (!existsSync(workflowDir)) {
      mkdirSync(workflowDir, { recursive: true });
    }

    if (existsSync(workflowPath)) {
      console.log(`\n⚠️  DepGuarder workflow already exists at ${workflowPath}`);
    } else {
      writeFileSync(workflowPath, workflowContent);
      console.log(`\n✅ Created GitHub Action: ${workflowPath}`);
    }

    console.log(`\n🎉 DepGuarder is now set up! Your dependencies will be audited on every PR.`);
    console.log(`\n⚠️  IMPORTANT: Please open ${workflowPath} and update the 'uses' line with your GitHub repository name.`);
  } catch (error: any) {
    console.error(`\n❌ Initialization failed: ${error.message}`);
    process.exit(1);
  }
}
