import { MongoClient } from "mongodb";
import { faker } from "@faker-js/faker";

// If your Node doesn't support top-level await, wrap main() call in an async IIFE.
// This script uses top-level await for brevity.

const TMDB_API_KEY = '26bb23036279f7330057f23d5887bc64';
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/movies_db";

if (!TMDB_API_KEY) {
  console.error("Please set TMDB_API_KEY environment variable.");
  process.exit(1);
}

const TMDB_BASE = "https://api.themoviedb.org/3";
const MAX_MOVIES = 50;       // how many movies to fetch total (configurable)
const CAST_LIMIT = 20;        // top N cast members to keep per movie
const DELAY_MS = 550;        // simple throttle between requests to avoid rate limits

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Fetch error ${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

async function fetchPopularMovies(page = 1) {
  const url = `${TMDB_BASE}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`;
  return fetchJson(url);
}

async function fetchMovieCredits(movieId) {
  const url = `${TMDB_BASE}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}&language=en-US`;
  return fetchJson(url);
}

async function main() {
  const client = new MongoClient(MONGO_URI, {});

  try {
    await client.connect();
    const db = client.db(); // uses DB from URI or default 'test'
    const moviesCol = db.collection("movies");
    const actorsCol = db.collection("actors");

    // Clear existing (optional)
    await moviesCol.deleteMany({});
    await actorsCol.deleteMany({});

    let movies = [];
    let actorsMap = new Map(); // tmdbPersonId => { localId, name, movies: Set }

    let movieLocalId = 1;
    let actorLocalId = 1;

    let page = 1;
    while (movies.length < MAX_MOVIES) {
      const list = await fetchPopularMovies(page);
      await sleep(DELAY_MS);

      for (const m of list.results) {
        if (movies.length >= MAX_MOVIES) break;

        // fetch credits for this movie
        let credits;
        try {
          credits = await fetchMovieCredits(m.id);
          await sleep(DELAY_MS);
        } catch (err) {
          console.warn(`Failed to fetch credits for movie ${m.id} (${m.title}): ${err.message}`);
          credits = { cast: [] };
        }

        // take top CAST_LIMIT cast members
        const cast = (credits.cast || []).slice(0, CAST_LIMIT);

        const castLocalIds = [];
        for (const c of cast) {
          const tmdbPersonId = c.id;
          if (!actorsMap.has(tmdbPersonId)) {
            // create new actor entry using TMDB name and add some faker data
            const local = {
              localId: actorLocalId++,
              name: c.name || faker.person.fullName(),
              tmdbId: tmdbPersonId,
              movies: new Set()
            };
            actorsMap.set(tmdbPersonId, local);
          }
          const actorEntry = actorsMap.get(tmdbPersonId);
          actorEntry.movies.add(movieLocalId); // add local movie id
          castLocalIds.push(actorEntry.localId);
        }

        // simple movie doc
        const movieDoc = {
          id: movieLocalId,                 // local id (1..n)
          tmdbId: m.id,                     // original TMDB id (optional)
          title: m.title || m.original_title,
          castors: castLocalIds
        };

        movies.push(movieDoc);
        movieLocalId++;
      }

      if (!list.total_pages || page >= list.total_pages) break;
      page++;
    }

    // Build actor array from actorsMap
    const actors = Array.from(actorsMap.values()).map((a) => ({
      id: a.localId,
      name: a.name,
      popularity: a.popularity,
      gender: a.gender,
      movies: Array.from(a.movies).sort((x, y) => x - y),
      bio: faker.lorem.paragraph({ min: 1, max: 3 })
    }));

    console.log(`Prepared ${movies.length} movies and ${actors.length} actors.`);

    // Insert into MongoDB (use ordered:false so one bad doc won't stop the rest)
    if (movies.length) {
      const resM = await moviesCol.insertMany(movies, { ordered: false });
      console.log(`Inserted ${resM.insertedCount} movies.`);
    }

    if (actors.length) {
      const resA = await actorsCol.insertMany(actors, { ordered: false });
      console.log(`Inserted ${resA.insertedCount} actors.`);
    }

    console.log("Done.");
  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("Unhandled error:", e);
  process.exit(1);
});

