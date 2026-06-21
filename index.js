require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");

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
    const casesCollection    = database.collection("cases");
    const lawfirmCollection  = database.collection("lawfirms");

    app.get("/", (req, res) => {
      res.send("Server is running!");
    });

    // GET /api/cases — supports ?lawfirmId=, ?lawyerId=, ?status=, or no filter (returns all)
    app.get("/api/cases", async (req, res) => {
      try {
        const query = {};
        if (req.query.lawfirmId) query.lawfirmId = req.query.lawfirmId;
        if (req.query.lawyerId)  query.lawyerId  = req.query.lawyerId;
        if (req.query.status)    query.status    = req.query.status;
        // No filters = return all cases
        const result = await casesCollection.find(query).toArray();
        res.json(result);
      } catch (err) {
        console.error("GET /api/cases error:", err);
        res.status(500).json({ error: "Failed to fetch cases" });
      }
    });

    // POST /api/cases
    app.post("/api/cases", async (req, res) => {
      try {
        const result = await casesCollection.insertOne(req.body);
        res.json(result);
      } catch (err) {
        console.error("POST /api/cases error:", err);
        res.status(500).json({ error: "Failed to create case" });
      }
    });

    // DELETE /api/cases/:id
    app.delete("/api/cases/:id", async (req, res) => {
      try {
        const { ObjectId } = require("mongodb");
        const result = await casesCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.json(result);
      } catch (err) {
        console.error("DELETE /api/cases/:id error:", err);
        res.status(500).json({ error: "Failed to delete case" });
      }
    });

    // GET /api/lawfirms
    app.get("/api/lawfirms", async (req, res) => {
      try {
        const result = await lawfirmCollection.find({}).toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch lawfirms" });
      }
    });

    // POST /api/lawfirms
    app.post("/api/lawfirms", async (req, res) => {
      try {
        const result = await lawfirmCollection.insertOne(req.body);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to create lawfirm" });
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