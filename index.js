require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");

    const database = client.db("legal-solutions-db");
    const casesCollection = database.collection("cases");
    const lawfirmCollection = database.collection("lawfirms");
    const usersCollection = database.collection("user");
     const applicationsCollection = database.collection("applications");

    app.get('/api/users', async (req, res) => {
      const cursor = usersCollection.find({});
      const result = await cursor.toArray();
      res.json(result);
    });

    app.get('/api/lawfirms', async (req, res) => {
      const cursor = lawfirmCollection.find({}).skip(1);
      const result = await cursor.toArray();
      res.json(result);
    });

    app.get("/", (req, res) => res.send("Server is running!"));

    // ── CASES ──────────────────────────────────────────
    app.get("/api/cases", async (req, res) => {
      try {
        const query = {};
        if (req.query.lawfirmId) query.lawfirmId = req.query.lawfirmId;
        if (req.query.lawyerId) query.lawyerId = req.query.lawyerId;
        if (req.query.status) query.status = req.query.status;
        const result = await casesCollection.find(query).toArray();
        res.json(result);
      } catch (err) {
        console.error("GET /api/cases error:", err);
        res.status(500).json({ error: "Failed to fetch cases" });
      }
    });

    //     app.post('/api/jobs', async (req, res) => {
    //     const job = req.body;
    //     const newJob = {
    //         ...job,
    //         createdAt: new Date()
    //     }
    //     const result = await jobCollection.insertOne(newJob);
    //     res.send(result);
    // });

    app.post("/api/cases", async (req, res) => {

      const cases = req.body;
      const newCase = {
        ...cases,
        createdAt: new Date()
      }
      const result = await casesCollection.insertOne(newCase);
      res.send(result);
    });

    // Add this in your backend after GET /api/cases
    app.get("/api/cases/:id", async (req, res) => {
      try {
        const result = await casesCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!result) return res.status(404).json({ error: "Case not found" });
        res.json(result);
      } catch (err) {
        console.error("GET /api/cases/:id error:", err);
        res.status(500).json({ error: "Failed to fetch case" });
      }
    });



    app.delete("/api/cases/:id", async (req, res) => {
      try {
        const result = await casesCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.json(result);
      } catch (err) {
        console.error("DELETE /api/cases/:id error:", err);
        res.status(500).json({ error: "Failed to delete case" });
      }
    });

    // ── LAWFIRMS ───────────────────────────────────────
    // ✅ GET with lawyerId filter — this is what the page calls
    app.get("/api/lawfirms", async (req, res) => {
      try {
        const query = {};
        if (req.query.lawyerId) query.lawyerId = req.query.lawyerId;
        const result = await lawfirmCollection.find(query).toArray();
        res.json(result); // always returns JSON array (may be empty [])
      } catch (err) {
        console.error("GET /api/lawfirms error:", err);
        res.status(500).json({ error: "Failed to fetch lawfirms" });
      }
    });

    // ✅ Single POST — duplicate removed
    app.post("/api/lawfirms", async (req, res) => {
      const lawfirm = req.body;
      const newLawfirm = {
        ...lawfirm,
        createdAt: new Date(),
      };
      const result = await lawfirmCollection.insertOne(newLawfirm);
      res.send(result);
    });

    // Add this inside your run() function in index.js

   

    app.post("/api/applications", async (req, res) => {
      try {
        const result = await applicationsCollection.insertOne(req.body);
        res.json(result);
      } catch (err) {
        console.error("POST /api/applications error:", err);
        res.status(500).json({ error: "Failed to submit application" });
      }
    });

    app.get("/api/applications", async (req, res) => {
      try {
        const query = {};
        if (req.query.clientId) query.clientId = req.query.clientId;
        if (req.query.lawyerId) query.lawyerId = req.query.lawyerId;
        if (req.query.caseId) query.caseId = req.query.caseId;
        const result = await applicationsCollection.find(query).toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch applications" });
      }
    });


  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});