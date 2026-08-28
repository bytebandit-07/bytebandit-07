// generate-top-langs.mjs
// Aggregates language bytes across your public repos and draws a bar-style SVG.

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

const headers = {
  Authorization: `bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const query = `
query($login: String!, $after: String) {
  user(login: $login) {
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, isFork: false) {
      pageInfo { hasNextPage endCursor }
      nodes {
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node { name color }
          }
        }
      }
    }
  }
}`;

async function graphql(variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

async function getAllRepoLanguages() {
  let after = null;
  let hasNext = true;
  const langTotals = {};

  while (hasNext) {
    const data = await graphql({ login: USERNAME, after });
    for (const repo of data.user.repositories.nodes) {
      for (const edge of repo.languages.edges) {
        const name = edge.node.name;
        langTotals[name] = langTotals[name] || { size: 0, color: edge.node.color || "#858585" };
        langTotals[name].size += edge.size;
      }
    }
    hasNext = data.user.repositories.pageInfo.hasNextPage;
    after = data.user.repositories.pageInfo.endCursor;
  }
  return langTotals;
}

function topLangsSVG(langTotals) {
  const total = Object.values(langTotals).reduce((s, l) => s + l.size, 0);
  const sorted = Object.entries(langTotals)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 6);

  const width = 350;
  const barHeight = 8;
  const rowHeight = 32;
  const startY = 55;
  const height = startY + sorted.length * rowHeight + 15;

  const rows = sorted
    .map(([name, info], i) => {
      const pct = ((info.size / total) * 100).toFixed(1);
      const barWidth = (width - 50) * (info.size / total);
      const y = startY + i * rowHeight;
      return `
    <text x="25" y="${y}" class="lang-name">${name} ${pct}%</text>
    <rect x="25" y="${y + 6}" width="${width - 50}" height="${barHeight}" rx="4" fill="#30363d"/>
    <rect x="25" y="${y + 6}" width="${barWidth.toFixed(1)}" height="${barHeight}" rx="4" fill="${info.color}"/>`;
    })
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .header { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: #58a6ff; }
    .lang-name { font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif; fill: #c9d1d9; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#0d1117" stroke="#30363d"/>
  <text x="25" y="30" class="header">Top Languages</text>
  ${rows}
</svg>`;
}

async function main() {
  const langTotals = await getAllRepoLanguages();
  const svg = topLangsSVG(langTotals);

  const fs = await import("fs");
  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/top-langs.svg", svg);
  console.log("assets/top-langs.svg written.");
}

main();
