import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { url } from "../url";
import Chart from "../utility/Chart";
const DashBoard = () => {
  const [goal, setGoals] = useState([]);
  const navigate = useNavigate();
  
  const handleCreateGoal = () => {
    navigate("/createGoal"); // Redirect to /createGoal page
  };

  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
    axios
      .post(url + "user/getGoals", {
        userToken: localStorage.getItem("token"),
      })
      .then((goals) => {
        setGoals(goals.data);
      });
  }, []);
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
   
      {/* Goals */}
      {goal.length == 0 && <div>No goals created yet</div>}
      <div className="flex flex-wrap">
        {goal.map((el) => (
          <div className="border-2 p-4 ">
            <Chart goal={el} />
          </div>
        ))}
      </div>
      {/* Main Dashboard Content */}
      <div className="flex flex-col justify-center items-center h-[80vh]">
        <button
          className="px-6 py-3 bg-blue-500 text-white text-lg font-semibold rounded-md shadow-md hover:bg-blue-600 transition"
          onClick={handleCreateGoal}
        >
          Create Goal
        </button>
      </div>
    </div>
  );
};

export default DashBoard;
