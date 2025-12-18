import { MongoClient } from "mongodb";
import { faker } from "@faker-js/faker";

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function seeData() {
  try {
    await client.connect();
    const db = client.db("relationshop");
    const usersCol = db.collection("users");
    const locationsCol = db.collection("locations");

    await usersCol.deleteMany({});
    await locationsCol.deleteMany({});

    // ---- CREATE LOCATIONS ----
    const locations = Array.from({ length: 100 }).map((_, i) => ({
      _id: i + 1, // ⭐ FIXED
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        country: faker.location.country(),
        zipcode: faker.location.zipCode(),
      },
    }));

    await locationsCol.insertMany(locations);

    // ---- CREATE USERS ----
    const users = Array.from({ length: 10 }).map((_, i) => ({
      _id: i + 1,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      status: faker.helpers.arrayElement(["active", "inactive"]),
      locationIds: faker.helpers.arrayElements(
        locations.map((l) => l._id), // now works!
        faker.number.int({ min: 2, max: 5 })
      ),
    }));

    await usersCol.insertMany(users);

    console.log("Dummy data generated successfully");
  } catch (err) {
    console.error("Error seeding data:", err);
  } finally {
    await client.close();
  }
}

seeData();
