const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../model/userModel');
const Goal = require('../model/Goal');
const Allocation = require('../model/Allocation');
const axios = require('axios');

jest.mock('axios');

let mongoServer;

// Set a longer timeout for database operations
jest.setTimeout(30000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('User Authentication', () => {
  describe('POST /user/signup', () => {
    it('should create a new user and return a token', async () => {
      const res = await request(app)
        .post('/user/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          age: 30,
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should return 409 if user already exists', async () => {
      await User.create({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        age: 30,
      });

      const res = await request(app)
        .post('/user/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          age: 30,
        });
      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toBe('User Already Exists');
    });
  });

  describe('POST /user/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/user/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          age: 30,
        });
    });

    it('should login an existing user and return a token', async () => {
      const res = await request(app)
        .post('/user/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('name', 'Test User');
    });

    it('should return 401 if user does not exist', async () => {
      const res = await request(app)
        .post('/user/login')
        .send({
          email: 'wrong@example.com',
          password: 'password123',
        });
      expect(res.statusCode).toEqual(401);
      expect(res.body.message).toBe('User does not exsits');
    });

    it('should return 404 if password is wrong', async () => {
      const res = await request(app)
        .post('/user/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });
      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toBe('Wrong password');
    });
  });
});

describe('Goal Management', () => {
  let userToken;
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Goal.deleteMany({});
    await Allocation.deleteMany({});

    const userRes = await request(app)
      .post('/user/signup')
      .send({
        name: 'Goal User',
        email: 'goal@example.com',
        password: 'password123',
        age: 25,
      });
    userToken = userRes.body.token;

    const user = await User.findOne({ email: 'goal@example.com' });
    userId = user._id;
  });

  describe('POST /user/createGoal', () => {
    it('should create a new goal', async () => {
      const goalDetails = {
        goalName: 'Test Goal',
        investmentType: 'Sip',
        investmentAmount: '10000',
        targetAmount: '50000',
        riskTolerance: '3',
        frequency: 'Monthly',
        duration: 24,
      };

      axios.post.mockResolvedValue({
        data: {
          optimal_weights: [0.2, 0.2, 0.2, 0.2, 0.2],
          portfolio_metrics: {
            total_return: 0.15,
            sharpe_ratio: 1.5,
            annualized_return: 0.12,
          },
        },
      });

      const res = await request(app)
        .post('/user/createGoal')
        .send({ userToken, goalDetails });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Successful');
      expect(res.body).toHaveProperty('goalId');

      const goal = await Goal.findById(res.body.goalId).populate('allocation');
      expect(goal).not.toBeNull();
      expect(goal.goalName).toBe('Test Goal');
      expect(goal.allocation.stock).toBe(20);
    });
  });

  describe('POST /user/getGoals', () => {
    it('should return 409 if no goals exist', async () => {
      const res = await request(app)
        .post('/user/getGoals')
        .send({ userToken });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toBe('No Existing Goals');
    });

    it('should retrieve all goals for a user', async () => {
      const allocation = await Allocation.create({
        stock: 20,
        fixedDeposit: 20,
        gold: 20,
        govt_bond: 20,
        mutualFund: 20,
        projected_return: 15,
        sharpe_ratio: 1.5,
        projected_cagr: 12,
      });
      await Goal.create({
        userId,
        goalName: 'My Test Goal',
        investmentAmount: '1000',
        targetAmount: '5000',
        duration: 12,
        investmentType: 'Sip',
        riskTolerance: '1',
        allocation: allocation._id,
      });

      const res = await request(app)
        .post('/user/getGoals')
        .send({ userToken });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(1);
      expect(res.body[0].goalName).toBe('My Test Goal');
    });
  });

  describe('DELETE /user/deleteGoal', () => {
    it('should delete a specific goal', async () => {
      const allocation = await Allocation.create({
        stock: 20,
        fixedDeposit: 20,
        gold: 20,
        govt_bond: 20,
        mutualFund: 20,
        projected_return: 15,
        sharpe_ratio: 1.5,
        projected_cagr: 12,
      });

      const goal = await Goal.create({
        userId,
        goalName: 'Goal to be deleted',
        investmentAmount: '1000',
        targetAmount: '2000',
        duration: 12,
        investmentType: 'Sip',
        riskTolerance: '3',
        allocation: allocation._id,
      });

      const res = await request(app)
        .delete('/user/deleteGoal')
        .send({ userToken, goalId: goal._id });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe('Deletion sucessfull');

      const deletedGoal = await Goal.findById(goal._id);
      expect(deletedGoal).toBeNull();
    });
  });

  describe('PUT /user/updateGoal', () => {
    it("should update a goal's progress", async () => {
      const allocation = await Allocation.create({
        stock: 20,
        fixedDeposit: 20,
        gold: 20,
        govt_bond: 20,
        mutualFund: 20,
        projected_return: 15,
        sharpe_ratio: 1.5,
        projected_cagr: 12,
      });

      let goal = await Goal.create({
        userId,
        goalName: 'Goal to be updated',
        investmentAmount: '1000',
        targetAmount: '2000',
        duration: 12,
        investmentType: 'Sip',
        riskTolerance: '3',
        progress: [{ progressNumber: '0', investment: 1000 }],
        allocation: allocation._id,
      });

      const updatedProgress = [
        ...goal.progress,
        { progressNumber: '1', investment: 1100 },
      ];

      const res = await request(app)
        .put('/user/updateGoal')
        .send({
          userToken,
          goalDetails: {
            _id: goal._id,
            progress: updatedProgress,
          },
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toBe('Successfull');

      const updatedGoal = await Goal.findById(goal._id);
      expect(updatedGoal.progress.length).toBe(2);
      expect(updatedGoal.progress[1].investment).toBe(1100);
    });
  });
});