import { serializeJsonLd } from "@/lib/seo/jsonld";

/**
 * Embeds a JSON-LD graph. Always go through `serializeJsonLd()` — raw
 * `JSON.stringify` leaves `<` and `>` intact, so a post field containing
 * `</script>` could break out of the block and inject markup.
 */
export function JsonLd({ graph }: { graph: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph) }}
    />
  );
}
