import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN = [/Math\.random/, /\bDate\b/, /performance\.now/, /crypto\.getRandomValues/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('determinism guard', () => {
  it('keeps unseeded randomness and wall-clock time out of the engine and content', () => {
    const violations: string[] = [];
    for (const file of [...sourceFiles('src/engine'), ...sourceFiles('src/content')]) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (FORBIDDEN.some((re) => re.test(line))) violations.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(violations).toEqual([]);
  });
});
