// app.js
const { MongoClient } = require("mongodb");
const { faker } = require("@faker-js/faker");

// change if needed: mongodb://localhost:27017 or your Atlas URI
const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "mydb";
const COLL = process.env.COLL || "users";

function makeUser() {
  return {
    name: faker.name.fullName(),
    email: faker.internet.email(),
    age: faker.datatype.number({ min: 16, max: 40 }),
    phone: faker.phone.number(),
    gpa: faker.datatype.float({min:2.2, max: 3.8}),
    address: {
      city: faker.address.city(),
      country: faker.address.country(),
    },
    major: faker.helpers.arrayElement([
      "IT",
      "Design",
      "Digital Marketing",
      "Law",
      "Accounting",
      "Bus",
    ]),
    registeredAt: faker.date.past(),
    isActive: faker.datatype.boolean(),
  };
}

function makeN(n, factory) {
  return Array.from({ length: n }, factory);
}

async function run() {
  const count = Number(process.argv[2] || 20); // allow: node app.js 100
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const col = client.db(DB_NAME).collection(COLL);

    // optional: clean first
    // await col.deleteMany({});

    const docs = makeN(count, makeUser);
    const res = await col.insertMany(docs);
    console.log(`✅ Inserted ${res.insertedCount} docs into ${DB_NAME}.${COLL}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.close();
  }
}

run();

// node app.js 20000