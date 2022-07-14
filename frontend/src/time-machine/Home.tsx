import React, { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
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
  const [loginStatus, setLoginStatus] = useState<LoginStatus | null>(null);

  const init = async () => {
    if (!loginStatus) {
      const userInfo = await Api.getUserInfo();
      if (userInfo) {
        setLoginStatus({ loading: false, loggedIn: true });
      } else {
        setLoginStatus({ loading: false, loggedIn: false });
      }
    }
  };
  init();

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
              <Button>
                <GithubIcon style={{ fontSize: "2em" }} /> Sign in with Github
              </Button>
            </div>
          </>
        );
      }
    }
  };

  return (
    <Container>
      <Content>
        let [searchParams, setSearchParams] = useSearchParams();
        <div className="time-machine-body">
          <Breadcrumb
            style={{ marginTop: "5vh", marginBottom: "0", fontSize: "19px" }}
          >
            {/* TODO: `Link` below is causing warning, not sure what's the right way to do this */}
            <Link to="/">
              <Breadcrumb.Item href="/">Fog Machine</Breadcrumb.Item>
            </Link>
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
