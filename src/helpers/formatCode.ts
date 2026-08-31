// Code formatting — prettier standalone, loaded lazily so the main
// bundle stays lean. null — no formatter for the file (e.g. Go: gofmt
// cannot run in the browser; a server-side formatter is backlog).

type Formatter = (content: string) => Promise<string>

async function prettierFormat(parser: string, plugins: () => Promise<unknown[]>) {
  const [{ format }, resolved] = await Promise.all([import('prettier/standalone'), plugins()])
  return (content: string) =>
    format(content, {
      parser,
      // biome-ignore lint/suspicious/noExplicitAny: prettier plugin typing is loose by design.
      plugins: resolved as any[],
      tabWidth: 4,
    })
}

const BY_EXTENSION: Record<string, () => Promise<Formatter>> = {
  json: () =>
    prettierFormat('json', async () => [
      await import('prettier/plugins/babel'),
      await import('prettier/plugins/estree'),
    ]),
  yaml: () => prettierFormat('yaml', async () => [await import('prettier/plugins/yaml')]),
  yml: () => prettierFormat('yaml', async () => [await import('prettier/plugins/yaml')]),
  js: () =>
    prettierFormat('babel', async () => [
      await import('prettier/plugins/babel'),
      await import('prettier/plugins/estree'),
    ]),
  mjs: () =>
    prettierFormat('babel', async () => [
      await import('prettier/plugins/babel'),
      await import('prettier/plugins/estree'),
    ]),
  cjs: () =>
    prettierFormat('babel', async () => [
      await import('prettier/plugins/babel'),
      await import('prettier/plugins/estree'),
    ]),
  jsx: () =>
    prettierFormat('babel', async () => [
      await import('prettier/plugins/babel'),
      await import('prettier/plugins/estree'),
    ]),
  ts: () =>
    prettierFormat('typescript', async () => [
      await import('prettier/plugins/typescript'),
      await import('prettier/plugins/estree'),
    ]),
  tsx: () =>
    prettierFormat('typescript', async () => [
      await import('prettier/plugins/typescript'),
      await import('prettier/plugins/estree'),
    ]),
  css: () => prettierFormat('css', async () => [await import('prettier/plugins/postcss')]),
  html: () => prettierFormat('html', async () => [await import('prettier/plugins/html')]),
  md: () => prettierFormat('markdown', async () => [await import('prettier/plugins/markdown')]),
  mdx: () => prettierFormat('markdown', async () => [await import('prettier/plugins/markdown')]),
}

/** Formats file content by its name; null — no formatter available.
 * Throws on syntax the formatter refuses. */
export async function formatFile(name: string, content: string): Promise<string | null> {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  const make = BY_EXTENSION[name.slice(dot + 1).toLowerCase()]
  if (make === undefined) return null
  const formatter = await make()
  return formatter(content)
}

/** True when formatFile knows the file type. */
export function hasFormatter(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot > 0 && name.slice(dot + 1).toLowerCase() in BY_EXTENSION
}

/** The save hygiene: trailing spaces cut, exactly one final newline. */
export function trimForSave(content: string): string {
  return `${content.replace(/[ \t]+$/gm, '').replace(/\n+$/, '')}\n`
}
