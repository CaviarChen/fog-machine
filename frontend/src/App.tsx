import React, { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import GithubCorner from "./GithubCorner";
import Home from "./Home";


function App() {
  return (
    <>
      <GithubCorner />
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </>
  )

}

export default App;
