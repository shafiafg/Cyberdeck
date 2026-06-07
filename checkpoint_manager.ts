import fs from 'fs';
import path from 'path';

const CHECKPOINT_DIR = path.resolve(process.cwd(), 'checkpoint_great_reset');

// Files and folders we want to back up
const TARGETS = [
  'core_vibe_engine.py',
  'package.json',
  'requirements.txt',
  'tsconfig.json',
  'vite.config.ts',
  'metadata.json',
  'index.html',
  'src'
];

async function copyRecursive(src: string, dest: string) {
  const stat = await fs.promises.stat(src);
  if (stat.isDirectory()) {
    await fs.promises.mkdir(dest, { recursive: true });
    const files = await fs.promises.readdir(src);
    for (const file of files) {
      await copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
  }
}

async function backup() {
  console.log(`\n=== Creating Checkpoint: "Great Reset" ===`);
  
  if (fs.existsSync(CHECKPOINT_DIR)) {
    console.log(`Removing existing checkpoint at ${CHECKPOINT_DIR}...`);
    await fs.promises.rm(CHECKPOINT_DIR, { recursive: true, force: true });
  }
  
  await fs.promises.mkdir(CHECKPOINT_DIR, { recursive: true });

  for (const target of TARGETS) {
    const srcPath = path.resolve(process.cwd(), target);
    const destPath = path.resolve(CHECKPOINT_DIR, target);
    
    if (fs.existsSync(srcPath)) {
      console.log(`Backing up: ${target}`);
      await copyRecursive(srcPath, destPath);
    } else {
      console.log(`Warning: Target not found, skipping: ${target}`);
    }
  }

  console.log(`\n>>> CHECKPOINT "Great Reset" SUCCESSFULLY CREATED!`);
  console.log(`Saved at: ${CHECKPOINT_DIR}`);
  console.log(`To restore at any point, run: npx tsx checkpoint_manager.ts restore\n`);
}

async function restore() {
  console.log(`\n=== Restoring from Checkpoint: "Great Reset" ===`);
  
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    console.error(`Error: Checkpoint directory not found at ${CHECKPOINT_DIR}`);
    process.exit(1);
  }

  for (const target of TARGETS) {
    const backupPath = path.resolve(CHECKPOINT_DIR, target);
    const restorePath = path.resolve(process.cwd(), target);
    
    if (fs.existsSync(backupPath)) {
      console.log(`Restoring: ${target}`);
      if (fs.existsSync(restorePath)) {
        await fs.promises.rm(restorePath, { recursive: true, force: true });
      }
      await copyRecursive(backupPath, restorePath);
    }
  }

  console.log(`\n>>> WORKSPACE RESTORED SUCCESSFULLY TO "Great Reset"!`);
  console.log(`Everything has been reset back to this checkpoint.\n`);
}

async function main() {
  const action = process.argv[2];
  if (action === 'backup') {
    await backup();
  } else if (action === 'restore') {
    await restore();
  } else {
    console.log('Usage:');
    console.log('  npx tsx checkpoint_manager.ts backup   - Save current state as "Great Reset"');
    console.log('  npx tsx checkpoint_manager.ts restore  - Restore workspace back to "Great Reset"');
  }
}

main().catch(err => {
  console.error('Operation failed:', err);
  process.exit(1);
});
