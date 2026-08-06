/**
 * Minimal local typings for gray-matter (no @types package is published).
 * Covers only the API surface Ansora uses: parse + stringify.
 */
declare module "gray-matter" {
  interface GrayMatterResult {
    /** Parsed YAML frontmatter object. */
    data: Record<string, unknown>;
    /** Body content after the frontmatter. */
    content: string;
  }

  function matter(input: string | Buffer, options?: Record<string, unknown>): GrayMatterResult;

  namespace matter {
    /** Serialize a body + data object back into a frontmatter file. */
    function stringify(
      input: string | Buffer,
      data?: Record<string, unknown>,
      options?: Record<string, unknown>
    ): string;
  }

  export = matter;
}
