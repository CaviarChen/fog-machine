import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ButtonGroup, Container, Panel, Content, Divider, Stack } from "rsuite";
import EditIcon from "@rsuite/icons/Edit";
import HistoryIcon from "@rsuite/icons/History";
import { IconProps } from "@rsuite/icons/lib/Icon";
import { useTranslation } from "react-i18next";
import "./Home.css";

function Item(
  title: string,
  Icon: React.FC<IconProps>,
  description: string,
  onClick: () => void,
  enable: boolean,
) {
  const [hover, setHover] = useState(false);
  return (
    <Panel
      shaded={hover}
      bordered
      bodyFill
      className="home-item"
      onClick={() => { if (enable) { onClick() } }}
      onMouseEnter={() => { if (enable) { setHover(true) } }}
      onMouseLeave={() => { if (enable) { setHover(false) } }}
    >
      <Stack spacing={6}>
        <Icon style={{ fontSize: "6em", margin: "20px" }} />
        <Panel header={title}>
          <p>
            <small>{description}</small>
          </p>
        </Panel>
      </Stack>
    </Panel>
  );
}

function Home() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  return (
    <Container>
      <Content>
        <div className="home-body">
          <div className="home-title">
            <h1>{t("home-main-title")}</h1>
            <h4>{t("home-main-title-desc")}</h4>
          </div>

          <Divider />

          <div style={{ width: "100%" }}>
            <ButtonGroup style={{ display: "table", margin: "0 auto" }} size="lg">
              <Button active={i18n.resolvedLanguage == "zh"} onClick={() => i18n.changeLanguage("zh")}>简体中文</Button>
              <Button active={i18n.resolvedLanguage == "en"} onClick={() => i18n.changeLanguage("en")}>English</Button>
            </ButtonGroup>
          </div>

          {Item(
            t("home-editor-title"),
            EditIcon,
            t("home-editor-desc"),
            () => {
              location.href = "/editor";
            },
            true,
          )}
          {Item(
            t("home-time-machine-title"),
            HistoryIcon,
            t("home-time-machine-desc"),
            () => {
              navigate("/time-machine", { replace: false });
            },
            // hide this before public beta
            false,
          )}
        </div>
      </Content>
    </Container>
  );
}

export default Home;
