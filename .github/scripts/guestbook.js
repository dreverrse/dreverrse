// Rebuilds the guestbook block in README.md from issues labelled "guestbook".
// Issue text is untrusted: it is reduced to plain text before it touches the README.
const fs = require("fs");

const MAX_ENTRIES = 8;
const MAX_LEN = 120;

function clean(body) {
  let text = String(body || "");
  const m = text.match(/### Message\s+([\s\S]*)/);
  if (m) text = m[1];
  text = text
    .replace(/_No response_/g, "")
    .replace(/https?:\/\/\S+/gi, "🔗")
    .replace(/www\.\S+/gi, "🔗")
    .replace(/[<>\[\]()|*_`~#\\{}=]/g, "")
    .replace(/@/g, "＠")
    .replace(/\s+/g, " ")
    .trim();
  if ([...text].length > MAX_LEN) text = [...text].slice(0, MAX_LEN - 1).join("") + "…";
  return text || "👋";
}

module.exports = async ({ github, context }) => {
  const { owner, repo } = context.repo;
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, labels: "guestbook", state: "all", per_page: 100,
  });
  const rows = issues
    .filter((i) => !i.pull_request && /^[A-Za-z0-9-]{1,39}$/.test(i.user.login) && i.user.type === "User")
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, MAX_ENTRIES)
    .map((i) => {
      const login = i.user.login;
      const date = new Date(i.created_at).toISOString().slice(0, 10);
      return `| <img src="https://github.com/${login}.png?size=48" width="28" alt="${login}" /> | [${login}](https://github.com/${login}) | ${clean(i.body)} | ${date} |`;
    });

  const block = rows.length
    ? ["| | Visitor | Message | Date |", "|:-:|---|---|---|", ...rows].join("\n")
    : "<p align=\"center\"><i>No entries yet. Be the first to sign! ✨</i></p>";

  const readme = fs.readFileSync("README.md", "utf8");
  const start = "<!-- GUESTBOOK:START -->";
  const end = "<!-- GUESTBOOK:END -->";
  const a = readme.indexOf(start);
  const b = readme.indexOf(end);
  if (a === -1 || b === -1) throw new Error("guestbook markers missing");
  const next = readme.slice(0, a + start.length) + "\n" + block + "\n" + readme.slice(b);
  fs.writeFileSync("README.md", next);

  const issue = context.payload.issue;
  if (context.eventName === "issues" && issue && issue.labels.some((l) => l.name === "guestbook")) {
    await github.rest.issues.createComment({
      owner, repo, issue_number: issue.number,
      body: "Thanks for signing the guestbook! 🎉 Your message is now on my profile: https://github.com/" + owner,
    });
    await github.rest.issues.update({ owner, repo, issue_number: issue.number, state: "closed", state_reason: "completed" });
  }
};
