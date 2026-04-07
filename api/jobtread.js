export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const GRANT_KEY = "22TM6dKUXmnEfBfnz8W2J5CneTTjQetHDC";

  async function jtFetch(query) {
    const r = await fetch("https://api.jobtread.com/pave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: { "$": { "grantKey": GRANT_KEY }, ...query } }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(text);
    return JSON.parse(text);
  }

  try {
    const { action, orgId, cursor, jobId } = req.body || {};

    if (action === "getOrg") {
      const d = await jtFetch({
        "currentGrant": {
          "user": {
            "id": {},
            "memberships": {
              "nodes": {
                "id": {},
                "organization": { "id": {}, "name": {} }
              }
            }
          }
        }
      });
      return res.status(200).json(d);

    } else if (action === "getJobIds" && orgId) {
      const jobsInput = cursor ? { "after": cursor } : {};
      const d = await jtFetch({
        "currentGrant": {
          "user": {
            "id": {},
            "memberships": {
              "nodes": {
                "id": {},
                "organization": {
                  "id": {},
                  "jobs": {
                    "$": jobsInput,
                    "nextPage": {},
                    "nodes": {
                      "id": {},
                      "name": {},
                      "status": {}
                    }
                  }
                }
              }
            }
          }
        }
      });
      return res.status(200).json(d);

    } else if (action === "getJobStatus" && jobId) {
      const d = await jtFetch({
        "job": {
          "$": { "id": jobId },
          "id": {},
          "customFieldValues": {
            "nodes": {
              "customField": { "name": {} },
              "value": {}
            }
          }
        }
      });
      return res.status(200).json(d);

    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
