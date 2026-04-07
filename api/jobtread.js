export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const GRANT_KEY = "22TM6dKUXmnEfBfnz8W2J5CneTTjQetHDC";

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
    const { action, orgId } = req.body || {};

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
    }

    if (action === "getJobs" && orgId) {
      // Fetch only non-archived jobs with ONLY their Status custom field
      // Uses the "with" pattern from JobTread docs to filter customFieldValues
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
                    "$": {
                      "where": [["status", "!=", "archived"]]
                    },
                    "nodes": {
                      "id": {},
                      "name": {},
                      "customFieldValues": {
                        "nodes": {
                          "customField": { "name": {} },
                          "value": {}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Filter the response server-side: only return the Status field value per job
      // This drastically reduces response size before sending to browser
      const memberships = d?.currentGrant?.user?.memberships?.nodes || [];
      const org = memberships[0];
      const jobs = org?.organization?.jobs?.nodes || [];

      const slim = jobs.map(job => {
        const cfvs = job.customFieldValues?.nodes || [];
        const statusField = cfvs.find(c =>
          c.customField?.name?.toLowerCase() === "status"
        );
        return {
          id: job.id,
          name: job.name,
          status: statusField?.value || null
        };
      });

      return res.status(200).json({ jobs: slim });
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
