const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { verify } = require("node:crypto");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();
const port = process.env.PORT;
const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

async function verifyJWT(req, res, next) {
  const authHeader = req?.headers?.authorization;

  // console.log(JWKS)
  console.log(authHeader)


  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized: Missing Header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Missing Token" });
  }
  console.log('token is', token)

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return res
      .status(403)
      .json({ message: "Forbidden: Invalid Token", detail: error.message });
  }
}

async function run() {
  try {
    await client.connect();

    const db = client.db("DriveFleet");
    const carsCollection = db.collection("cars");
    const bookingCollection = db.collection("carBookings");

    app.post("/cars", async (req, res) => {
      const carsData = req.body;
      const result = await carsCollection.insertOne(carsData);
      res.json(result);
    });

    app.get("/cars",verifyJWT, async (req, res) => {
      try {
        const { search, type, userEmail } = req.query;
        let query = {};

        if (userEmail) {
          query.addedBy = userEmail;
        }

        if (search) {
          query.carName = {
            $regex: search,
            $options: "i",
          };
        }

        if (type && type !== "All") {
          query.carType = type;
        }

        const result = await carsCollection.find(query).toArray();
        res.json(result);
      } catch (error) {
        console.error("Error details:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.get("/cars/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const result = await carsCollection.findOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.patch("/cars/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        const car = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            dailyPrice: Number(updatedData.price),
            description: updatedData.description,
            availabilityStatus: updatedData.availability,
            imageUrl: updatedData.image,
            carType: updatedData.type,
            pickupLocation: updatedData.location,
          },
        };

        const result = await carsCollection.updateOne(car, updateDoc);
        res.json(result);
      } catch (error) {
        console.error("Backend Patch Error:", error);
        res
          .status(500)
          .send({ error: true, message: "Server error during patch update" });
      }
    });

    app.delete("/cars/:id", async (req, res) => {
      const { id } = req.params;
      const result = await carsCollection.deleteOne({ _id: new ObjectId(id) });
    });

    // Bookings here
    app.post("/bookings", verifyJWT, async (req, res) => {
      const bookingData = req.body;
      const carId = bookingData.carId

      if (!carId) {
        return res.status(400).json({ success: false, message: "Missing carId in request body!" })
      }
      const bookingResult = await bookingCollection.insertOne(bookingData);

      const filter = { _id: new ObjectId(carId) };

      const updateDoc = {
        $inc: { booking_count: 1 }
      }

      const carUpdatedResult = await carsCollection.updateOne(filter, updateDoc)
      console.log("Car Updated DB Result:", carUpdatedResult)

      res.status(201).json({
        success: true,
        message: "Booking successful and car count incremented!",
        bookingResult
      });
    });

    app.get("/bookings", verifyJWT, async (req, res) => {
      try {
        const { userEmail } = req.query;
        const result = await bookingCollection.find({ userEmail }).toArray();
        res.json(result);
      } catch (error) {
        console.error("Error Details:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    app.delete("/bookings/:id", async (req, res) => {
      const { id } = req.params;
      const result = await bookingCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.json(result);
    });

    await client.db("DriveFleet").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});