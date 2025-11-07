import { MongoClient } from "mongodb";
import { faker } from "@faker-js/faker";

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function seedUserLocation() {
  try {
    await client.connect();
    const db = client.db("mydb");

    const usersCol = db.collection("users");
    const locationsCol = db.collection("locations");

    // Clear old data
    await usersCol.deleteMany({});
    await locationsCol.deleteMany({});

    // Generate 10 locations
    const locations = Array.from({ length: 10 }).map((_, i) => ({
      _id: i + 1,
      userId: i + 1,
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        country: "Cambodia",
        zipcode: faker.location.zipCode()
      }
    }));

    await locationsCol.insertMany(locations);

    // Generate 10 users referencing locationId
    const users = locations.map(loc => ({
      _id: loc.userId,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      status: faker.helpers.arrayElement(["active", "inactive"]),
      locationId: loc._id
    }));

    await usersCol.insertMany(users);

    console.log("✅ User–Location one-to-one data generated successfully!");
  } catch (err) {
    console.error("❌ Error seeding data:", err);
  } finally {
    await client.close();
  }
}

seedUserLocation();