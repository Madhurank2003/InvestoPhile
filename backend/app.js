const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const app = express();
const userRoutes = require("./routes/userRoutes");
const cors = require("cors");
app.use(express.json());
app.use(cors());

// We will connect to a test database for testing
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.log(err);
    });
}

app.use("/user", userRoutes);

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ message: err.message });
});

module.exports = app;