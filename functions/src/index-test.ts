import * as functions from "firebase-functions";
const express = require('express');

const app = express();
app.get("/hello", (req:any, res:any) => {
    res.send("hi");
})

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//
exports.app = functions.https.onRequest(app);
