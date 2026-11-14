// Site-wide settings used for canonical URLs, the sitemap, Open Graph tags and structured data.
// SITE_URL can override the domain for a staging build, e.g. SITE_URL=https://staging.example.com npm run build
export const SITE = {
  url: (process.env.SITE_URL || "https://periodic-something.rinsedsoap.xyz").replace(/\/+$/, ""),
  name: "Periodic Table Lab",
  shortName: "Table Lab",
  description:
    "An interactive periodic table drawn like a lab notebook. Explore all 118 elements with 3D and hand-drawn atom models, orbitals, crystal lattices, spectra, trends, an equation balancer and quizzes.",
  locale: "en_GB",
  lang: "en",
  themeColor: "#efe6d2",
  email: "talk@rinsedsoap.xyz",
  // Paste the repository URL here when it exists; the GitHub buttons stay inactive while this is empty.
  github: "",
  // When the element data was last reviewed. Used for sitemap <lastmod> and dateModified.
  dataUpdated: "2026-11-14"
};
