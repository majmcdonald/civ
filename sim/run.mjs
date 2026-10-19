// Runs a TypeScript script that imports the engine (extensionless imports need Vite's resolver).
// Usage: node sim/run.mjs <script.ts> [args]
import { runnerImport } from 'vite';

await runnerImport(process.argv[2]);
