/**
 * AEO / GEO citability scorer.
 *
 * A deliberately different instrument from `seo-score.ts`, which measures
 * traditional on-page SEO. This one measures the thing that decides whether an
 * AI answer engine will *quote* the post.
 *
 * Two design rules:
 *
 * 1. **Pure and dependency-free.** Every check is a regex or a count over the
 *    markdown, so it runs synchronously in the editor on every keystroke with
 *    no network call and no LLM. A metric you cannot compute instantly is a
 *    metric nobody trusts.
 *
 * 2. **It is not a keyword-density meter.** The research is unambiguous that
 *    keyword stuffing is the one behaviour that actively *reduces* AI
 *    visibility, so this scorer checks keyword density as a liability, not as
 *    a ranking factor. The two scorers are reported side by side for that
 *    reason: chasing a high traditional score and a high citability score are
 *    not always the same set of edits, and the writer should see both.
 *
 * The weights follow the published finding that cited sources and specific
 * statistics move citation rate most, followed by attributed quotations and
 * demonstrated first-hand experience.
 */
import { countWords } from "../utils";
import { scanHeadings } from "./pipeline";

export interface AeoCheck {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
  weight: number;
}

export interface AeoScore {
  /** 0-100 */
  score: number;
  checks: AeoCheck[];
}

export interface AeoInput {
  title: string;
  excerpt: string;
  content: string;
  /** The author's 40-60 word direct answer, if written. */
  answer: string;
  takeaways: string[];
  sources: { title: string; url: string; author: string; year: string }[];
  focusKeyword: string;
}

/* ------------------------------ Patterns --------------------------------- */

/** "X is a ...", "X refers to ...", "in simple terms, ..." */
const DEFINITION =
  /\b(?:is|are)\s+(?:a|an|the)\s|\brefers?\s+to\b|\bmeans?\b|\bin\s+(?:simple|plain|other)\s+terms\b/i;

/** Answer-shaped openers: a copula, a number with a unit, or currency. */
const ANSWER_OPENER =
  /\b(?:is|are|was|were|means?|refers?)\b|\d+%|\$[\d,]+|\b\d[\d,.]*\s*(?:ms|s|kb|mb|gb|x|times)\b/i;

/** "According to X", "research shows", "in our tests", "we measured". */
const ATTRIBUTION =
  /\b(?:according to|research (?:shows|indicates|suggests|finds)|studies? (?:show|indicate|suggest|found)|data (?:shows|indicates)|per)\b/i;

/** Named institutions that read as a citation rather than a claim. */
const INSTITUTION =
  /\b(?:Google|Microsoft|OpenAI|Anthropic|Gartner|Forrester|Ida Labs|W3C|MDN|Stack Overflow|GitHub|Nielsen|Wikipedia|Akamai|Cloudflare)\b/;

/** First-hand / original-signal phrasing. */
const FIRST_HAND =
  /\b(?:we (?:found|measured|tested|benchmarked|ran|shipped|built|tried|found out)|in practice|hand-?on|real-?world|case study|i tested|i ran|i built|i measured)\b/i;

/** Hollow AI-filler openers and transitions. */
const FLAT_LANGUAGE =
  /\b(?:in today'?s (?:fast|digital|modern)|it'?s (?:important|crucial|essential) to note|delve into|ever-?evolving|navigat(?:e|ing) the|unlock the|game-?chang(?:er|ing)|a testament to|when it comes to|unleash|supercharge|leverage the power)\b/i;

/** Em-dash and en-dash overuse: a reliable "machine rhythm" tell. */
const DASH = /[\u2014\u2013]/g;

const PRONOUNS =
  /\b(?:it|they|them|their|these|those|this|that|he|she|his|her|we|our|you|your)\b/gi;

/* ------------------------------ Helpers ---------------------------------- */

