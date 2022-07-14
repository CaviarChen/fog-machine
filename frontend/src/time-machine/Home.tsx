import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import GithubIcon from "@rsuite/icons/legacy/Github";
import {
  Button,
  Breadcrumb,
  Container,
  Form,
  ButtonToolbar,
  Schema,
  Content,
  Divider,
  Loader,
} from "rsuite";
import "./Home.css";
import Api from "./api";

// I really want ADT
type LoginStatus = {
  loading: boolean;
  loggedIn: boolean;
};

type RegistrationState = {
  registrationToken: string;
  defaultEmail?: string;
};

function Home() {
  const [loginStatus, setLoginStatus] = useState<LoginStatus | null>(null);

  const [registrationState, setRegistrationState] =
    useState<RegistrationState | null>(null);

  useEffect(() => {
    const initLoginStatus = async () => {
      let userInfo = await Api.getUserInfo();
      if (!userInfo) {
        // github sso
        const githubSsoCode = sessionStorage.getItem("github-sso-code");
        sessionStorage.removeItem("github-sso-code");
        if (githubSsoCode) {
          const result = await Api.githubSso(githubSsoCode);
          if (result.ok) {
            if (result.ok.login) {
              userInfo = await Api.getUserInfo();
            } else {
              setRegistrationState({
                registrationToken: result.ok.registrationToken!,
                defaultEmail: result.ok.defaultEmail,
              });
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
    };

    if (!loginStatus) {
      setLoginStatus({ loading: true, loggedIn: false });
      initLoginStatus();
    }
  }, [loginStatus]);

  const renderContent = () => {
    const [loading, setLoading] = useState(false);
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
        if (registrationState) {
          const handleSubmit = async (
            checkStatus: boolean,
            event: any // eslint-disable-line @typescript-eslint/no-explicit-any
          ) => {
            setLoading(true);
            if (checkStatus) {
              const contactEmail: string = event.target["contact-email"].value;
              // TODO: handle `language`
              const result = await Api.register(
                registrationState.registrationToken,
                contactEmail,
                "en-us"
              );
              if (result.ok == "ok") {
                // re-init loginStatus
                setLoginStatus(null);
              } else {
                // TODO: handle error
                console.error(result);
              }
            }
            setLoading(false);
          };

          return (
            <>
              <h3>Register</h3>
              <div style={{ marginTop: "2vh" }}></div>

              <Form fluid onSubmit={handleSubmit}>
                <Form.Group>
                  <Form.ControlLabel>Contact Email</Form.ControlLabel>
                  <Form.Control
                    name="contact-email"
                    rule={Schema.Types.StringType()
                      .isRequired("This field is required.")
                      .isEmail("Please enter a valid email address.")}
                  />
                </Form.Group>
                <Form.Group>
                  <ButtonToolbar style={{ float: "right" }}>
                    <Button
                      appearance="primary"
                      type="submit"
                      loading={loading}
                    >
                      Submit
                    </Button>
                  </ButtonToolbar>
                </Form.Group>
              </Form>
            </>
          );
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
