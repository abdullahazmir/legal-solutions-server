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

    const database             = client.db("legal-solutions-db");
    const casesCollection      = database.collection("cases");
    const lawfirmCollection    = database.collection("lawfirms");
    const usersCollection      = database.collection("user");
    const applicationsCollection = database.collection("applications");
    const plansCollection      = database.collection("plans");
    const subscriptionCollection = database.collection("subscriptions");

    app.get("/", (req, res) => res.send("Server is running!"));

    // ── USERS ──────────────────────────────────────────────────────────────
    app.get("/api/users", async (req, res) => {
      try {
        const result = await usersCollection.find({}).toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    // ── CASES ──────────────────────────────────────────────────────────────
    app.get("/api/cases", async (req, res) => {
      try {
        const query = {};
        if (req.query.lawfirmId) query.lawfirmId = req.query.lawfirmId;
        if (req.query.lawyerId)  query.lawyerId  = req.query.lawyerId;
        if (req.query.status)    query.status    = req.query.status;
        const result = await casesCollection.find(query).toArray();
        res.json(result);
      } catch (err) {
        console.error("GET /api/cases error:", err);
        res.status(500).json({ error: "Failed to fetch cases" });
      }
    });

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

    app.post("/api/cases", async (req, res) => {
      try {
        const result = await casesCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });
        res.json(result);
      } catch (err) {
        console.error("POST /api/cases error:", err);
        res.status(500).json({ error: "Failed to create case" });
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

    // ── LAWFIRMS ───────────────────────────────────────────────────────────
    // ✅ Single route — supports optional ?lawyerId= filter
    app.get("/api/lawfirms", async (req, res) => {
      try {
        const query = {};
        if (req.query.lawyerId) query.lawyerId = req.query.lawyerId;
        const result = await lawfirmCollection.find(query).toArray();
        res.json(result);
      } catch (err) {
        console.error("GET /api/lawfirms error:", err);
        res.status(500).json({ error: "Failed to fetch lawfirms" });
      }
    });

    app.post("/api/lawfirms", async (req, res) => {
      try {
        const result = await lawfirmCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });
        res.json(result);
      } catch (err) {
        console.error("POST /api/lawfirms error:", err);
        res.status(500).json({ error: "Failed to create lawfirm" });
      }
    });

    // ── APPLICATIONS ───────────────────────────────────────────────────────
    app.get("/api/applications", async (req, res) => {
      try {
        const query = {};
        if (req.query.clientId) query.clientId = req.query.clientId;
        if (req.query.lawyerId) query.lawyerId = req.query.lawyerId;
        if (req.query.caseId)   query.caseId   = req.query.caseId;
        const result = await applicationsCollection.find(query).toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch applications" });
      }
    });

    app.post("/api/applications", async (req, res) => {
      try {
        const result = await applicationsCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });
        res.json(result);
      } catch (err) {
        console.error("POST /api/applications error:", err);
        res.status(500).json({ error: "Failed to submit application" });
      }
    });

    // ── PLANS ──────────────────────────────────────────────────────────────
    // ✅ Single route — no duplicate
    app.get("/api/plans", async (req, res) => {
      try {
        const { plan_id } = req.query;

        if (!plan_id) {
          return res.status(400).json({ error: "plan_id is required" });
        }

        const plan = await plansCollection.findOne({ id: plan_id });

        if (!plan) {
          // Safe default so the page never crashes
          return res.json({ name: "Basic", id: plan_id, maxAppPerMonth: 3 });
        }

        res.json(plan);
      } catch (err) {
        console.error("GET /api/plans error:", err);
        res.status(500).json({ error: "Failed to fetch plan" });
      }
    });

    // ── SUBSCRIPTIONS ──────────────────────────────────────────────────────
    app.post("/api/subscriptions", async (req, res) => {
      try {
        const { email, planId } = req.body;

        // 1. Save subscription record
        const result = await subscriptionCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });

        // 2. ✅ Update user's plan — was using data.info (wrong), now data.email
        const updatedResult = await usersCollection.updateOne(
          { email: email },          // ← fixed: was { email: data.info }
          { $set: { plan: planId } }
        );

        console.log(`Plan updated for ${email} → ${planId}`, updatedResult);

        res.json({ subscriptionResult: result, userUpdate: updatedResult });
      } catch (err) {
        console.error("POST /api/subscriptions error:", err);
        res.status(500).json({ error: "Failed to create subscription" });
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