export const seo = (title: string, description: string) => ({
  meta: [
    { title: `${title} · ServiceFlow AI` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · ServiceFlow AI` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
