import { initializeApp } from "firebase/app";
import { getStorage, ref as storeRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {  getDatabase, set, ref, get, child, update } from "firebase/database";

import * as functions from "firebase-functions";
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const bodyParser = require('body-parser');

dotenv.config();

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: process.env.FB_API_KEY,
    authDomain: process.env.FB_AUTH_DOMAIN,
    databaseURL: process.env.FB_DB_NAME,
    projectId: process.env.FB_PROJECT_ID,
    storageBucket: process.env.FB_STORAGE_BUCKET,
    messagingSenderId: process.env.FB_MESSAGING_SENDER_ID,
    appId: process.env.FB_APP_ID,
    measurementId: process.env.FB_MEASUREMENT_ID
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
app.use(cors({ origin: true })); // Use the cors middleware
const memoStorage = multer.memoryStorage();
const upload = multer({ memoStorage });
  
  app.get("/", (req:any, res:any) => {
    res.send("working fine");
  });

  app.get("/getUser/:userId", (req:any, res:any) => {
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
app.post("/saveImage", upload.single("file"),(req:any, res:any) => {

    console.log("START SAVE IMAGE", req.body)
    // const storageRef = storeRef(storage, 'some-child');

    const file = req.file;
    // const whoah = req.whoah;
    console.log("FILE", file, req.body.whoah)

    let fileNameEnd = "";

    // if(req.body.mimetype == 'image/jpeg') {
    //     fileNameEnd = ".jpg"
    // }
    // else if(req.body.mimetype == 'image/png') {
    //     fileNameEnd = ".png"
    // }

    if(req.file.mimetype == 'image/jpeg') {
        fileNameEnd = ".jpg"
    }
    else if(req.file.mimetype == 'image/png') {
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


app.get("/getPage/:pageId", (req:any, res:any) => {
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

app.post("/savePage/:pageId", (req:any, res:any) => {
    // figure out how to get params from this request?
    console.log("START SAVE REQ")
    const pageId = req.params.pageId
    let reqBody = req.body
    console.log(req.body);

    set(ref(database, 'pages/' + pageId), {
        name: reqBody.name,
        userId: reqBody.userId,
        blockMap: reqBody.blockMap,
        auth: reqBody.auth
    });

    res.send("success")
});
  
  
  app.post("/createPage", (req:any, res:any) => {
    // figure out how to get params from this request?
    console.log("START CREATE PAGE 📜", req.body)

    // get all request params from body
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

    const updates: any = {};
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


app.get("/checkHandleIsFree/:handle", (req:any, res:any) => {
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


app.post("/createHandle", (req:any, res:any) => {
    // figure out how to get params from this request?
    console.log("START CREATE HANDLE ＠", req.body)

    // get all request params from body
    const userId = req.body.userId
    const handle = req.body.handle

    set(ref(database, 'userCollection/' + userId), {
        "handle": handle,
    });

    const updates: any = {};
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


app.get("/getUserId/:handle", (req:any, res:any) => {
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


// const PORT = process.env.FB_PORT || 8080; // Use this instead of hardcoding it like before

// app.listen(PORT, () => {
// console.log(`Server listening on port ${PORT}`);
// });



exports.app = functions.https.onRequest(app);