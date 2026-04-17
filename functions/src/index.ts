import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const bodyParser = require('body-parser');
const OpenAI = require('openai');

dotenv.config();

// Initialize Firebase Admin SDK
admin.initializeApp();

// Get references to services
const database = admin.database();
const storage = admin.storage().bucket();



  const app = express();

// Setup multer for old routes
global.XMLHttpRequest = require("xhr2");
const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage });

// MODERN PHOTO UPLOAD - Using base64 JSON (no multer needed!)
app.post("/orbit/uploadPhoto", cors({ origin: true }), express.json({limit: '50mb'}), (req:any, res:any) => {
  console.log("📤 UPLOAD PHOTO REQUEST (base64)");

  const { image, userId } = req.body;

  if (!image || !userId) {
    console.log("Missing image or userId");
    res.status(400).send("Missing image or userId");
    return;
  }

  try {
    // Extract base64 data and convert to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    console.log("📤 Buffer created, size:", buffer.length, "bytes");

    const timestamp = Date.now();
    const fileName = `orbit-photos/${userId}/${timestamp}.jpg`;

    const fileUpload = storage.file(fileName);
    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: 'image/jpeg'
      }
    });

    blobStream.on('error', (error) => {
      console.log("Error uploading photo:", error.message);
      res.status(500).send(error.message);
    });

    blobStream.on('finish', async () => {
      try {
        // Make the file publicly accessible
        await fileUpload.makePublic();

        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${storage.name}/${fileName}`;
        console.log('📤 Photo available at', publicUrl);
        res.send(publicUrl);
      } catch (error: any) {
        console.error('Error making file public:', error);
        res.status(500).send(error.message);
      }
    });

    blobStream.end(buffer);
  } catch (error: any) {
    console.error("Error processing image:", error);
    res.status(500).send(error.message);
  }
});

// save an image that a user has uploaded (for moodboard)
app.post("/saveImage", cors({ origin: true }), upload.single("file"), (req:any, res:any) => {
    const file = req.file;
    console.log("FILE", file)
    console.log("FILE", req.file)
    const obj = JSON.parse(JSON.stringify(req.body))
    console.log("FILE", obj)
    console.log("req", req);

    let fileNameEnd = "";

    if(req.body.mimetype == 'image/jpeg') {
        fileNameEnd = ".jpg"
    }
    else if(req.body.mimetype == 'image/png') {
        fileNameEnd = ".png"
    }

    let fileName = "images/" + req.body.pageId + "/" + req.body.blockId + fileNameEnd

    const fileUpload = storage.file(fileName);
    const blobStream = fileUpload.createWriteStream({
        metadata: {
            contentType: file.mimetype
        }
    });

    blobStream.on('error', (error) => {
        console.log(error.message);
        res.status(500).send(error.message);
    });

    blobStream.on('finish', () => {
        fileUpload.getSignedUrl({
            action: 'read',
            expires: '03-01-2500'
        }).then((urls) => {
            console.log('File available at', urls[0]);
            res.send(urls[0]);
        });
    });

    blobStream.end(file.buffer);
});

// GLOBAL MIDDLEWARE - Applied to all OTHER routes
app.use(cors({ origin: true }));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true, parameterLimit: 1000000}));
app.use(express.json());

  app.get("/", (req:any, res:any) => {
    res.send("working fine");
  });

  app.get("/getUser/:userId", (req:any, res:any) => {
    const userId = req.params.userId

    database.ref('userCollection/' + userId).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userInfo = snapshot.val();
                res.send(userInfo)
                console.log("obj", userInfo)
            }
            else {
                console.log("No data available");
            }
        })
        .catch((error) => {
            console.error(error);
        });
});

app.get("/getPage/:pageId", (req:any, res:any) => {
    const pageId = req.params.pageId;
    console.log("pageId:", pageId)

    database.ref('pages/' + pageId).once('value')
        .then((snapshot) => {
            console.log(snapshot);
            if (snapshot.exists()) {
                const pageInfo = snapshot.val();
                res.send(pageInfo)
                console.log("obj", pageInfo)
            }
            else {
                console.log("No data available");
                res.send(snapshot.val());
            }
        })
        .catch((error) => {
            console.error(error);
        });
});

app.post("/savePage/:pageId", (req:any, res:any) => {
    console.log("START SAVE REQ")
    const pageId = req.params.pageId
    let reqBody = req.body
    console.log(req.body);

    database.ref('pages/' + pageId).set({
        name: reqBody.name,
        userId: reqBody.userId,
        blockMap: reqBody.blockMap,
        auth: reqBody.auth
    });

    res.send("success")
});
  
  
  app.post("/createPage", (req:any, res:any) => {
    console.log("START CREATE PAGE 📜", req.body)

    const pageId = req.body.pageId
    const pageName = req.body.name
    const userId = req.body.userId
    const blockMap = req.body.blockMap
    const auth = req.body.auth

    let pagesUpdate = {
        name: pageName,
        userId: userId,
        blockMap: blockMap,
        auth: auth
    }

    const creationDate = new Date().toISOString();
    const pageMeta = {
        name: pageName,
        createdAt: creationDate
    };

    const updates: any = {};
    updates['/pages/' + pageId] = pagesUpdate;
    updates['/userCollection/' + userId + '/pages/' + pageId] = pageMeta;
    database.ref().update(updates)
        .then((r) => {
            console.log("update success")
            res.send("success")
        })
        .catch((e) => {
            console.log("error saving data", e)
        })
});


app.get("/checkHandleIsFree/:handle", (req:any, res:any) => {
    const handle = req.params.handle

    database.ref('handleStore/' + handle).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userInfo = snapshot.val();
                res.send(userInfo)
                console.log("handle is not free:", userInfo)
            }
            else {
                res.send("handle is free")
                console.log("handle is free")
            }
        })
        .catch((error) => {
            console.error(error);
        });
});


app.post("/createHandle", (req:any, res:any) => {
    console.log("START CREATE HANDLE ＠", req.body)

    const userId = req.body.userId
    const handle = req.body.handle

    database.ref('userCollection/' + userId).set({
        "handle": handle,
    });

    const updates: any = {};
    updates['handleStore/' + handle] = userId;
    console.log("in theory. handle created");
    database.ref().update(updates)
        .then((r) => {
            console.log("update success")
            res.send("success")
        })
        .catch((e) => {
            console.log("error saving data", e)
        })
});


app.get("/getUserId/:handle", (req:any, res:any) => {
    const handle = req.params.handle
    console.log("/getUserId/:handle request 🍻")

    database.ref('handleStore/' + handle).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userInfo = snapshot.val();
                res.send(userInfo)
                console.log("info sent:", userInfo)
            }
            else {
                res.send("handle does not exist")
                console.log("handle does not exist")
            }
        })
        .catch((error) => {
            console.error(error);
        });
});


// const PORT = process.env.FB_PORT || 8080; // Use this instead of hardcoding it like before

// app.listen(PORT, () => {
// console.log(`Server listening on port ${PORT}`);
// });


// ============================================
// ORBIT MAC EMULATOR ENDPOINTS
// ============================================

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: functions.config().openai.key
});

// Create guestbook entry
app.post("/orbit/guestbook", (req:any, res:any) => {
  console.log("CREATE GUESTBOOK ENTRY", req.body);

  const { handle, userId, message, photoUrl, gardenPageId } = req.body;

  if (!handle || !userId || !message) {
    res.status(400).send("Missing required fields");
    return;
  }

  const timestamp = Date.now();
  const entryId = `entry-${timestamp}-${userId}`;

  const entry = {
    handle,
    userId,
    message,
    photoUrl: photoUrl || null,
    gardenPageId: gardenPageId || null,
    timestamp
  };

  database.ref(`orbit-guestbook/${entryId}`).set(entry)
    .then(() => {
      console.log("Guestbook entry created");
      res.send({ id: entryId, ...entry });
    })
    .catch((error) => {
      console.error("Error creating guestbook entry:", error);
      res.status(500).send(error.message);
    });
});

// Get all guestbook entries
app.get("/orbit/guestbook", (req:any, res:any) => {
  database.ref('orbit-guestbook').once('value')
    .then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const entries = Object.entries(data).map(([id, entry]: [string, any]) => ({
          id,
          ...entry
        }));

        // Sort by timestamp, newest first
        entries.sort((a: any, b: any) => b.timestamp - a.timestamp);

        res.send(entries);
      } else {
        res.send([]);
      }
    })
    .catch((error) => {
      console.error("Error getting guestbook entries:", error);
      res.status(500).send(error.message);
    });
});

// Delete guestbook entry
app.delete("/orbit/guestbook/:entryId", (req:any, res:any) => {
  const entryId = req.params.entryId;
  const userId = req.body.userId;

  if (!userId) {
    res.status(400).send("Missing userId");
    return;
  }

  // First, verify the entry belongs to this user
  database.ref(`orbit-guestbook/${entryId}`).once('value')
    .then((snapshot) => {
      if (!snapshot.exists()) {
        res.status(404).send("Entry not found");
        return;
      }

      const entry = snapshot.val();
      if (entry.userId !== userId) {
        res.status(403).send("Not authorized to delete this entry");
        return;
      }

      // Delete the entry
      database.ref(`orbit-guestbook/${entryId}`).remove()
        .then(() => {
          console.log("Guestbook entry deleted");
          res.send("success");
        })
        .catch((error) => {
          console.error("Error deleting entry:", error);
          res.status(500).send(error.message);
        });
    })
    .catch((error) => {
      console.error("Error verifying entry:", error);
      res.status(500).send(error.message);
    });
});

// AI Chat Assistant
app.post("/orbit/chat", async (req:any, res:any) => {
  console.log("ORBIT CHAT REQUEST", req.body);

  const { message } = req.body;

  if (!message) {
    res.status(400).send("Missing message");
    return;
  }

  const systemPrompt = `You are a helpful assistant for adhiv's orbital mac emulator website. You can answer questions about the site and its apps.

Available apps:
- [Photo Booth] - Take photos with webcam effects
- [Garden] - Plant and grow a virtual garden, water plants daily
- [Guestbook] - Leave messages for others to see
- [in orbit] - Music player with 6 original songs by adhiv
- [MacPaint] - Draw and create pixel art
- [orbit.tv] - Watch videos
- [File Browser] - Browse files and folders
- [adhiv.com] - Visit adhiv's personal website

When mentioning an app that a user should open or interact with, wrap the app name in [square brackets] like [Photo Booth]. The frontend will make these clickable links.

Keep responses concise (under 500 characters) and friendly.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;
    console.log("AI Response:", aiResponse);

    res.send({ response: aiResponse });
  } catch (error: any) {
    console.error("OpenAI Error:", error);
    res.status(500).send(error.message);
  }
});

