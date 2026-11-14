import { SITE } from "../config/site.js";
import { ELEMENTS, CAT_NAME } from "../lib/elements.js";

// A plain-text guide for AI assistants (llms.txt convention): what the site is and where the content lives.
export function GET() {
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    "Each element has its own page with key properties, an explanation of its atomic structure, chemistry, occurrence and discovery, and the interactive lab opened on that element. Superheavy element properties are predictions.",
    "",
    "## Main pages",
    `- [Interactive periodic table](${SITE.url}/): the lab, with 3D and hand-drawn atoms, trends, molar mass, equation balancer, quizzes and timeline`,
    `- [All elements](${SITE.url}/elements/): index of all 118 elements by category`,
    "",
    "## Elements",
    ...ELEMENTS.map((e) => `- [${e.name} (${e.sym}), element ${e.Z}](${SITE.url}/elements/${e.slug}/): ${CAT_NAME[e.cat]}. ${e.sum}`),
    ""
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
