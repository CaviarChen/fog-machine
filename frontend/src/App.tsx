import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import GithubCorner from "./GithubCorner";
import Home from "./Home";
import TimeMachineHome from "./time-machine/Home";

function GithubSsoRedirect() {
  const [searchParams, _] = useSearchParams();
  // this is ugly
  sessionStorage.setItem("github-sso-code", searchParams.get("code") || "");
  return <Navigate to="/time-machine" replace />;
}

function App() {
  return (
    <>
      <GithubCorner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/time-machine" element={<TimeMachineHome />} />
        {/* github sso */}
        <Route path="/callback/github" element={<GithubSsoRedirect />} />
      </Routes>
    </>
  );
}

export default App;
