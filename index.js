import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGO_URI);

export default async function handler(req, res) {
  try {
    await client.connect();
    const db = client.db("expenseDB");
    const collection = db.collection("expenses");

    if (req.method === "POST") {
      const data = req.body;
      await collection.insertOne(data);
      res.status(200).json({ message: "Expense added successfully!" });
    } 
    else if (req.method === "GET") {
      const expenses = await collection.find({}).toArray();
      res.status(200).json(expenses);
    } 
    else {
      res.status(405).json({ message: "Method not allowed" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}
