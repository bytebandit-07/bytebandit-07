// generate-stats.mjs
// Fetches your GitHub stats and writes a self-hosted SVG card.
// No third-party stats service involved — this is 100% your own code.

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

if (!USERNAME || !TOKEN) {
  console.error("Missing GH_USERNAME or GH_TOKEN env vars.");
  process.exit(1);
}

const headers = {
  Authorization: `bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

// ---- 1. GraphQL: profile + repo stats ----
const graphqlQuery = `
query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    pullRequests(states: [OPEN, MERGED, CLOSED]) { totalCount }
    issues { totalCount }
    repositoriesContributedTo(includeUserRepositories: true) { totalCount }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      totalCount
      nodes {
        stargazerCount
      }
    }
  }
}`;

async function graphql(query, variables) {
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

// ---- 2. REST: total commit count (search API) ----
async function getTotalCommits(username) {
  const res = await fetch(
    `https://api.github.com/search/commits?q=author:${username}`,
    {
      headers: {
        Authorization: `bearer ${TOKEN}`,
        Accept: "application/vnd.github.cloak-preview+json",
      },
    }
  );
  const json = await res.json();
  return json.total_count ?? 0;
}

function starCount(nodes) {
  return nodes.reduce((sum, r) => sum + r.stargazerCount, 0);
}

function statsSVG({ stars, commits, prs, issues, contributedTo, followers, username }) {
  const rows = [
    ["⭐ Total Stars", stars],
    ["📝 Total Commits", commits],
    ["🔀 Total PRs", prs],
    ["🐛 Total Issues", issues],
    ["🤝 Repos Contributed To", contributedTo],
    ["👥 Followers", followers],
  ];

  const rowHeight = 30;
  const startY = 65;
  const width = 420;
  const height = startY + rows.length * rowHeight + 20;

  const rowsSVG = rows
    .map(
      (row, i) => `
    <g transform="translate(25, ${startY + i * rowHeight})">
      <text class="stat" x="0" y="0">${row[0]}:</text>
      <text class="stat-value" x="${width - 50}" y="0" text-anchor="end">${row[1]}</text>
    </g>`
    )
    .join("");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .header { font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif; fill: #58a6ff; }
    .stat { font: 400 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: #c9d1d9; }
    .stat-value { font: 600 14px 'Segoe UI', Ubuntu, Sans-Serif; fill: #ffffff; }
  </style>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#0d1117" stroke="#30363d"/>
  <text x="25" y="35" class="header">${username}'s GitHub Stats</text>
  ${rowsSVG}
</svg>`;
}

async function main() {
  const data = await graphql(graphqlQuery, { login: USERNAME });
  const u = data.user;
  const commits = await getTotalCommits(USERNAME);

  const svg = statsSVG({
    stars: starCount(u.repositories.nodes),
    commits,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    contributedTo: u.repositoriesContributedTo.totalCount,
    followers: u.followers.totalCount,
    username: USERNAME,
  });

  const fs = await import("fs");
  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/github-stats.svg", svg);
  console.log("assets/github-stats.svg written.");
}

main();
