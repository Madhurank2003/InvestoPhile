const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../model/userModel");
const Goal = require("../model/Goal");
const Allocation = require("../model/Allocation");
const axios = require("axios");
const { checkAuth } = require("../utils/auth");
const generateError = (err, code) => {
  const error = new Error(err);
  error.statusCode = code;
  return error;
};
const createToken = (id) => {
  const token = jwt.sign({ id }, process.env.JWT_KEY);
  return token;
};
function allocateAssets(riskTolerance, durationMonths) {
  let allocation = [
    { label: "STOCK", value: 0 },
    { label: "MUTUALFUNDS", value: 0 },
    { label: "GOLD", value: 0 },
    { label: "FIXED DEPOSIT", value: 0 },
    { label: "BONDS", value: 0 },
  ];

  // Adjustments based on duration
  let durationFactor = 0;
  if (durationMonths <= 12) {
    durationFactor = 0; // Short-term: low risk
  } else if (durationMonths <= 36) {
    durationFactor = 1; // Medium-term: moderate risk
  } else {
    durationFactor = 2; // Long-term: higher risk
  }

  // Base allocations based on risk tolerance
  if (riskTolerance === "Very Low") {
    allocation = [
      { label: "STOCK", value: 10 + durationFactor * 5 },
      { label: "BONDS", value: 40 },
      { label: "FIXED DEPOSIT", value: 40 },
      { label: "MUTUALFUNDS", value: 5 + durationFactor * 5 },
      { label: "GOLD", value: 5 },
    ];
  } else if (riskTolerance === "Low") {
    allocation = [
      { label: "STOCK", value: 20 + durationFactor * 10 },
      { label: "BONDS", value: 35 },
      { label: "FIXED DEPOSIT", value: 35 },
      { label: "MUTUALFUNDS", value: 5 + durationFactor * 5 },
      { label: "GOLD", value: 5 },
    ];
  } else if (riskTolerance === "Moderate") {
    allocation = [
      { label: "STOCK", value: 40 + durationFactor * 15 },
      { label: "BONDS", value: 25 },
      { label: "FIXED DEPOSIT", value: 20 },
      { label: "MUTUALFUNDS", value: 10 + durationFactor * 10 },
      { label: "GOLD", value: 5 },
    ];
  } else if (riskTolerance === "High") {
    allocation = [
      { label: "STOCK", value: 60 + durationFactor * 20 },
      { label: "BONDS", value: 15 },
      { label: "FIXED DEPOSIT", value: 10 },
      { label: "MUTUALFUNDS", value: 10 + durationFactor * 5 },
      { label: "GOLD", value: 5 },
    ];
  } else if (riskTolerance === "Very High") {
    allocation = [
      { label: "STOCK", value: 80 + durationFactor * 20 },
      { label: "BONDS", value: 5 },
      { label: "FIXED DEPOSIT", value: 5 },
      { label: "MUTUALFUNDS", value: 5 },
      { label: "GOLD", value: 5 },
    ];
  } else {
    throw new Error(
      "Invalid risk tolerance level. Choose from: 'Very Low', 'Low', 'Moderate', 'High', 'Very High'."
    );
  }

  // Normalize directly within the function
  const totalValue = (() => {
    let sum = 0;
    for (let i = 0; i < allocation.length; i++) {
      sum += allocation[i].value;
    }
    return sum;
  })();

  allocation = allocation.map((asset) => ({
    label: asset.label,
    value: (asset.value / totalValue) * 100, // Normalize percentage
  }));

  return allocation;
}
const getUserFromToken = (token) => {
  try {
    const userId = jwt.verify(token, process.env.JWT_KEY);
    return userId;
  } catch (error) {
    throw new Error("Invalid Token");
  }
};

router.post("/signup", async (req, res, next) => {
  const { name, email, password, age } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      throw generateError("User Already Exists", 409);
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      age,
    });

    const token = createToken(newUser._id);
    res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
});
router.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw generateError("User does not exsits", 401);
    }
    const isValidPassword = bcrypt.compareSync(password, user.passwordHash);
    if (!isValidPassword) {
      throw generateError("Wrong password", 404);
    }
    const token = createToken(user._id);
    res.status(200).json({ token, name: user.name });
  } catch (error) {
    next(error);
  }
});

