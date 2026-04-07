export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const GRANT_KEY = "22TM6dKUXmnEfBfnz8W2J5CneTTjQetHDC";

  try {
    const { action, orgId, cursor } = req.body || {};

    let query;

    if (action === "getOrg") {
      query = {
        "$": { "grantKey": GRANT_KEY },
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
      };
    } else if (action === "getJobs" && orgId) {
      query = {
        "$": { "grantKey": GRANT_KEY },
        "currentGrant": {
          "user": {
            "id": {},
            "memberships": {
              "nodes": {
                "id": {},
                "organization": {
                  "id": {},
                  "jobs": {
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
      };
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    const response = await fetch("https://api.jobtread.com/pave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: text });
    }

    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}



