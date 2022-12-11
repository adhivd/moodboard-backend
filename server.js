import { initializeApp } from "firebase/app";
import { getStorage, ref as storeRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { equalTo, getDatabase, set, ref, get, child, update } from "firebase/database";

import express from "express";
import cors from "cors"; // Add this to the list of imports
import dotenv from "dotenv";
import multer from "multer";
import bodyParser from "body-parser"
// import filesUpload from "./middleware.js";


dotenv.config();


// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DB_NAME,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  };
  
  // Initialize Firebase
  const appFire = initializeApp(firebaseConfig);
  
  // Initialize Realtime Database and get a reference to the service
  const database = getDatabase(appFire);
  const storage = getStorage();



  const app = express();

// app.use(bodyParser.json({limit: '50mb'}));
// app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
// app.use(bodyParser.urlencoded({extended:true, limit:'50mb'})); 
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true, parameterLimit: 1000000}));

app.use(express.json());
app.use(cors()); // Use the cors middleware
const memoStorage = multer.memoryStorage();
const upload = multer({ memoStorage });
  
  app.get("/", (req, res) => {
    res.send("working fine");
  });

  app.get("/getUser/:userId", (req, res) => {
    // figure out how to get params from this request?
    const userId = req.params.userId
    // const userInfo = "";
    // const userInfo = ref(database, 'userCollection/' + userId);

    const dbRef = ref(database);
    get(child(dbRef, 'userCollection/' + userId))
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

// save an image that a user has uploaded
app.post("/saveImage", upload.single("file"),(req, res) => {

    console.log("START SAVE IMAGE", req.body)
    const storageRef = storeRef(storage, 'some-child');

    const file = req.file;
    const whoah = req.whoah;
    console.log("FILE", file, req.body.whoah)

    let fileNameEnd = "";

    if(req.body.mimetype == 'image/jpeg') {
        fileNameEnd = ".jpg"
    }
    else if(req.body.mimetype == 'image/png') {
        fileNameEnd = ".png"
    }

    let fileName = "images/" + req.body.pageId + "/" + req.body.blockId + fileNameEnd

    // const imageRef = storeRef(storage, file.originalname);
    const imageRef = storeRef(storage, fileName);
    const metatype = { contentType: file.mimetype, name: fileName };

    uploadBytes(imageRef, file.buffer, metatype)
        .then((snapshot) => {
            console.log("uploaded image")
            getDownloadURL(snapshot.ref).then((downloadURL) => {
                console.log('File available at', downloadURL);
                res.send(downloadURL);
              });
        })
        .catch((error) => console.log(error.message));

});


app.get("/getPage/:pageId", (req, res) => {
    // figure out how to get params from this request?
    const pageId = req.params.pageId
    const dbRef = ref(database);

    console.log("pageId:", pageId)
    get(child(dbRef, 'pages/' + pageId))
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

app.post("/savePage/:pageId", (req, res) => {
    // figure out how to get params from this request?
    console.log("START SAVE REQ")
    const pageId = req.params.pageId
    let reqBody = req.body
    console.log(req.body);

    set(ref(database, 'pages/' + pageId), {
        name: reqBody.name,
        userId: reqBody.userId,
        blockMap: reqBody.blockMap,
    });

    res.send("success")
});
  
  
  app.post("/createPage", (req, res) => {
    // figure out how to get params from this request?
    console.log("START CREATE PAGE 📜", req.body)

    // get all request params from body
    const pageId = req.body.pageId
    const pageName = req.body.name
    const userId = req.body.userId
    const blockMap = req.body.blockMap

    let pagesUpdate = {
        name: pageName,
        userId: userId,
        blockMap: blockMap,
    }

    const updates = {};
    updates['/pages/' + pageId] = pagesUpdate;
    updates['/userCollection/' + userId + '/pages/' + pageId] = pageName;
    update(ref(database), updates)
        .then((r) => {
            console.log("update success")
            res.send("success")
        })
        .catch((e) => {
            console.log("error saving data", e)
        })
});


app.get("/checkHandleIsFree/:handle", (req, res) => {
    // figure out how to get params from this request?
    const handle = req.params.handle
    // const userInfo = "";
    // const userInfo = ref(database, 'userCollection/' + userId);

    const dbRef = ref(database);
    get(child(dbRef, 'handleStore/' + handle))
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


app.post("/createHandle", (req, res) => {
    // figure out how to get params from this request?
    console.log("START CREATE HANDLE ＠", req.body)

    // get all request params from body
    const userId = req.body.userId
    const handle = req.body.handle

    let handleUpdate = {
        handle: handle,
        userId: userId
    }

    set(ref(database, 'userCollection/' + userId), {
        "handle": handle,
    });

    const updates = {};
    updates['handleStore/' + handle] = userId;
    // updates['userCollection/' + userId + '/handle'] = handle;
    console.log("in theory. handle created");
    update(ref(database), updates)
        .then((r) => {
            console.log("update success")
            res.send("success")
        })
        .catch((e) => {
            console.log("error saving data", e)
        })
});


app.get("/getUserId/:handle", (req, res) => {
    // figure out how to get params from this request?
    const handle = req.params.handle
    // const userInfo = "";
    // const userInfo = ref(database, 'userCollection/' + userId);
    console.log("/getUserId/:handle request 🍻")

    const dbRef = ref(database);
    get(child(dbRef, 'handleStore/' + handle))
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


const PORT = process.env.PORT || 8080; // Use this instead of hardcoding it like before

app.listen(PORT, () => {
console.log(`Server listening on port ${PORT}`);
});


//   // [START rtdb_write_new_user]
// function updateHandle(userId, handle) {
//     database.ref('users/' + userId).set({
//       handle: handle,
//     });
// }