/** Split markdown into paragraph-ish blocks, dropping code fences. */
function blocks(markdown: string): string[] {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .split(/\n\s*\n/)
    .map((b) => b.replace(/^#{1,6}\s+/gm, "").trim())
    .filter((b) => b.length > 0);
}

function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** A dated statistic: a number carrying a unit, a percentage, or currency. */
function countStatistics(text: string): number {
  const percent = text.match(/\b\d+(?:\.\d+)?\s?%/g) ?? [];
  const money = text.match(/[$€£]\s?\d[\d,.]*/g) ?? [];
  const quantified = text.match(
    /\b\d[\d,.]*\s*(?:ms|milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|kb|mb|gb|tb|users?|customers?|subscribers?|posts?|words?|pages?|sites?|requests?|ms|s|x)\b/gi
  ) ?? [];
  const years = text.match(/\b20(?:1\d|2\d)\b/g) ?? [];
  return percent.length + money.length + quantified.length + years.length;
}

/** Self-contained means few pronouns relative to its length. */
function pronounRatio(text: string): number {
  const total = words(text).length;
  if (total === 0) return 1;
  const matches = text.match(PRONOUNS);
  return (matches?.length ?? 0) / total;
}

/** Capitalised multi-word sequences: proxies for named entities. */
function countEntities(text: string): number {
  const matches = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*/g) ?? [];
  // Drop the sentence-initial artefact ("The", "This") by ignoring single
  // common words, then count the rest.
  return matches.filter(
    (m) => !/^(The|This|That|These|Those|When|While|After|Before|Every|Each|Any|All|Its|It)$/.test(m)
  ).length;
}

/* ------------------------------ Scorer ----------------------------------- */

export function computeAeoScore(input: AeoInput): AeoScore {
  const checks: AeoCheck[] = [];
  const add = (
    id: string,
    label: string,
    weight: number,
    passed: boolean,
    hint: string
  ) => checks.push({ id, label, passed, hint, weight });

  const body = input.content || "";
  // Prose-quality heuristics must ignore code fences: a comment or a string
  // literal full of dashes is not the author's writing rhythm, and counting it
  // would fail a perfectly good post that happens to include a shell snippet.
  const prose = body.replace(/```[\s\S]*?```/g, "");
  const paragraphs = blocks(body);
  const firstParagraph = paragraphs[0] ?? "";
  const allText = `${input.title} ${input.answer} ${input.excerpt} ${prose}`;
  const wordTotal = countWords(body);

  /* --- Structure --------------------------------------------------------- */

  add(
    "answer-field",
    "A direct answer is written (40-60 words)",
    14,
    words(input.answer).length >= 25,
    "Add an answer in the AEO panel: one or two sentences that answer the question the title asks, in your own words. This is the single biggest citability lever and it feeds the speakable schema."
  );

  add(
    "answer-first",
    "The post opens with the answer, not a preamble",
    10,
    paragraphs.length > 0 && ANSWER_OPENER.test(words(firstParagraph).slice(0, 60).join(" ")),
    "Put the answer in the first sentence or two. Openers like \"In this post we'll explore...\" force the reader (and the model) to hunt for it."
  );

  add(
    "definition",
    "Defines its subject explicitly (what X is)",
    8,
    DEFINITION.test(firstParagraph) || DEFINITION.test(input.answer),
    "State plainly what the thing is. A model quoting a definition is the cheapest citation there is."
  );

  // The measured sweet spot for an extractable passage is 100-200 words; the
  // 134-167 band is where snippet extraction is most reliable.
  const selfContained = paragraphs.filter((p) => {
    const n = words(p).length;
    return n >= 100 && n <= 200 && pronounRatio(p) < 0.04;
  });
  add(
    "self-contained",
    "At least one self-contained 100-200 word passage",
    10,
    selfContained.length > 0,
    "One paragraph should stand alone without the surrounding context. That means naming its subject instead of leaning on \"it\", \"this\" and \"they\", and running 100-200 words."
  );

  add(
    "takeaways",
    "Key takeaways listed (3-5 bullets)",
    7,
    input.takeaways.filter((t) => t.trim()).length >= 3,
    "Three to five bullets. They get extracted as a unit and are the part most likely to be quoted in full."
  );

  /* --- Authority --------------------------------------------------------- */

  add(
    "sources",
    "Cites sources with attribution",
    14,
    input.sources.filter((s) => s.title.trim() || s.url.trim()).length > 0,
    "Add sources in the AEO panel with a title, url, author and year. Cited sources are the single strongest predictor of being quoted."
  );

  const statCount = countStatistics(allText);
  add(
    "statistics",
    "States specific numbers, not vague claims",
    11,
    statCount >= 3,
    `Found ${statCount} quantified claim${statCount === 1 ? "" : "s"}. Specific figures with units are what a model can lift verbatim; "much faster" is not a fact it can use.`
  );

  // A model resolving "who/what is this about" is doing entity matching, so a
  // post that names concrete things is far easier to attach to a query than
  // one that stays in generic vocabulary.
  const entityCount = countEntities(prose);
  add(
    "named-entities",
    "Names concrete things (people, products, standards)",
    6,
    entityCount >= 3,
    `Found ${entityCount} proper-noun reference${entityCount === 1 ? "" : "s"}. Naming specific products, standards or people helps an engine attach the post to the right entity.`
  );

  add(
    "attribution",
    "Attributes claims to a source or study",
    8,
    ATTRIBUTION.test(body) || INSTITUTION.test(body),
    "Use \"according to...\", \"research shows...\" or name the institution. An unattributed claim is one a model is cautious about repeating."
  );

  add(
    "first-hand",
    "Shows first-hand experience",
    9,
    FIRST_HAND.test(body),
    "Say what you actually ran, built or measured. First-hand detail is what separates a post worth citing from a summary of one."
  );

  /* --- Shape ------------------------------------------------------------- */

  const headings = scanHeadings(body);
  add(
    "question-heading",
    "A subheading phrased as the reader's question",
    7,
    headings.some((h) => h.text.trim().endsWith("?")),
    "One H2 written as the question someone would type. Question-shaped headings are how a retrieval step matches a query to your section."
  );

  add(
    "structure",
    "Uses a table or a numbered list for scannable content",
    6,
    /\|[^\n]*\|/.test(body) || /^\s*\d+\.\s+/m.test(body),
    "Tables beat prose for comparisons; numbered lists beat prose for processes. Both are extracted more faithfully than a wall of text."
  );

  add(
    "length",
    "Enough depth to be worth citing (400+ words)",
    7,
    wordTotal >= 400,
    `${wordTotal} words. Under ~400 a post rarely contains a passage extractable on its own. Depth is not padding, but it has to be real.`
  );

  /* --- Liabilities ------------------------------------------------------- */

  // Reported as a check that "passes" when density is healthy, so the writer
  // sees an explicit green light rather than a silent omission.
  const kw = input.focusKeyword.trim().toLowerCase();
  const kwCount = kw
    ? (body.toLowerCase().match(new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) ?? [])
        .length
    : 0;
  const density = wordTotal > 0 ? kwCount / wordTotal : 0;
  add(
    "keyword-density",
    "Keyword density is natural (under 2.5%)",
    5,
    density <= 0.025,
    `Focus keyword appears ${kwCount} time${kwCount === 1 ? "" : "s"} (${(density * 100).toFixed(1)}% of words). Past ~2.5% repetition reads as stuffing, and stuffing is the one thing that measurably reduces AI visibility.`
  );

  const dashes = (allText.match(DASH) ?? []).length;
  const perKilo = wordTotal > 0 ? (dashes / wordTotal) * 1000 : 0;
  add(
    "no-flat-language",
    "No filler phrasing or dash-heavy rhythm",
    6,
    !FLAT_LANGUAGE.test(allText) && perKilo <= 4,
    FLAT_LANGUAGE.test(allText)
      ? "Some hollow filler phrasing detected. Concrete claims beat scaffolding."
      : `${dashes} dashes in ${wordTotal} words (${perKilo.toFixed(1)} per 1,000). Past ~4 per 1,000 the rhythm starts to read machine-generated.`
  );

  const earned = checks.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  return { score: Math.round((earned / total) * 100), checks };
}

/** Human label for a citability score, used by the editor panel. */
export function aeoToneFor(score: number): { color: string; label: string } {
  if (score >= 80) return { color: "#3e9a5b", label: "Highly citable" };
  if (score >= 55) return { color: "#c98a1b", label: "Citable with work" };
  return { color: "#b3402e", label: "Hard to cite" };
}
