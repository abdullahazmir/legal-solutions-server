require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const logger = (req, res, next) => {
  console.log('logger middleware logged', req.params)
  next();
}



const client = new MongoClient(process.env.MONGO_DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// async function run() {
//   try {
//     await client.connect();

// await client.db("admin").command({ ping: 1 });
// console.log("Connected to MongoDB!");

client.connect(() => {
  console.log('another way to connect to mongoDB')
}).catch(console.dir)

const database = client.db("legal-solutions-db");
const casesCollection = database.collection("cases");
const lawfirmCollection = database.collection("lawfirms");
const usersCollection = database.collection("user");
const applicationsCollection = database.collection("applications");
const plansCollection = database.collection("plans");
const subscriptionCollection = database.collection("subscriptions");
const sessionCollection = database.collection("session");
const saveCasesCollection = database.collection("savecases")

// verification...................

const verifyToken = async (req, res, next) => {
  console.log('headers from call', req.headers);
  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  const query = { token: token }
  const session = await sessionCollection.findOne(query);

   if (!session) {
    return res.status(401).send({ message: 'unauthorized access' })
  }

  const userId = session.userId

  const userQuery = {
    _id: userId
  }
  const user = await usersCollection.findOne(userQuery)

   if (!user) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  req.user = user
  next()
}

// must be after verify the token

const verifyClient = async (req, res, next) => {
  if (req.user?.role !== 'client') {
    return res.status(403).send({ message: 'forbidden access' })
  };
  next()
}

const verifyLawyer = async (req, res, next) => {
  if (req.user?.role !== 'lawyer') {
    return res.status(403).send({ message: 'forbidden access' })
  };
  next()
}

// must be after very token


const verifyAdmin = async (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).send({ message: 'forbidden access' })
  };
  next()
}



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
    if (req.query.lawyerId) query.lawyerId = req.query.lawyerId;
    if (req.query.status) query.status = req.query.status;
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
app.get("/api/lawfirms",verifyToken, verifyAdmin, async (req, res) => {
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


app.patch('/api/lawfirms/:id', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const updatedLawFirm = req.body;
  const filter = { _id: new ObjectId(id) }
  const updatedDoc = {
    $set: {
      status: updatedLawFirm.status
    }
  }
  const result = await lawfirmCollection.updateOne(filter, updatedDoc)
  res.send(result);
})

// ── APPLICATIONS ───────────────────────────────────────────────────────
app.get("/api/applications", verifyToken, verifyClient, async (req, res) => {
  try {
    const query = {};
    if (req.query.clientId) query.clientId = req.query.clientId;
    if (req.query.lawyerId) query.lawyerId = req.query.lawyerId;
    if (req.query.caseId) query.caseId = req.query.caseId;

    // check whether asking for user information or someone else

    console.log(req.user, req.query.clientId)
    if (req.user._id.toString() !== req.query.clientId) {
      return res.status(403).send({ message: 'forbidden access' })

    }
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

    const result = await subscriptionCollection.insertOne({
      ...req.body,
      createdAt: new Date(),
    });

    const updatedResult = await usersCollection.updateOne(
      { email: email },
      { $set: { plan: planId } }
    );

    res.json({ subscriptionResult: result, userUpdate: updatedResult });
  } catch (err) {
    console.error("POST /api/subscriptions error:", err);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});   // ← subscriptions closes here

// ── SAVE CASES ─────────────────────────────────────────────────────────
app.post("/api/savecases", verifyToken, verifyClient, async (req, res) => {
  try {
    const { caseId, name, specialization, location, consultationFee, currency, photoUrl, availability } = req.body;

    const existing = await saveCasesCollection.findOne({
      caseId,
      userId: req.user._id.toString()
    });
    if (existing) return res.status(409).json({ error: "Already saved" });

    const result = await saveCasesCollection.insertOne({
      caseId,
      userId: req.user._id.toString(),
      name,
      specialization,
      location,
      consultationFee,
      currency,
      photoUrl,
      availability,
      savedAt: new Date(),
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to save case" });
  }
});

app.get("/api/savecases", verifyToken, verifyClient, async (req, res) => {
  try {
    const result = await saveCasesCollection.find({
      userId: req.user._id.toString()
    }).toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch saved cases" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;