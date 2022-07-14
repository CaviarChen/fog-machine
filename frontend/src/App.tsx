import React, { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import GithubCorner from "./GithubCorner";
import Home from "./Home";
import TimeMachineHome from "./time-machine/Home";

function App() {
  return (
    <>
      <GithubCorner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/time-machine" element={<TimeMachineHome />} />
      </Routes>
    </>
  );
}

export default App;
