import { readFile } from 'node:fs/promises';

export function parseEnvFileContent(content) {
  return content
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return env;
      }

      const separatorIndex = trimmedLine.indexOf('=');

      if (separatorIndex <= 0) {
        return env;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
      env[key] = unquoteEnvValue(rawValue);

      return env;
    }, {});
}

export async function loadLocalEnvFile(path, targetEnv = process.env) {
  try {
    const values = parseEnvFileContent(await readFile(path, 'utf8'));

    Object.entries(values).forEach(([key, value]) => {
      if (targetEnv[key] === undefined) {
        targetEnv[key] = value;
      }
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
