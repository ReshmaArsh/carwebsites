import express from "express";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

const app = express();
app.use(express.json());

// --------------------------------------------
// DynamoDB setup
// --------------------------------------------
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);

const TABLE = "ContactsTable";

// --------------------------------------------
// AUTO-INCREMENT (atomic)
// --------------------------------------------
async function getNextId() {
  const result = await client.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { id: "COUNTER" },
      UpdateExpression: "ADD #v :inc",
      ExpressionAttributeNames: { "#v": "value" },
      ExpressionAttributeValues: { ":inc": 1 },
      ReturnValues: "UPDATED_NEW"
    })
  );

  return result.Attributes.value;
}

// --------------------------------------------
// HEALTH CHECK (required by EB)
// --------------------------------------------
app.get("/", (req, res) => {
  res.status(200).send("Elastic Beanstalk Contacts API is running 🚀");
});

// --------------------------------------------
// CREATE CONTACT
// POST /contacts
// --------------------------------------------
app.post("/contacts", async (req, res) => {
  try {
    const { name, phone, email } = req.body;

    const newId = await getNextId();

    const item = {
      id: newId.toString(),
      name,
      phone,
      email
    };

    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: item
      })
    );

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------
// LIST CONTACTS
// GET /contacts
// --------------------------------------------
app.get("/contacts", async (req, res) => {
  try {
    const data = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "id <> :counter",
        ExpressionAttributeValues: {
          ":counter": "COUNTER"
        }
      })
    );

    res.json(data.Items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------
// GET ONE CONTACT
// GET /contacts/:id
// --------------------------------------------
app.get("/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const data = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { id }
      })
    );

    res.json(data.Item || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------
// DELETE CONTACT
// DELETE /contacts/:id
// --------------------------------------------
app.delete("/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await client.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { id }
      })
    );

    res.json({ deleted: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------------------
// START SERVER (MANDATORY FOR EB)
// --------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
