import { useState, useEffect } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import GithubIcon from "@rsuite/icons/legacy/Github";
import {
  Button,
  Breadcrumb,
  Container,
  Panel,
  Content,
  Divider,
  Loader,
  Stack,
} from "rsuite";
import "./Home.css";
import Api from "./api";

// I really want ADT
type LoginStatus = {
  loading: boolean;
  loggedIn: boolean;
};

function Home() {
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({
    loading: true,
    loggedIn: false,
  });

  useEffect(() => {
    (async () => {
      let userInfo = await Api.getUserInfo();
      if (!userInfo) {
        // github sso
        const githubSsoCode = sessionStorage.getItem("github-sso-code");
        if (githubSsoCode) {
          sessionStorage.removeItem("github-sso-code");
          const result = await Api.githubSso(githubSsoCode);
          if (result.ok) {
            if (result.ok.login) {
              userInfo = await Api.getUserInfo();
            } else {
              //TODO: register
            }
          } else {
            // TODO: error handling
            console.log("ERROR", result);
          }
        }
      }

      if (userInfo) {
        setLoginStatus({ loading: false, loggedIn: true });
      } else {
        setLoginStatus({ loading: false, loggedIn: false });
      }
    })();
  }, []);

  const renderContent = () => {
    if (!loginStatus || loginStatus.loading) {
      return (
        <div style={{ display: "flex", height: "80vh" }}>
          <Loader size="lg" style={{ margin: "auto" }} />
        </div>
      );
    } else {
      if (loginStatus.loggedIn) {
        return <></>;
      } else {
        return (
          <>
            <h3>Login</h3>
            <div style={{ marginTop: "8vh" }}></div>
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Button
                onClick={() => {
                  location.href = Api.backendUrl + "user/sso/github";
                }}
              >
                <GithubIcon style={{ fontSize: "2em" }} /> Sign in with Github
              </Button>
            </div>
          </>
        );
      }
    }
  };

  const navigate = useNavigate();

  return (
    <Container>
      <Content>
        <div className="time-machine-body">
          <Breadcrumb
            style={{ marginTop: "5vh", marginBottom: "0", fontSize: "19px" }}
          >
            <Breadcrumb.Item
              onClick={() => {
                navigate("/", { replace: false });
              }}
              href="/"
            >
              Fog Machine
            </Breadcrumb.Item>
            <Breadcrumb.Item active>Time Machine</Breadcrumb.Item>
          </Breadcrumb>

          <Divider style={{ marginTop: "1vh" }} />

          {renderContent()}
        </div>
      </Content>
    </Container>
  );
}

export default Home;
