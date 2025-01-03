import * as React from "react";
import { useState, useEffect } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import { useDrawingArea } from "@mui/x-charts/hooks";
import { styled } from "@mui/material/styles";
import { NavLink } from "react-router-dom";
const data = [
  { value: 5, label: "STOCK" },
  { value: 10, label: "MUTUALFUNDS" },
  { value: 15, label: "GOLD" },
  { value: 20, label: "BONDS" },
  { value: 50, label: "FIXED DEPOSIT" },
];

const size = {
  width: 600,
  height: 200,
};

const StyledText = styled("text")(({ theme }) => ({
  fill: theme.palette.text.primary,
  textAnchor: "middle",
  dominantBaseline: "central",
  fontSize: 20,
}));

function PieCenterLabel({ children }) {
  const { width, height, left, top } = useDrawingArea();
  return (
    <StyledText x={left + width / 2} y={top + height / 2}>
      {children}
    </StyledText>
  );
}

export default function PieChartWithCenterLabel({ goal }) {
  const [allocation, setallocation] = useState([]);
  useEffect(() => {
    setallocation(goal.allocation);
  }, [goal]);
  console.log(allocation);
  return (
    <NavLink to={"/goal/" + goal._id} state={{ goal }}>
      <PieChart series={[{ data: allocation, innerRadius: 80 }]} {...size}>
        <PieCenterLabel>{goal.goalName}</PieCenterLabel>
      </PieChart>
    </NavLink>
  );
}
