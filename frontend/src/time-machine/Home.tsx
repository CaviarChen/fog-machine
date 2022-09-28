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
  Message,
} from "rsuite";
import "./Home.css";
import Api from "./api";
import DashboardMain from "./DashboardMain";

// I really want ADT
type LoginStatus = {
  loading: boolean;
  loggedIn: boolean;
};

type RegistrationState = {
  registrationToken: string;
  defaultEmail?: string;
};

let initingLoginStatus = false;

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

    // The whole `initingLoginStatus` "lock" is horrible, but I don't have better idea.
    // So in dev mode, react have this `StrictMode`, and starting from react 18, it will
    // call all effect twice to make it easier to spot race conditions etc in dev.
    // https://beta.reactjs.org/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
    // I'm no expert in frontend / react, I think they are saying that effect should be used to fetch data which
    // should be idempotent. Sadly that's not the case here, the github sso login is not. The sso code can only be used
    // once. I don't have a better solution here (maybe we should open github in a new tab for sso and close it, the
    // react app will do a long polling to wait for it?). But I think the thing I am doing now is totally safe.
    // let's worry about this when I know react more.
    if (!loginStatus) {
      if (!initingLoginStatus) {
        initingLoginStatus = true;
        setLoginStatus({ loading: true, loggedIn: false });
        initLoginStatus().finally(() => {
          initingLoginStatus = false;
        });
      }
    }
  }, [loginStatus]);

  const RenderContent = () => {
    const [loading, setLoading] = useState(false);
    const [registerFormValue, setRegisterFormValue] = useState({
      "contact-email": registrationState?.defaultEmail,
    });

    if (!loginStatus || loginStatus.loading) {
      return (
        <div style={{ display: "flex", height: "80vh" }}>
          <Loader size="lg" style={{ margin: "auto" }} />
        </div>
      );
    } else {
      if (loginStatus.loggedIn) {
        return <DashboardMain />;
      } else {
        if (registrationState) {
          const handleSubmit = async (checkStatus: boolean) => {
            setLoading(true);
            if (checkStatus) {
              const contactEmail: string =
                registerFormValue["contact-email"] || "";
              console.log(registerFormValue);
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
              <Form
                fluid
                onSubmit={handleSubmit}
                formDefaultValue={{
                  "contact-email": registrationState.defaultEmail,
                }}
                onChange={(
                  formValue: any // eslint-disable-line @typescript-eslint/no-explicit-any
                ) => {
                  setRegisterFormValue(formValue);
                  console.log(registerFormValue);
                }}
              >
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
              <Message
                showIcon
                type="warning"
                header="Warning"
                style={{ marginTop: "1vh" }}
              >
                This service is in alpha testing. Use it at your own risk.
              </Message>
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

          <RenderContent />
        </div>
      </Content>
    </Container>
  );
}

export default Home;