router.post("/getGoals", async (req, res, next) => {
  const { userToken } = req.body;
  const userId = getUserFromToken(userToken).id;
  if (!userToken) {
    return res.status(401).json({ error: "Authorization token missing" });
  }
  try {
    const goals = await Goal.find({ userId }).populate("allocation");
    if (!goals || goals.length == 0) {
      throw generateError("No Existing Goals", 409);
      //res.status(500).send("Err");
    }
    res.status(200).json(goals);
  } catch (error) {
    next(error);
    //console.log(error);
  }
});

router.post(
  "/createGoal",
  async (req, res, next) => {
    const { goalDetails } = req.body;
    try {
      const investmentAmount = +goalDetails.investmentAmount;
      const targetAmount = +goalDetails.targetAmount;
      const duration = +goalDetails.duration;
      const risk_capacity = +goalDetails.riskTolerance;

      const goal = {
        amount: investmentAmount,
        expected_return:
          ((targetAmount - investmentAmount)) / investmentAmount,
        risk_capacity: risk_capacity,
        duration: duration,
      };

      const response = await axios.post("http://127.0.0.1:5000/optimize", goal);
      const [stock, fixedDeposit, gold, govt_bond, mutualFund] =
        response.data.optimal_weights;
      const projected_return = response.data.portfolio_metrics.total_return;
      const sharpe_ratio = response.data.portfolio_metrics.sharpe_ratio;
      const projected_cagr = response.data.portfolio_metrics.annualized_return;
      const allocation = await Allocation.create({
        stock: stock * 100,
        fixedDeposit: fixedDeposit * 100,
        gold: gold * 100,
        govt_bond: govt_bond * 100,
        mutualFund: mutualFund * 100,
        projected_return: projected_return * 100,
        sharpe_ratio: sharpe_ratio,
        projected_cagr: projected_cagr * 100,
      });

      req.allocation = allocation._id;

      next();
    } catch (err) {
      next(err);
    }
  },
  async (req, res, next) => {
    const { userToken, goalDetails } = req.body;
    const {
      goalName,
      investmentType,
      investmentAmount,
      targetAmount,
      riskTolerance,
      frequency,
      duration,
    } = goalDetails;
    if (!userToken) {
      return res.status(401).json({ error: "Authorization token missing" });
    }

    const userId = getUserFromToken(userToken).id;
    const progress = [{ progressNumber: 0, investment: investmentAmount }];

    try {
      const allocation = req.allocation;
      const newGoal = await Goal.create({
        userId,
        goalName,
        investmentType,
        investmentAmount,
        targetAmount,
        riskTolerance,
        frequency,
        duration,
        progress,
        allocation,
      });
      res.status(200).json({ message: "Successful", goalId: newGoal._id });
    } catch (error) {
      next(error);
    }
  }
);

router.delete("/deleteGoal", async (req, res, next) => {
  try {
    const { userToken, goalId } = req.body;

    const userId = getUserFromToken(userToken).id;
    if (!userToken) {
      return res.status(401).json({ error: "Authorization token missing" });
    }
    const goal = await Goal.findById(goalId);
    if (!goal) {
      throw generateError("No Goal with this ID", 404);
    }
    await Allocation.findByIdAndDelete(goal.allocation);
    await Goal.findByIdAndDelete(goalId);
    res.status(200).json({ message: "Deletion sucessfull" });
  } catch (error) {
    next(error);
  }
});

router.put("/updateGoal/", async (req, res, next) => {
  try {
    const { userToken, goalDetails } = req.body;
    const userId = getUserFromToken(userToken).id;
    const { progress } = goalDetails;
    if (!userToken) {
      return res.status(401).json({ error: "Authorization token missing" });
    }
    const goal = await Goal.findById(goalDetails._id);
    if (!goal) {
      throw generateError("Goal Not Found!", 404);
    }
    const updatedGoal = await Goal.findByIdAndUpdate(
      goalDetails._id,
      { progress },
      { new: true }
    );
    res.status(200).json({ message: "Successfull" });
  } catch (error) {
    next(error);
  }
});
module.exports = router;