// ============================================
// CLAUDE API PROXY (Terminal app)
// ============================================

// In-memory rate limiting per user
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

const ALLOWED_MODELS = ['claude-sonnet-4-20250514'];
const MAX_TOKENS_CAP = 4096;

app.post("/orbit/claude", async (req: any, res: any) => {
  // Require Firebase Auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send("Unauthorized: login required");
    return;
  }

  let userId: string;
  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error) {
    res.status(401).send("Unauthorized: invalid token");
    return;
  }

  // Rate limit
  if (!checkRateLimit(userId)) {
    res.status(429).send("Rate limit exceeded. Try again in a minute.");
    return;
  }

  const { model, max_tokens, system, messages, tools } = req.body;

  // Enforce allowed models
  if (!model || !ALLOWED_MODELS.includes(model)) {
    res.status(400).send(`Model not allowed. Allowed: ${ALLOWED_MODELS.join(', ')}`);
    return;
  }

  // Enforce max tokens cap
  const cappedMaxTokens = Math.min(max_tokens || MAX_TOKENS_CAP, MAX_TOKENS_CAP);

  const claudeApiKey = functions.config().claude?.key;
  if (!claudeApiKey) {
    console.error("Claude API key not configured in functions config");
    res.status(500).send("Claude API key not configured");
    return;
  }

  try {
    const body: any = {
      model,
      max_tokens: cappedMaxTokens,
      messages
    };
    if (system) body.system = system;
    if (tools) body.tools = tools;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Claude API error:", data);
      res.status(response.status).send(data);
      return;
    }

    res.json(data);
  } catch (error: any) {
    console.error("Claude proxy error:", error);
    res.status(500).send(error.message);
  }
});

