import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import GithubCorner from "./GithubCorner";
import Home from "./Home";
import TimeMachineHome from "./time-machine/Home";
import zhCN from "rsuite/locales/zh_CN";
import enUS from "rsuite/locales/en_US";
import { CustomProvider } from "rsuite";
import { useTranslation } from "react-i18next";
import HelpHome from "./help/Home";
import { useState, useEffect } from "react";
import Error404 from "./ErrorPage/Error404";

function GithubSsoRedirect() {
  const [searchParams, _] = useSearchParams();
  // this is ugly
  sessionStorage.setItem("github-sso-code", searchParams.get("code") || "");
  return <Navigate to="/time-machine" replace />;
}

function App() {
  const [isDark, setIsDark] = useState(
    localStorage.getItem("isDark") == "true"
  );
  useEffect(() => {
    localStorage.setItem("isDark", isDark ? "true" : "false");
  }, [isDark]);
  const { i18n } = useTranslation();

  return (
    <CustomProvider
      theme={isDark ? "dark" : "light"}
      locale={i18n.resolvedLanguage == "zh" ? zhCN : enUS}
    >
      <GithubCorner />
      <Routes>
        <Route
          path="/"
          element={<Home isDark={isDark} setIsDark={setIsDark} />}
        />
        <Route path="/time-machine" element={<TimeMachineHome />} />
        <Route path="/help" element={<HelpHome />} />
        {/* github sso */}
        <Route path="/callback/github" element={<GithubSsoRedirect />} />
        <Route path="*" element={<Error404 />} />
      </Routes>
    </CustomProvider>
  );
}

export default App;
