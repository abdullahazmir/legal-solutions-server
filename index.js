require("dotenv").config();
const cors = require("cors");
const express = require("express");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// app.use(cors());

const allowedOrigins = [

  'https://legal-solutions-client.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

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


// routes/cases.js



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
const commentsCollection = database.collection("comments")


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

// in index.js
app.patch("/api/admin/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { role } = req.body;
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { role } }
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed to update role" });
    }
});

// ── CASES ──────────────────────────────────────────────────────────────
app.get("/api/cases", async (req, res) => {
  // console.log('server side query', req.query)
  try {
    const query = {};
    // job filter related query
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { bio: { $regex: req.query.search, $options: 'i' } }
      ]
    }

    if (req.query.location) {
      query.location = req.query.location
    }

    if (req.query.specialization) {
      query.specialization = req.query.specialization
    }

    if (req.query.availability) {
      query.availability = req.query.availability
    }

   

    // pagination related works
    if (req.query.page) {
      const page = req.query.page;
      const perPage = req.query.perPage || 12;
      const skipItems = (page - 1) * perPage

      const total = await casesCollection.countDocuments(query);
      const cursor = casesCollection.find(query).skip(skipItems).limit(perPage);
      const jobs = await cursor.toArray();
      return res.send({ total, jobs });
    }





    // law firm related query

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

// ── USER PROFILE UPDATE ────────────────────────────────────────────────
app.patch("/api/users/:id", verifyToken, async (req, res) => {
  try {
    const { name, photoUrl } = req.body;

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          name,
          photoUrl,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("PATCH /api/users/:id error:", err);
    res.status(500).json({ error: "Failed to update profile" });
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
app.get("/api/lawfirms", verifyToken, async (req, res) => {
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

// In index.js — replace db.collection with database.collection
app.post("/api/comments", verifyToken, verifyClient, async (req, res) => {
  try {
    const { caseId, caseName, lawyerName, comment, rating, applicationId } = req.body;

    const application = await applicationsCollection.findOne({
      _id: new ObjectId(applicationId),
      clientId: req.user._id.toString(),
      caseId: caseId,
    });

    if (!application) {
      return res.status(403).json({ message: "You can only comment on cases you applied to" });
    }

    const result = await database.collection("comments").insertOne({  // ← database not db
      caseId,
      caseName,
      lawyerName,
      applicationId,
      comment,
      rating: Number(rating),
      clientId: req.user._id.toString(),
      clientName: req.user.name,
      clientEmail: req.user.email,
      createdAt: new Date(),
    });

    res.json(result);
  } catch (err) {
    console.error("POST /api/comments error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

app.get("/api/comments", async (req, res) => {
  try {
    const query = {};
    if (req.query.caseId)        query.caseId        = req.query.caseId;
    if (req.query.clientId)      query.clientId      = req.query.clientId;
    if (req.query.applicationId) query.applicationId = req.query.applicationId;

    const result = await database.collection("comments")  // ← database not db
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.json(result);
  } catch (err) {
    console.error("GET /api/comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
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

