const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 5000
const app = express()

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j8csd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const jobCollection = client.db('soloDB').collection('jobs');
    const bidsCollection = client.db('soloDB').collection('bids');

    app.get('/allJobs', async(req, res)=>{
      const result = await jobCollection.find().toArray();
      res.send(result);
    })

    app.get('/allJobs/:email', async(req, res)=>{
      const email = req.params.email;
      console.log(email);
      const query = {'buyer.email':email};
      const result = await jobCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/job/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await jobCollection.findOne(query);
      res.send(result);
    })

    app.post('/addJob', async(req, res)=>{
      console.log(req.body);
      const recevedData = req.body;
      const result = await jobCollection.insertOne(recevedData);
      res.send(result);
      console.log(result)
    })

    app.put('/update/:id', async(req, res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const jobdata = req.body
      const options = {upsert:true}
      const updateData ={
        $set: jobdata
      }
      const result = await jobCollection.updateOne(filter, updateData, options);
      res.send(result);
      console.log(result)
    })

    app.delete('/job/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await jobCollection.deleteOne(query);
      res.send(result);
    })

    console.log('Pinged your deployment. You successfully connected to MongoDB!')
  }
  finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
