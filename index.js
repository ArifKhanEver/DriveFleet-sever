const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
app.use(cors())
app.use(express.json())
dotenv.config()
const port = process.env.PORT
const uri = process.env.MONGODB_URI;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    
    const db = client.db('DriveFleet')
    const carsCollection = db.collection('cars')

    app.post('/cars', async(req, res)=>{
        const carsData = req.body
        console.log(carsData)
        const result = carsCollection.insertOne(carsData)
        res.json(result)
    })

    app.get('/cars', async(req, res)=>{
        const result = await carsCollection.find().toArray()
        res.json(result)
    })

    app.get('/cars/:id', async(req, res)=>{
        const id = req.params.id
        const result = await carsCollection.findOne({_id: new ObjectId(id)})
        res.json(result)
    })
    
    await client.db("DriveFleet").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});