// OrbitRun Game Leaderboard
// Save score (authenticated)
app.post("/saveScore", cors({ origin: true }), express.json(), async (req:any, res:any) => {
  console.log("SAVE SCORE REQUEST", req.body);

  const { handle, score } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send("Unauthorized");
    return;
  }

  if (!handle || score === undefined) {
    res.status(400).send("Missing handle or score");
    return;
  }

  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    console.log("User authenticated:", userId, handle);

    // Get user's current high score
    const userScoresRef = database.ref(`orbitrun-scores/${userId}`);
    const snapshot = await userScoresRef.once('value');
    const currentHighScore = snapshot.val()?.highScore || 0;

    // Only update if new score is higher
    if (score > currentHighScore) {
      await userScoresRef.set({
        handle: handle,
        highScore: score,
        timestamp: Date.now()
      });

      console.log("High score updated:", score);
      res.send({ success: true, message: "High score updated!" });
    } else {
      console.log("Score not high enough to update");
      res.send({ success: true, message: "Score recorded but not a new high score" });
    }
  } catch (error: any) {
    console.error("Error saving score:", error);
    res.status(500).send(error.message);
  }
});

// Get leaderboard (public)
app.get("/getLeaderboard", cors({ origin: true }), async (req:any, res:any) => {
  console.log("GET LEADERBOARD REQUEST");

  try {
    const scoresRef = database.ref('orbitrun-scores');
    const snapshot = await scoresRef.orderByChild('highScore').limitToLast(10).once('value');

    const leaderboard: any[] = [];
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      leaderboard.push({
        handle: data.handle,
        score: data.highScore,
        timestamp: data.timestamp
      });
    });

    // Sort by score descending (limitToLast gives us ascending)
    leaderboard.sort((a, b) => b.score - a.score);

    console.log("Leaderboard retrieved:", leaderboard.length, "entries");
    res.send({ success: true, leaderboard });
  } catch (error: any) {
    console.error("Error getting leaderboard:", error);
    res.status(500).send(error.message);
  }
});


exports.app = functions.https.onRequest(app);