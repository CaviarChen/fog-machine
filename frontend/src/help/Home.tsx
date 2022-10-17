import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import React from "react";
import { Breadcrumb, Container, Content, Divider } from "rsuite";

function Home() {
  const HelpContent = () => {
    return <>
      <h3>1.Hello world!</h3>
      <p>Hello world!</p>
      <h3>2.Hello world!</h3>
      <p>Hello world!</p>
    </>
  };

  const navigate = useNavigate();
  const { t } = useTranslation();
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
              {t("home-main-title")}
            </Breadcrumb.Item>
            <Breadcrumb.Item active>{t("home-help-title")}</Breadcrumb.Item>
          </Breadcrumb>

          <Divider style={{ marginTop: "1vh" }} />

          <HelpContent />
        </div>
      </Content>
    </Container>
  );
}

export default Home;
