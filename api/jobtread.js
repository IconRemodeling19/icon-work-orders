export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const GRANT_KEY = "22TM6dKUXmnEfBfnz8W2J5CneTTjQetHDC";
  const ORG_ID    = "22PHzmPPGXx";

  async function jtFetch(queryBody) {
    const r = await fetch("https://api.jobtread.com/pave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: { "$": { "grantKey": GRANT_KEY }, ...queryBody } }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`JobTread ${r.status}: ${text}`);
    return JSON.parse(text);
  }

  try {
    const { action, page } = req.body || {};

    if (action === "getJobs") {
      // Fetch jobs page by page using size+page pagination
      // Each page: job id, name, and Status custom field only
      const pageInput = page ? { "size": 20, "page": page } : { "size": 20 };

      const d = await jtFetch({
        "organization": {
          "$": { "id": ORG_ID },
          "id": {},
          "jobs": {
            "$": {
              ...pageInput,
              "where": {
                "and": [
                  ["status", "!=", "archived"],
                  ["status", "!=", "complete"]
                ]
              }
            },
            "nextPage": {},
            "nodes": {
              "id": {},
              "name": {},
              "customFieldValues": {
                "$": { "size": 25 },
                "nodes": {
                  "customField": { "name": {} },
                  "value": {}
                }
              }
            }
          }
        }
      });

      // Slim down server-side — only send id, name, status to browser
      const jobs = d?.organization?.jobs?.nodes || [];
      const nextPage = d?.organization?.jobs?.nextPage || null;

      const slim = jobs.map(job => {
        const cfvs = job.customFieldValues?.nodes || [];
        const sf = cfvs.find(c => c.customField?.name?.toLowerCase() === "status");
        return { id: job.id, name: job.name, status: sf?.value || null };
      });

      return res.status(200).json({ jobs: slim, nextPage });
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
