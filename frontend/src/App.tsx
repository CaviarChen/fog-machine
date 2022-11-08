import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import GithubCorner from "./GithubCorner";
import Home from "./Home";
import TimeMachineHome from "./time-machine/Home";
import zhCN from "rsuite/locales/zh_CN";
import enUS from "rsuite/locales/en_US";
import { CustomProvider } from "rsuite";
import { useTranslation } from "react-i18next";
import HelpHome from "./help/Home";

function GithubSsoRedirect() {
  const [searchParams, _] = useSearchParams();
  // this is ugly
  sessionStorage.setItem("github-sso-code", searchParams.get("code") || "");
  return <Navigate to="/time-machine" replace />;
}

function App() {
  const { i18n } = useTranslation();
  return (
    <CustomProvider locale={i18n.language.startsWith("zh") ? zhCN : enUS}>
      <GithubCorner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/time-machine" element={<TimeMachineHome />} />
        <Route path="/help" element={<HelpHome />} />
        {/* github sso */}
        <Route path="/callback/github" element={<GithubSsoRedirect />} />
      </Routes>
    </CustomProvider>
  );
}

export default App;
