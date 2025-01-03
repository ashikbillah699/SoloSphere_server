const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 5000
const app = express()

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
}))
app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j8csd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

// verify jwt middleware

const verifyToken = (req, res, next) => {

  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: 'Unauthorized access!!' })

  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) return res.status(401).send({ message: 'Unauthorized access' });
    req.user = decoded;
  })

  next();
}

async function run() {
  try {
    const jobCollection = client.db('soloDB').collection('jobs');
    const bidsCollection = client.db('soloDB').collection('bids');

    // jwt api

    app.post('/jwt', async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.SECRET_TOKEN, { expiresIn: '365d' });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
        })
        .send({ success: true })
    })

    // clear jwt token
    app.get('/logOut', async (req, res) => {
      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
        .send({ success: true })
    })

    app.get('/allJobs', async (req, res) => {
      const result = await jobCollection.find().toArray();
      res.send(result);
    })

    app.get('/allJbosFilter', async (req, res) => {
      const filter = req.query.filter;
      const search = req.query.search;
      const sort = req.query.sort;
      let options = {};
      if (sort) {
        options = { sort: { deadline: sort === 'asc' ? 1 : -1 } }
      }
      const query = {
        title: {
          $regex: search,
          $options: 'i'
        }
      };
      if (filter) {
        query.category = filter
      }
      const result = await jobCollection.find(query, options).toArray();
      res.send(result);
    })

    app.get('/allJobs/:email', async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const query = { 'buyer.email': email };
      const result = await jobCollection.find(query).toArray();
      res.send(result);
    })

    app.get('/bids/:email', verifyToken, async (req, res) => {
      const decodedEmail = req.user?.email;
      const isBuyer = req.query.buyer
      const email = req.params.email;
      // console.log('decodedEmail', decodedEmail);
      // console.log(email)
      if(decodedEmail !== email){
        return res.status(401).send({message: 'Forbiden access!!'});
      }

      let query = {}
      if (isBuyer) {
        query.buyer = email;
      } else {
        query.email = email
      }
      const result = await bidsCollection.find(query).toArray();
      res.send(result);
    })

    app.patch('/bidStatusUpdate/:id', async (req, res) => {
      const id = req.params.id;
      const { currentStatus } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: currentStatus
        }
      }
      const result = await bidsCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    app.get('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobCollection.findOne(query);
      res.send(result);
    })

    app.post('/addJob', async (req, res) => {
      console.log(req.body);
      const recevedData = req.body;
      const result = await jobCollection.insertOne(recevedData);
      res.send(result);
      console.log(result)
    })

    app.post('/bidJob', async (req, res) => {
      const recevedData = req.body;
      const query = { email: recevedData.email, jobId: recevedData.jobId }
      const alreadyExist = await bidsCollection.findOne(query)
      console.log(alreadyExist)
      if (alreadyExist) return res.status(401).send({ message: 'You have already placed a bid on this job' });
      const result = await bidsCollection.insertOne(recevedData);
      const filter = { _id: new ObjectId(recevedData.jobId) };

      const jobData = await jobCollection.findOne(filter);
      if (jobData && typeof jobData.bid_count !== "number") {
        await jobCollection.updateOne(filter, { $set: { bid_count: parseInt(jobData.bid_count) || 0 } });
      }
      const updateData = {
        $inc: { bid_count: 1 }
      };
      const updateBitCount = await jobCollection.updateOne(filter, updateData)
      res.send(result);
      console.log(result)
    })

    app.put('/update/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const jobdata = req.body
      const options = { upsert: true }
      const updateData = {
        $set: jobdata
      }
      const result = await jobCollection.updateOne(filter, updateData, options);
      res.send(result);
      console.log(result)
    })

    app.delete('/job/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
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
